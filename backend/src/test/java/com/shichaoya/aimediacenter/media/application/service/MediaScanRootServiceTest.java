package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.application.port.MediaSourceAdapter;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanRootMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanRootRow;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.security.SourceConnectionEncryption;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import tools.jackson.databind.json.JsonMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MediaScanRootServiceTest {
    private final MediaSourceMapper sources = mock(MediaSourceMapper.class);
    private final MediaScanRootMapper roots = mock(MediaScanRootMapper.class);
    private final MediaSourceAdapter adapter = mock(MediaSourceAdapter.class);
    private final PlatformTransactionManager transactions = mock(PlatformTransactionManager.class);
    private final TransactionStatus status = mock(TransactionStatus.class);
    private final SourceConnectionEncryption encryption = new SourceConnectionEncryption(Base64.getEncoder().encodeToString(new byte[32]), JsonMapper.builder().build());
    private final MediaScanRootService service = new MediaScanRootService(sources, roots, encryption, adapter, transactions);
    private final CurrentUser alice = new CurrentUser("alice", "alice", "USER");
    private final SourceConnection connection = new SourceConnection("http://localhost/dav/", "fixture-user", "fixture-password");
    private MediaSourceRow source;
    @BeforeEach void setup() {
        source = new MediaSourceRow("source", "alice", "来源", "WEBDAV", encryption.encrypt(connection, "alice", "source"), false, null, LocalDateTime.of(2026, 10, 2, 0, 0));
        when(transactions.getTransaction(any())).thenReturn(status);
    }
    @Test void missingAndForeignSourcesFailBeforeRootAccessDecryptionOrValidationForUserAndAdmin() {
        for (var user : List.of(alice, new CurrentUser("admin", "admin", "ADMIN"))) {
            assertEquals("SOURCE_NOT_FOUND", assertThrows(ApiException.class, () -> service.list(user, "foreign")).code());
            assertEquals("SOURCE_NOT_FOUND", assertThrows(ApiException.class, () -> service.replace(user, "foreign", List.of("/../invalid"))).code());
        }
        verifyNoInteractions(roots, adapter, transactions);
    }
    @Test void rejectsNormalizedDuplicatesAndBoundaryOverlapRegardlessOfRootStateWithoutNetworkOrTransaction() {
        when(sources.findOwned("alice", "source")).thenReturn(source);
        for (var paths : List.of(List.of("/电影", "/电影/"), List.of("/a//b", "/a/b"), List.of("/", "/a"),
                List.of("/a/b", "/a"), List.of("/a", "/a/b/c"), List.of("/../escape"), IntStream.range(0, 33).mapToObj(i -> "/" + i).toList())) {
            var error = assertThrows(ApiException.class, () -> service.replace(alice, "source", paths));
            assertEquals(400, error.status()); assertEquals("VALIDATION_FAILED", error.code()); assertTrue(error.fieldErrors().containsKey("paths"));
        }
        verifyNoInteractions(roots, adapter, transactions);
    }
    @Test void validatesAllPathsBeforeLockThenPreservesIdsAndDisabledRootsAddsUuidV7AndDeletesUnselected() throws Exception {
        when(sources.findOwned("alice", "source")).thenReturn(source);
        when(sources.lockOwned("alice", "source")).thenReturn(source);
        var retained = root("retained", "/a", false); var removed = root("removed", "/old", true);
        when(roots.findBySource("source")).thenReturn(List.of(removed, retained));
        var result = service.replace(alice, "source", List.of("/ab/", "/a/"));
        assertEquals(List.of("/a", "/ab"), result.stream().map(MediaScanRoot::path).toList());
        assertEquals(new MediaScanRoot("retained", "source", "/a", false), result.getFirst());
        assertTrue(result.getLast().enabled()); assertEquals(7, UUID.fromString(result.getLast().id()).version());
        var order = inOrder(sources, adapter, transactions, roots);
        order.verify(sources).findOwned("alice", "source");
        order.verify(adapter).validateDirectories(connection, List.of("/a", "/ab"));
        order.verify(transactions).getTransaction(any());
        order.verify(sources).lockOwned("alice", "source"); order.verify(roots).findBySource("source");
        order.verify(roots).delete("source", "removed"); order.verify(roots).insert(any()); order.verify(transactions).commit(status);
        order.verifyNoMoreInteractions();
    }
    @Test void emptySelectionClearsWithoutDecryptingOrContactingUpstream() throws Exception {
        when(sources.findOwned("alice", "source")).thenReturn(source);
        when(sources.lockOwned("alice", "source")).thenReturn(source);
        when(roots.findBySource("source")).thenReturn(List.of(root("old", "/a", false)));
        assertEquals(List.of(), service.replace(alice, "source", List.of()));
        verify(roots).delete("source", "old"); verify(transactions).commit(status); verifyNoInteractions(adapter);
    }
    @Test void upstreamFailureLeavesOldConfigurationAndDoesNotAcquireAnyTransaction() {
        when(sources.findOwned("alice", "source")).thenReturn(source);
        var failure = new ApiException(404, "SOURCE_DIRECTORY_NOT_FOUND", "fixture");
        doThrow(failure).when(adapter).validateDirectories(connection, List.of("/a", "/b"));
        assertSame(failure, assertThrows(ApiException.class, () -> service.replace(alice, "source", List.of("/b", "/a"))));
        verifyNoInteractions(roots, transactions); verify(sources, never()).lockOwned(any(), any());
    }
    @Test void sourceChangedOrDisappearedAfterValidationRollsBackWithoutTouchingRoots() {
        when(sources.findOwned("alice", "source")).thenReturn(source);
        assertEquals("SOURCE_NOT_FOUND", assertThrows(ApiException.class, () -> service.replace(alice, "source", List.of("/a"))).code());
        var changed = new MediaSourceRow("source", "alice", "来源", "WEBDAV", new byte[]{1}, true, null, source.createdAt());
        when(sources.lockOwned("alice", "source")).thenReturn(changed);
        var error = assertThrows(ApiException.class, () -> service.replace(alice, "source", List.of("/a")));
        assertEquals(409, error.status()); assertEquals("SOURCE_CONFIG_CHANGED", error.code());
        verify(transactions, times(2)).rollback(status); verifyNoInteractions(roots);
    }
    @Test void databaseFailureDuringReconciliationRollsBackAndHashCollisionCannotOverwriteAnotherPath() throws Exception {
        when(sources.findOwned("alice", "source")).thenReturn(source);
        when(sources.lockOwned("alice", "source")).thenReturn(source);
        when(roots.findBySource("source")).thenReturn(List.of(root("old", "/old", true)));
        doThrow(new IllegalStateException("fixture persistence failure")).when(roots).insert(any());
        assertThrows(IllegalStateException.class, () -> service.replace(alice, "source", List.of("/new")));
        verify(transactions).rollback(status);
        reset(roots);
        when(roots.findBySource("source")).thenReturn(List.of(new MediaScanRootRow("collision", "source", "/different", hash("/new"), false)));
        assertEquals("INTERNAL_ERROR", assertThrows(ApiException.class, () -> service.replace(alice, "source", List.of("/new"))).code());
        verify(roots, never()).delete(any(), any()); verify(roots, never()).insert(any());
    }
    @Test void listingUsesStableCaseSensitivePathOrderAndDoesNotReadConnectionOrNetwork() throws Exception {
        when(sources.findOwned("alice", "source")).thenReturn(source);
        when(roots.findBySource("source")).thenReturn(List.of(root("lower", "/a", true), root("upper", "/A", false)));
        assertEquals(List.of("/A", "/a"), service.list(alice, "source").stream().map(MediaScanRoot::path).toList());
        verifyNoInteractions(adapter, transactions);
    }
    private MediaScanRootRow root(String id, String path, boolean enabled) throws Exception { return new MediaScanRootRow(id, "source", path, hash(path), enabled); }
    private byte[] hash(String path) throws Exception { return MessageDigest.getInstance("SHA-256").digest(path.getBytes(StandardCharsets.UTF_8)); }
}
