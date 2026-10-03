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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import tools.jackson.databind.json.JsonMapper;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
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
        order.verify(tasks).start("task"); order.verify(transactions).getTransaction(any());
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
        verify(transactions).commit(transactionStatus);
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
        verify(transactions, never()).commit(transactionStatus);
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
    private void directory(String path, MediaFileDirectory.Entry... entries) {
        when(adapter.scanDirectory(eq(connection), eq(path), anyLong())).thenReturn(new MediaFileDirectory(path, List.of(entries)));
    }
    private MediaFileDirectory.Entry entry(String path, String kind, Long size, Instant modifiedAt) {
        return new MediaFileDirectory.Entry(path.substring(path.lastIndexOf('/') + 1), path, kind, size, modifiedAt);
    }
}
