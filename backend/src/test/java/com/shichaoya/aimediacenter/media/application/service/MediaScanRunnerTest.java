package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.application.port.MediaSourceAdapter;
import com.shichaoya.aimediacenter.media.domain.MediaFileDirectory;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaResourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaResourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanTaskMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.security.SourceConnectionEncryption;
import com.shichaoya.aimediacenter.media.infrastructure.webdav.WebDavMediaSourceAdapter;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.TransactionTimedOutException;
import org.springframework.transaction.support.DefaultTransactionStatus;
import tools.jackson.databind.json.JsonMapper;
import javax.sql.DataSource;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.SQLTimeoutException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MediaScanRunnerTest {
    private final MediaScanTaskMapper tasks = mock(MediaScanTaskMapper.class);
    private final MediaResourceMapper resources = mock(MediaResourceMapper.class);
    private final MediaSourceAdapter adapter = mock(MediaSourceAdapter.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final TransactionStatus transactionStatus = mock(TransactionStatus.class);
    private final SourceConnectionEncryption encryption = new SourceConnectionEncryption(Base64.getEncoder().encodeToString(new byte[32]),
            JsonMapper.builder().build());
    private final SourceConnection connection = new SourceConnection("http://localhost/dav/", "fixture-user", "fixture-password");
    private final MediaSourceRow source = new MediaSourceRow("source", "alice", "来源", "WEBDAV",
            encryption.encrypt(connection, "alice", "source"), true, null, LocalDateTime.of(2026, 10, 3, 0, 0));
    private final List<MediaScanRunner> runners = new ArrayList<>();
    private MediaScanRunner runner;

    @BeforeEach void setup() {
        when(transactions.getTransaction(any())).thenReturn(transactionStatus);
        when(tasks.start(anyString())).thenReturn(1);
        when(tasks.lockStatus(anyString())).thenReturn("RUNNING");
        runner = runner(new MediaScanLimits(1, 1, 10, 10, 100, 4, 30));
    }
    @AfterEach void close() { runners.forEach(MediaScanRunner::close); }

    @Test void recursivelyPersistsOnlyVideosWithUtcFactsAndAllThreeCounters() {
        var modified = Instant.parse("2026-10-02T12:30:00Z");
        directory("/a", entry("/a/sub", "directory", null, null), entry("/a/Movie.MKV", "file", 123L, modified),
                entry("/a/readme.txt", "file", 12L, modified));
        directory("/a/sub", entry("/a/sub/Second.mp4", "file", null, null));
        runner.scan("task", source, List.of("/a"));
        var captured = ArgumentCaptor.forClass(MediaResourceRow.class);
        verify(resources, times(2)).insert(captured.capture());
        assertEquals(List.of("/a/Movie.MKV", "/a/sub/Second.mp4"), captured.getAllValues().stream().map(MediaResourceRow::path).toList());
        assertEquals(7, UUID.fromString(captured.getValue().id()).version());
        assertEquals(123L, captured.getAllValues().getFirst().size());
        assertEquals(LocalDateTime.of(2026, 10, 2, 12, 30), captured.getAllValues().getFirst().modifiedAt());
        assertNull(captured.getValue().size()); assertNull(captured.getValue().modifiedAt());
        verify(tasks).finish("task", "COMPLETED", 2, 2, 2, null, null);
        verify(tasks, times(2)).progress("task", 1, 1, 1); verify(tasks, times(2)).progress("task", 2, 2, 2);
    }

    @Test void repeatedFilesKeepIdAndRecognitionStateWhileUpdatingOnlyFacts() {
        directory("/a", entry("/a/Movie.mp4", "file", 99L, null));
        var hash = MediaScanService.hash("/a/Movie.mp4");
        var old = new MediaResourceRow("stable-id", "source", "/a/Movie.mp4", hash, "Movie.mp4", 1L, null, "UNIDENTIFIED");
        when(resources.lockByPathHash(eq("source"), any())).thenReturn(old);
        runner.scan("task", source, List.of("/a"));
        var captured = ArgumentCaptor.forClass(MediaResourceRow.class);
        verify(resources).updateFacts(captured.capture()); verify(resources, never()).insert(any());
        assertEquals("stable-id", captured.getValue().id()); assertEquals(99L, captured.getValue().size());
        assertEquals("UNIDENTIFIED", captured.getValue().recognitionStatus());
        var order = inOrder(transactions, tasks, resources);
        order.verify(transactions).getTransaction(any()); order.verify(tasks).start("task");
        order.verify(transactions).commit(transactionStatus); order.verify(transactions).getTransaction(any());
        order.verify(tasks).lockStatus("task"); order.verify(resources).lockByPathHash(eq("source"), any());
        order.verify(resources).updateFacts(any()); order.verify(tasks).progress("task", 1, 1, 1);
        order.verify(transactions).commit(transactionStatus);
    }

    @Test void failedSubdirectoryKeepsAlreadyPersistedFactsAndOnlyStoresFixedSafeErrorText() {
        directory("/a", entry("/a/Movie.mp4", "file", 99L, null), entry("/a/sub", "directory", null, null));
        when(adapter.scanDirectory(eq(connection), eq("/a/sub"), anyLong()))
                .thenThrow(new ApiException(422, "SOURCE_AUTH_FAILED", "https://secret:credential@fixture.invalid/private-body"));
        runner.scan("task", source, List.of("/a"));
        verify(resources).insert(any());
        verify(tasks).finish("task", "FAILED", 1, 1, 1, "SOURCE_AUTH_FAILED", "来源认证失败或无权访问目录，请检查账号和密码。");
        verify(transactions, times(4)).commit(transactionStatus);
    }

    @Test void unknownFailureNeverLeaksExceptionMessageToTask() {
        when(adapter.scanDirectory(eq(connection), eq("/a"), anyLong())).thenThrow(new IllegalStateException("fixture-secret"));
        runner.scan("task", source, List.of("/a"));
        verify(tasks).finish("task", "FAILED", 0, 0, 0, "SCAN_FAILED", "扫描失败，请稍后重试。");
        verifyNoInteractions(resources);
    }

    @Test void pathCollisionRollsBackAndCannotOverwriteDifferentFile() {
        directory("/a", entry("/a/Movie.mp4", "file", 99L, null));
        when(resources.lockByPathHash(eq("source"), any())).thenReturn(new MediaResourceRow("other", "source", "/a/different.mp4",
                MediaScanService.hash("/a/Movie.mp4"), "different.mp4", 1L, null, "UNIDENTIFIED"));
        runner.scan("task", source, List.of("/a"));
        verify(resources, never()).insert(any()); verify(resources, never()).updateFacts(any());
        verify(transactions).rollback(transactionStatus);
        verify(tasks).finish("task", "FAILED", 1, 0, 1, "SCAN_PATH_COLLISION", "资源路径校验失败，扫描已停止。");
    }

    @Test void progressFailureRollsBackFileFactsAndDoesNotCountResourceAsPersisted() {
        directory("/a", entry("/a/Movie.mp4", "file", 99L, null));
        doThrow(new IllegalStateException("fixture persistence failure")).when(tasks).progress("task", 1, 1, 1);
        runner.scan("task", source, List.of("/a"));
        verify(resources).insert(any());
        verify(transactions).rollback(transactionStatus);
        verify(transactions, times(2)).commit(transactionStatus);
        verify(tasks).finish("task", "FAILED", 1, 0, 1, "SCAN_FAILED", "扫描失败，请稍后重试。");
    }

    @Test void terminalTaskCannotWriteResourcesAndCannotBeRestartedByOldWorker() {
        directory("/a", entry("/a/Movie.mp4", "file", 99L, null));
        when(tasks.lockStatus("task")).thenReturn("FAILED");
        runner.scan("task", source, List.of("/a"));
        verifyNoInteractions(resources); verify(transactions).rollback(transactionStatus);
        verify(tasks).finish("task", "FAILED", 1, 0, 1, "SCAN_INTERRUPTED", "服务重启或关闭，扫描已中断，请重新发起。");
        reset(adapter);
        when(tasks.start("terminal")).thenReturn(0);
        runner.scan("terminal", source, List.of("/a"));
        verifyNoInteractions(adapter);
    }

    @Test void directoryAndResourceAndEntryBudgetsStopBoundedlyWithPartialCounts() {
        var narrow = runner(new MediaScanLimits(1, 1, 1, 1, 1, 1, 30));
        directory("/a", entry("/a/sub", "directory", null, null));
        narrow.scan("directories", source, List.of("/a"));
        verify(tasks).finish("directories", "FAILED", 0, 0, 1, "SCAN_LIMIT_EXCEEDED", "扫描超出遍历上限，请缩小范围后重试。");
        directory("/a", entry("/a/A.mp4", "file", null, null), entry("/a/B.mp4", "file", null, null));
        narrow.scan("entries", source, List.of("/a"));
        verify(tasks).finish("entries", "FAILED", 1, 1, 1, "SCAN_LIMIT_EXCEEDED", "扫描超出遍历上限，请缩小范围后重试。");
        var resourcesLimited = runner(new MediaScanLimits(1, 1, 2, 1, 100, 1, 30));
        resourcesLimited.scan("resources", source, List.of("/a"));
        verify(tasks).finish("resources", "FAILED", 1, 1, 1, "SCAN_LIMIT_EXCEEDED", "扫描超出遍历上限，请缩小范围后重试。");
    }

    @Test void depthBudgetAndEscapingOrRepeatedEntryAreRejected() {
        var shallow = runner(new MediaScanLimits(1, 1, 10, 10, 100, 1, 30));
        directory("/a", entry("/a/sub", "directory", null, null));
        directory("/a/sub", entry("/a/sub/deep", "directory", null, null));
        shallow.scan("deep", source, List.of("/a"));
        verify(tasks).finish("deep", "FAILED", 0, 0, 2, "SCAN_LIMIT_EXCEEDED", "扫描超出遍历上限，请缩小范围后重试。");
        directory("/a", entry("/outside/Movie.mp4", "file", null, null));
        runner.scan("escape", source, List.of("/a"));
        verify(tasks).finish("escape", "FAILED", 0, 0, 1, "SOURCE_DIRECTORY_INVALID", "来源未返回有效、完整的目录，扫描已停止。");
        directory("/a", entry("/a/same.txt", "file", null, null), entry("/a/same.txt", "file", null, null));
        runner.scan("duplicate", source, List.of("/a"));
        verify(tasks).finish("duplicate", "FAILED", 0, 0, 1, "SOURCE_DIRECTORY_INVALID", "来源未返回有效、完整的目录，扫描已停止。");
        verifyNoInteractions(resources);
    }

    @Test void optionalModificationTimeOutsideMysqlRangeIsIgnoredInsteadOfFailingScan() {
        directory("/a", entry("/a/Ancient.mp4", "file", 1L, Instant.parse("0999-01-01T00:00:00Z")),
                entry("/a/Future.mp4", "file", 2L, Instant.parse("+10000-01-01T00:00:00Z")));
        runner.scan("task", source, List.of("/a"));
        var captured = ArgumentCaptor.forClass(MediaResourceRow.class);
        verify(resources, times(2)).insert(captured.capture());
        assertTrue(captured.getAllValues().stream().allMatch(row -> row.modifiedAt() == null));
        verify(tasks).finish("task", "COMPLETED", 2, 2, 1, null, null);
    }

    @Test void overallDeadlineIncludesTimeAfterAdapterReturnsAndPreventsPersistence() {
        var shortBudget = runner(new MediaScanLimits(1, 1, 10, 10, 100, 1, 1));
        when(adapter.scanDirectory(eq(connection), eq("/a"), anyLong())).thenAnswer(invocation -> {
            Thread.sleep(1100);
            return new MediaFileDirectory("/a", List.of(entry("/a/Movie.mp4", "file", null, null)));
        });
        shortBudget.scan("task", source, List.of("/a"));
        verify(tasks).finish("task", "FAILED", 0, 0, 0, "SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。");
        verifyNoInteractions(resources);
    }

    @Test void resourceTransactionAcquisitionDelayCannotStartDatabaseWorkAfterDeadline() {
        directory("/a", entry("/a/Movie.mp4", "file", null, null));
        when(transactions.getTransaction(any())).thenReturn(transactionStatus).thenAnswer(invocation -> {
            expireBudget();
            return transactionStatus;
        }).thenReturn(transactionStatus);
        runner(new MediaScanLimits(1, 1, 10, 10, 100, 1, 1)).scan("task", source, List.of("/a"));
        verify(tasks, never()).lockStatus(anyString());
        verifyNoInteractions(resources);
        verify(transactions).rollback(transactionStatus);
        verify(transactions, times(2)).commit(transactionStatus);
        verify(tasks).finish("task", "FAILED", 1, 0, 1, "SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。");
    }

    @ParameterizedTest
    @ValueSource(strings = {"transaction", "statement"})
    void startWaitConsumesTheScanBudgetBeforeReadingTheSource(String stage) {
        if (stage.equals("transaction")) {
            when(transactions.getTransaction(any())).thenAnswer(invocation -> { expireBudget(); return transactionStatus; })
                    .thenReturn(transactionStatus);
        } else {
            when(tasks.start("task")).thenAnswer(invocation -> { expireBudget(); return 1; });
        }
        runner(new MediaScanLimits(1, 1, 10, 10, 100, 1, 1)).scan("task", source, List.of("/a"));
        verifyNoInteractions(adapter, resources);
        if (stage.equals("transaction")) verify(tasks, never()).start(anyString());
        verify(transactions).rollback(transactionStatus);
        verify(transactions).commit(transactionStatus);
        verify(tasks).finish("task", "FAILED", 0, 0, 0, "SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。");
    }

    @Test void failureStatusHasAnIndependentFiniteCleanupBudgetAndCanRemainForRecovery() {
        var timeouts = new ArrayList<Integer>();
        when(transactions.getTransaction(any())).thenAnswer(invocation -> {
            timeouts.add(((TransactionDefinition) invocation.getArgument(0)).getTimeout());
            return transactionStatus;
        });
        when(adapter.scanDirectory(eq(connection), eq("/a"), anyLong())).thenThrow(new IllegalStateException("fixture failure"));
        doAnswer(invocation -> { expireBudget(); return null; })
                .when(tasks).finish("task", "FAILED", 0, 0, 0, "SCAN_FAILED", "扫描失败，请稍后重试。");
        runner.scan("task", source, List.of("/a"));
        assertEquals(List.of(30, 1), timeouts);
        verify(transactions).commit(transactionStatus);
        verify(transactions).rollback(transactionStatus);
        verify(tasks).finish("task", "FAILED", 0, 0, 0, "SCAN_FAILED", "扫描失败，请稍后重试。");
        verifyNoInteractions(resources);
        runner.recoverInterrupted();
        verify(tasks).failInterrupted();
    }

    @ParameterizedTest
    @ValueSource(strings = {"task-lock", "resource-lock", "insert", "update", "progress"})
    void databaseWaitThatCrossesDeadlineRollsBackWithoutCountingTheResource(String stage) {
        directory("/a", entry("/a/Movie.mp4", "file", 99L, null));
        var existing = new MediaResourceRow("stable-id", "source", "/a/Movie.mp4", MediaScanService.hash("/a/Movie.mp4"),
                "Movie.mp4", 1L, null, "UNIDENTIFIED");
        switch (stage) {
            case "task-lock" -> when(tasks.lockStatus("task")).thenAnswer(invocation -> { expireBudget(); return "RUNNING"; });
            case "resource-lock" -> when(resources.lockByPathHash(eq("source"), any()))
                    .thenAnswer(invocation -> { expireBudget(); return existing; });
            case "insert" -> doAnswer(invocation -> { expireBudget(); return null; }).when(resources).insert(any());
            case "update" -> {
                when(resources.lockByPathHash(eq("source"), any())).thenReturn(existing);
                when(resources.updateFacts(any())).thenAnswer(invocation -> { expireBudget(); return 1; });
            }
            case "progress" -> doAnswer(invocation -> { expireBudget(); return null; })
                    .when(tasks).progress("task", 1, 1, 1);
            default -> fail("Unexpected stage");
        }
        runner(new MediaScanLimits(1, 1, 10, 10, 100, 1, 1)).scan("task", source, List.of("/a"));
        if (stage.equals("task-lock")) verifyNoInteractions(resources);
        if (stage.equals("resource-lock")) {
            verify(resources, never()).insert(any());
            verify(resources, never()).updateFacts(any());
        }
        if (!stage.equals("progress")) verify(tasks, never()).progress(anyString(), anyInt(), anyInt(), anyInt());
        verify(transactions).rollback(transactionStatus);
        verify(transactions, times(2)).commit(transactionStatus);
        verify(tasks).finish("task", "FAILED", 1, 0, 1, "SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。");
    }

    @Test void deadlineExpiredBetweenCallbackAndBeforeCommitRollsBack() throws Exception {
        var dataSource = mock(DataSource.class);
        var jdbcConnection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(jdbcConnection);
        when(jdbcConnection.getAutoCommit()).thenReturn(true);
        var transactionNumber = new AtomicInteger();
        var delayedCommit = new DataSourceTransactionManager(dataSource) {
            @Override protected void prepareForCommit(DefaultTransactionStatus status) {
                if (transactionNumber.incrementAndGet() == 2) expireBudget();
            }
        };
        var shortBudget = new MediaScanRunner(tasks, resources, encryption, adapter,
                new MediaScanLimits(1, 1, 10, 10, 100, 1, 1), delayedCommit);
        runners.add(shortBudget);
        directory("/a", entry("/a/Movie.mp4", "file", null, null));
        shortBudget.scan("task", source, List.of("/a"));
        verify(resources).insert(any());
        verify(tasks).progress("task", 1, 1, 1);
        verify(jdbcConnection).rollback();
        verify(jdbcConnection, times(2)).commit();
        verify(tasks).finish("task", "FAILED", 1, 0, 1, "SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。");
    }

    @ParameterizedTest
    @ValueSource(strings = {"transaction", "statement", "driver"})
    void databaseTimeoutsHaveAStableScanTimeoutCode(String type) {
        directory("/a", entry("/a/Movie.mp4", "file", null, null));
        RuntimeException error = switch (type) {
            case "transaction" -> new TransactionTimedOutException("fixture transaction timeout");
            case "statement" -> new QueryTimeoutException("fixture statement timeout");
            case "driver" -> new IllegalStateException(new SQLTimeoutException("fixture driver timeout"));
            default -> throw new IllegalArgumentException(type);
        };
        when(resources.lockByPathHash(eq("source"), any())).thenThrow(error);
        runner.scan("task", source, List.of("/a"));
        verify(resources, never()).insert(any());
        verify(transactions).rollback(transactionStatus);
        verify(tasks).finish("task", "FAILED", 1, 0, 1, "SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。");
    }

    @Test void eachTransactionUsesItsOwnRemainingScanBudget() {
        var timeouts = new ArrayList<Integer>();
        when(transactions.getTransaction(any())).thenAnswer(invocation -> {
            timeouts.add(((TransactionDefinition) invocation.getArgument(0)).getTimeout());
            return transactionStatus;
        });
        when(adapter.scanDirectory(eq(connection), eq("/a"), anyLong())).thenAnswer(invocation -> {
            Thread.sleep(1500);
            return new MediaFileDirectory("/a", List.of(entry("/a/Movie.mp4", "file", null, null)));
        });
        runner(new MediaScanLimits(1, 1, 10, 10, 100, 1, 4)).scan("task", source, List.of("/a"));
        var definitions = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(transactions, times(4)).getTransaction(definitions.capture());
        assertEquals(List.of(4, 3, 3, 3), timeouts);
        assertNotSame(definitions.getAllValues().get(0), definitions.getAllValues().get(1));
        assertNotSame(definitions.getAllValues().get(1), definitions.getAllValues().get(2));
        verify(tasks).finish("task", "COMPLETED", 1, 1, 1, null, null);
    }

    @Test void springAppliesTheReducedBudgetAfterConnectionAcquisition() throws Exception {
        var dataSource = mock(DataSource.class);
        var jdbcConnection = mock(Connection.class);
        when(dataSource.getConnection()).thenAnswer(invocation -> { expireBudget(); return jdbcConnection; })
                .thenReturn(jdbcConnection);
        when(jdbcConnection.getAutoCommit()).thenReturn(true);
        var initialTimeouts = new ArrayList<Integer>();
        var appliedTimeouts = new ArrayList<Integer>();
        var transactionManager = new DataSourceTransactionManager(dataSource) {
            @Override protected void doBegin(Object transaction, TransactionDefinition definition) {
                initialTimeouts.add(definition.getTimeout());
                super.doBegin(transaction, definition);
            }
            @Override protected int determineTimeout(TransactionDefinition definition) {
                int timeout = super.determineTimeout(definition);
                appliedTimeouts.add(timeout);
                return timeout;
            }
        };
        var shortBudget = new MediaScanRunner(tasks, resources, encryption, adapter,
                new MediaScanLimits(1, 1, 10, 10, 100, 1, 3), transactionManager);
        runners.add(shortBudget);
        directory("/a");
        shortBudget.scan("task", source, List.of("/a"));
        assertEquals(3, initialTimeouts.getFirst());
        assertEquals(List.of(2, 2, 2), appliedTimeouts);
        verify(jdbcConnection, times(3)).commit();
        verify(jdbcConnection, never()).rollback();
        verify(tasks).finish("task", "COMPLETED", 0, 0, 1, null, null);
    }

    @Test void deadlineFailureRetainsResourcesCommittedByEarlierTransactions() {
        directory("/a", entry("/a/First.mp4", "file", null, null), entry("/a/Second.mp4", "file", null, null));
        when(tasks.lockStatus("task")).thenReturn("RUNNING").thenAnswer(invocation -> { expireBudget(); return "RUNNING"; });
        runner(new MediaScanLimits(1, 1, 10, 10, 100, 1, 1)).scan("task", source, List.of("/a"));
        var saved = ArgumentCaptor.forClass(MediaResourceRow.class);
        verify(resources).insert(saved.capture());
        assertEquals("/a/First.mp4", saved.getValue().path());
        verify(transactions, times(3)).commit(transactionStatus);
        verify(transactions).rollback(transactionStatus);
        verify(tasks).finish("task", "FAILED", 2, 1, 1, "SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。");
    }

    @Test void directoryProgressThatCrossesDeadlineRollsBack() {
        directory("/a");
        doAnswer(invocation -> { expireBudget(); return null; }).when(tasks).progress("task", 0, 0, 1);
        runner(new MediaScanLimits(1, 1, 10, 10, 100, 1, 1)).scan("task", source, List.of("/a"));
        verifyNoInteractions(resources);
        verify(transactions).rollback(transactionStatus);
        verify(transactions, times(2)).commit(transactionStatus);
        verify(tasks).finish("task", "FAILED", 0, 0, 1, "SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。");
    }

    @Test void completionThatCrossesDeadlineRollsBackBeforeSavingFailure() {
        directory("/a");
        doAnswer(invocation -> { expireBudget(); return null; })
                .when(tasks).finish("task", "COMPLETED", 0, 0, 1, null, null);
        runner(new MediaScanLimits(1, 1, 10, 10, 100, 1, 1)).scan("task", source, List.of("/a"));
        verifyNoInteractions(resources);
        var order = inOrder(transactions, tasks);
        order.verify(tasks).start("task");
        order.verify(transactions).commit(transactionStatus);
        order.verify(tasks).progress("task", 0, 0, 1);
        order.verify(transactions).commit(transactionStatus);
        order.verify(tasks).finish("task", "COMPLETED", 0, 0, 1, null, null);
        order.verify(transactions).rollback(transactionStatus);
        order.verify(tasks).finish("task", "FAILED", 0, 0, 1, "SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。");
    }

    @Test void realHttpTimeoutPersistsTheErrorForTheBudgetThatExpiresFirst() throws Exception {
        for (boolean overallDeadline : List.of(true, false)) {
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            var httpExecutor = Executors.newVirtualThreadPerTaskExecutor();
            server.setExecutor(httpExecutor);
            server.createContext("/", exchange -> {
                try (exchange) {
                    exchange.getRequestBody().readAllBytes();
                    exchange.sendResponseHeaders(207, 0);
                    exchange.getResponseBody().write("<d:".getBytes(StandardCharsets.UTF_8));
                    exchange.getResponseBody().flush();
                    try { Thread.sleep(1500); }
                    catch (InterruptedException error) { Thread.currentThread().interrupt(); }
                }
            });
            server.start();
            try {
                var httpConnection = new SourceConnection("http://127.0.0.1:" + server.getAddress().getPort() + "/dav/", "", "");
                var httpSource = new MediaSourceRow("source", "alice", "来源", "WEBDAV",
                        encryption.encrypt(httpConnection, "alice", "source"), true, null, source.createdAt());
                var httpRunner = new MediaScanRunner(tasks, resources, encryption,
                        new WebDavMediaSourceAdapter(overallDeadline ? 2000 : 100),
                        new MediaScanLimits(1, 1, 10, 10, 100, 4, overallDeadline ? 1 : 30), transactions);
                runners.add(httpRunner);
                String taskId = overallDeadline ? "overall-deadline" : "connection-timeout";
                httpRunner.scan(taskId, httpSource, List.of("/a"));
                verify(tasks).finish(taskId, "FAILED", 0, 0, 0,
                        overallDeadline ? "SCAN_TIMEOUT" : "SOURCE_CONNECTION_TIMEOUT",
                        overallDeadline ? "扫描超过整体时间上限，请缩小范围后重试。" : "来源连接超时，请检查网络后重试。");
            } finally {
                server.stop(0);
                httpExecutor.shutdownNow();
            }
        }
        verifyNoInteractions(resources);
    }

    @Test void executorQueueIsBoundedAndDoesNotRunRejectedWork() throws Exception {
        var started = new CountDownLatch(1); var release = new CountDownLatch(1);
        when(adapter.scanDirectory(eq(connection), eq("/a"), anyLong())).thenAnswer(invocation -> {
            started.countDown();
            try { assertTrue(release.await(3, TimeUnit.SECONDS)); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); }
            return new MediaFileDirectory("/a", List.of());
        });
        assertTrue(runner.submit("first", source, List.of("/a")));
        assertTrue(started.await(3, TimeUnit.SECONDS));
        assertTrue(runner.submit("queued", source, List.of("/a")));
        assertFalse(runner.submit("rejected", source, List.of("/a")));
        release.countDown();
        runner.close();
        verify(tasks, never()).start("rejected");
    }

    @Test void startupRecoversUnfinishedTasks() {
        runner.recoverInterrupted();
        verify(tasks).failInterrupted();
    }

    private MediaScanRunner runner(MediaScanLimits limits) {
        var result = new MediaScanRunner(tasks, resources, encryption, adapter, limits, transactions);
        runners.add(result); return result;
    }
    private static void expireBudget() {
        try { Thread.sleep(1100); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); }
    }
    private void directory(String path, MediaFileDirectory.Entry... entries) {
        when(adapter.scanDirectory(eq(connection), eq(path), anyLong())).thenReturn(new MediaFileDirectory(path, List.of(entries)));
    }
    private MediaFileDirectory.Entry entry(String path, String kind, Long size, Instant modifiedAt) {
        return new MediaFileDirectory.Entry(path.substring(path.lastIndexOf('/') + 1), path, kind, size, modifiedAt);
    }
}
