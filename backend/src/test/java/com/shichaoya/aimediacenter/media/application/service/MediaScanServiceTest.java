package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaResourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaResourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanRootMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanRootRow;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanTaskMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanTaskRow;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.TransactionDefinition;
import tools.jackson.databind.json.JsonMapper;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MediaScanServiceTest {
    private final MediaSourceMapper sources = mock(MediaSourceMapper.class);
    private final MediaScanRootMapper roots = mock(MediaScanRootMapper.class);
    private final MediaScanTaskMapper tasks = mock(MediaScanTaskMapper.class);
    private final MediaResourceMapper resources = mock(MediaResourceMapper.class);
    private final MediaScanRunner runner = mock(MediaScanRunner.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final TransactionStatus transactionStatus = mock(TransactionStatus.class);
    private final MediaScanService service = new MediaScanService(sources, roots, tasks, resources, runner,
            JsonMapper.builder().build(), transactions);
    private final CurrentUser alice = new CurrentUser("alice", "alice", "USER");
    private final MediaSourceRow source = new MediaSourceRow("source", "alice", "来源", "WEBDAV", new byte[]{1},
            true, null, LocalDateTime.of(2026, 10, 3, 0, 0));

    @BeforeEach void setup() { when(transactions.getTransaction(any())).thenReturn(transactionStatus); }

    @Test void missingAndForeignSourcesDoNotReadTasksRootsResourcesOrSubmitNetworkWorkEvenForAdmin() {
        for (var user : List.of(alice, new CurrentUser("admin", "admin", "ADMIN"))) {
            assertEquals("SOURCE_NOT_FOUND", assertThrows(ApiException.class, () -> service.start(user, "foreign")).code());
            assertEquals("SOURCE_NOT_FOUND", assertThrows(ApiException.class, () -> service.list(user, "foreign")).code());
            assertEquals("SOURCE_NOT_FOUND", assertThrows(ApiException.class, () -> service.resources(user, "foreign", 0, 50)).code());
        }
        verifyNoInteractions(tasks, roots, resources, runner);
    }

    @Test void rejectsDisabledSourceBeforeInspectingAnyConfigurationOrCreatingTask() {
        when(sources.lockOwned("alice", "source")).thenReturn(new MediaSourceRow(source.id(), source.userId(), source.name(),
                source.sourceType(), source.connectionConfigCiphertext(), false, null, source.createdAt()));
        assertEquals("SOURCE_DISABLED", assertThrows(ApiException.class, () -> service.start(alice, "source")).code());
        verify(transactions).rollback(transactionStatus);
        verifyNoInteractions(tasks, roots, resources, runner);
    }

    @Test void activeTaskIsReturnedIdempotentlyWithoutReadingCurrentRootsOrEnqueueingAgain() {
        when(sources.lockOwned("alice", "source")).thenReturn(source);
        var active = task("RUNNING", "[\"/frozen\"]");
        when(tasks.findActive("source")).thenReturn(active);
        var result = service.start(alice, "source");
        assertEquals("task", result.id()); assertEquals("running", result.status());
        assertEquals(List.of("/frozen"), result.rootPaths());
        verify(transactions).commit(transactionStatus);
        verifyNoInteractions(roots, resources, runner); verify(tasks, never()).insert(any());
    }

    @Test void requiresEnabledRootsAndDefensivelyChecksDisabledRootsTooBeforePersisting() {
        when(sources.lockOwned("alice", "source")).thenReturn(source);
        for (var rows : List.of(List.<MediaScanRootRow>of(), List.of(root("/off", false)))) {
            when(roots.findBySource("source")).thenReturn(rows);
            assertEquals("SCAN_ROOTS_REQUIRED", assertThrows(ApiException.class, () -> service.start(alice, "source")).code());
        }
        for (var rows : List.of(List.of(root("/a", true), root("/a/b", false)), List.of(root("/a/", true)),
                List.of(new MediaScanRootRow("root", "foreign", "/a", MediaScanService.hash("/a"), true)),
                List.of(new MediaScanRootRow("root", "source", "/a", new byte[32], false)),
                List.of(root("/../escape", true)))) {
            when(roots.findBySource("source")).thenReturn(rows);
            assertEquals("SCAN_ROOTS_INVALID", assertThrows(ApiException.class, () -> service.start(alice, "source")).code());
        }
        verify(tasks, never()).insert(any()); verifyNoInteractions(runner, resources);
    }

    @Test void freezesSortedEnabledRootsInUuidV7TaskAndCommitsBeforeSubmitting() {
        when(sources.lockOwned("alice", "source")).thenReturn(source);
        when(roots.findBySource("source")).thenReturn(List.of(root("/z", true), root("/disabled", false), root("/电影", true)));
        when(runner.submit(anyString(), eq(source), anyList())).thenReturn(true);
        var result = service.start(alice, "source");
        assertEquals(7, UUID.fromString(result.id()).version());
        assertEquals("pending", result.status()); assertEquals(List.of("/z", "/电影"), result.rootPaths());
        assertEquals(0, result.persistedCount()); assertNull(result.errorCode()); assertNull(result.startedAt());
        var captured = ArgumentCaptor.forClass(MediaScanTaskRow.class);
        var order = inOrder(transactions, sources, tasks, roots, runner);
        order.verify(transactions).getTransaction(any()); order.verify(sources).lockOwned("alice", "source");
        order.verify(tasks).findActive("source"); order.verify(roots).findBySource("source");
        order.verify(tasks).insert(captured.capture()); order.verify(transactions).commit(transactionStatus);
        order.verify(runner).submit(result.id(), source, List.of("/z", "/电影"));
        assertEquals("[\"/z\",\"/电影\"]", captured.getValue().rootPathsJson());
        assertEquals(captured.getValue().createdAt().toInstant(ZoneOffset.UTC), result.createdAt());
    }

    @Test void fullQueueCreatesDurableFailedHistoryAndReturnsExplicitBusyResponse() {
        when(sources.lockOwned("alice", "source")).thenReturn(source);
        when(roots.findBySource("source")).thenReturn(List.of(root("/a", true)));
        var error = assertThrows(ApiException.class, () -> service.start(alice, "source"));
        assertEquals(503, error.status()); assertEquals("SCAN_QUEUE_FULL", error.code());
        var captured = ArgumentCaptor.forClass(MediaScanTaskRow.class);
        verify(tasks).insert(captured.capture());
        verify(transactions).commit(transactionStatus);
        verify(tasks).finish(captured.getValue().id(), "FAILED", 0, 0, 0, "SCAN_QUEUE_FULL", "扫描队列已满，请稍后重试。");
    }

    @Test void persistenceFailureRollsBackAndNeverEnqueuesTask() {
        when(sources.lockOwned("alice", "source")).thenReturn(source);
        when(roots.findBySource("source")).thenReturn(List.of(root("/a", true)));
        doThrow(new IllegalStateException("fixture")).when(tasks).insert(any());
        assertThrows(IllegalStateException.class, () -> service.start(alice, "source"));
        verify(transactions).rollback(transactionStatus); verifyNoInteractions(runner);
    }

    @Test void historyAndResourcePageUseOwnerFilteredQueriesAndUtcHttpProjection() {
        when(sources.findOwned("alice", "source")).thenReturn(source);
        when(tasks.findOwnedRecent("alice", "source")).thenReturn(List.of(task("COMPLETED", "[\"/a\"]")));
        assertEquals("completed", service.list(alice, "source").getFirst().status());
        when(resources.countOwned("alice", "source")).thenReturn(100L);
        var modifiedAt = LocalDateTime.of(2026, 10, 2, 1, 2, 3);
        when(resources.findOwnedPage("alice", "source", 30, 60)).thenReturn(List.of(new MediaResourceRow("resource", "source",
                "/a/A.MKV", MediaScanService.hash("/a/A.MKV"), "A.MKV", 1024L, modifiedAt, "UNIDENTIFIED")));
        var result = service.resources(alice, "source", 2, 30);
        assertEquals(100, result.total()); assertEquals(2, result.page()); assertEquals(30, result.pageSize());
        assertEquals("unidentified", result.items().getFirst().recognitionStatus());
        assertEquals("A", result.items().getFirst().nameCandidate().title());
        assertNull(result.items().getFirst().nameCandidate().year());
        assertEquals(modifiedAt.toInstant(ZoneOffset.UTC), result.items().getFirst().modifiedAt());
        var queryDefinition = ArgumentCaptor.forClass(TransactionDefinition.class);
        verify(transactions).getTransaction(queryDefinition.capture());
        assertTrue(queryDefinition.getValue().isReadOnly());
        assertEquals(TransactionDefinition.ISOLATION_REPEATABLE_READ, queryDefinition.getValue().getIsolationLevel());
        var order = inOrder(transactions, resources);
        order.verify(transactions).getTransaction(any());
        order.verify(resources).countOwned("alice", "source");
        order.verify(resources).findOwnedPage("alice", "source", 30, 60);
        order.verify(transactions).commit(transactionStatus);
        verifyNoInteractions(roots, runner);
    }

    @Test void derivesNameCandidatesFromDecodedFactsWithoutWritingResourcesOrAccessingUpstream() {
        when(sources.findOwned("alice", "source")).thenReturn(source);
        when(resources.countOwned("alice", "source")).thenReturn(3L);
        String nested = "/合集/银翼杀手.1982.Final.Cut/video.mkv";
        String atRoot = "/1917.2019.1080p.mkv";
        String uncutName = "Example.Saga.Sequel.Uncut.2004.2160p.BluRay.REMUX.mkv";
        String uncutPath = "/某系列2/" + uncutName;
        when(resources.findOwnedPage("alice", "source", 50, 0)).thenReturn(List.of(
                new MediaResourceRow("first", "source", nested, MediaScanService.hash(nested), "video.mkv", null, null, "UNIDENTIFIED"),
                new MediaResourceRow("second", "source", atRoot, MediaScanService.hash(atRoot), "1917.2019.1080p.mkv", 1024L, null, "UNIDENTIFIED"),
                new MediaResourceRow("third", "source", uncutPath, MediaScanService.hash(uncutPath), uncutName, null, null, "UNIDENTIFIED")));
        var items = service.resources(alice, "source", 0, 50).items();
        assertEquals("银翼杀手", items.getFirst().nameCandidate().title());
        assertEquals(1982, items.getFirst().nameCandidate().year());
        assertEquals("Final Cut", items.getFirst().nameCandidate().editionLabel());
        assertEquals(nested, items.getFirst().path()); assertEquals("video.mkv", items.getFirst().name());
        assertNull(items.getFirst().size()); assertNull(items.getFirst().modifiedAt());
        assertEquals("1917", items.get(1).nameCandidate().title());
        assertEquals(2019, items.get(1).nameCandidate().year());
        assertEquals("Example Saga Sequel", items.getLast().nameCandidate().title());
        assertEquals(2004, items.getLast().nameCandidate().year());
        assertEquals("Uncut", items.getLast().nameCandidate().editionLabel());
        assertEquals(uncutName, items.getLast().name()); assertEquals(uncutPath, items.getLast().path());
        assertEquals("unidentified", items.getLast().recognitionStatus());
        verify(resources).countOwned("alice", "source");
        verify(resources).findOwnedPage("alice", "source", 50, 0);
        verifyNoMoreInteractions(resources); verifyNoInteractions(tasks, roots, runner);
    }

    @Test void invalidPaginationCannotReachResourceQueries() {
        when(sources.findOwned("alice", "source")).thenReturn(source);
        for (int[] input : List.of(new int[]{-1, 50}, new int[]{0, 0}, new int[]{0, 101})) {
            assertEquals("VALIDATION_FAILED", assertThrows(ApiException.class,
                    () -> service.resources(alice, "source", input[0], input[1])).code());
        }
        verifyNoInteractions(resources);
    }

    private MediaScanRootRow root(String path, boolean enabled) {
        return new MediaScanRootRow("root", "source", path, MediaScanService.hash(path), enabled);
    }
    private MediaScanTaskRow task(String status, String rootsJson) {
        return new MediaScanTaskRow("task", "source", status, rootsJson, 3, 3, 2, null, null, source.createdAt(), source.createdAt(),
                status.equals("COMPLETED") ? source.createdAt() : null);
    }
}
