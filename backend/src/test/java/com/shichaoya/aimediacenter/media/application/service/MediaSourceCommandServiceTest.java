package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.application.port.MediaSourceAdapter;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.security.SourceConnectionEncryption;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;
import java.util.Base64;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MediaSourceCommandServiceTest {
    private final MediaSourceAdapter adapter = mock(MediaSourceAdapter.class);
    private final MediaSourceMapper sources = mock(MediaSourceMapper.class);
    private final SourceConnectionEncryption encryption = new SourceConnectionEncryption(Base64.getEncoder().encodeToString(new byte[32]), JsonMapper.builder().build());
    private final MediaSourceQueryService query = new MediaSourceQueryService(sources, encryption);
    private final MediaSourceCommandService service = new MediaSourceCommandService(adapter, sources, encryption, query);
    private final SourceConnection connection = new SourceConnection("http://localhost/dav/", "user", "private-password");
    private final CurrentUser alice = new CurrentUser("alice", "alice", "USER");
    @Test void rechecksConnectionAndPersistsTrustedOwnershipWithoutScanSideEffects() {
        service.testConnection(connection);
        var created = service.create(alice, "NAS", connection);
        var captured = ArgumentCaptor.forClass(MediaSourceRow.class);
        var order = inOrder(adapter, sources);
        order.verify(adapter, times(2)).testConnection(connection);
        order.verify(sources).insert(captured.capture()); order.verifyNoMoreInteractions();
        var row = captured.getValue();
        assertEquals("alice", row.userId()); assertEquals("NAS", created.name()); assertEquals("WebDAV", created.type());
        assertEquals(7, java.util.UUID.fromString(created.id()).version());
        assertEquals(connection, encryption.decrypt(row.connectionConfigCiphertext(), alice.id(), row.id()));
        when(sources.findByUser(alice.id())).thenReturn(List.of(row));
        assertEquals(List.of(created), query.list(alice));
        assertEquals(0, created.createdAt().getNano() % 1_000_000);
    }
    @Test void previousSuccessCannotAuthorizeNewCreateWhenCurrentCredentialsFail() {
        service.testConnection(connection);
        doThrow(new ApiException(422, "SOURCE_AUTH_FAILED", "失败")).when(adapter).testConnection(connection);
        assertThrows(ApiException.class, () -> service.create(alice, "NAS", connection));
        verifyNoInteractions(sources);
    }
    @Test void missingKeyLeavesEmptyListAvailableAndBlocksCreateBeforeNetwork() {
        var absent = new SourceConnectionEncryption("", JsonMapper.builder().build());
        var emptyQuery = new MediaSourceQueryService(sources, absent);
        when(sources.findByUser("alice")).thenReturn(List.of());
        assertEquals(List.of(), emptyQuery.list(alice));
        var blocked = new MediaSourceCommandService(adapter, sources, absent, emptyQuery);
        var error = assertThrows(ApiException.class, () -> blocked.create(alice, "NAS", connection));
        assertEquals("SOURCE_CONFIG_UNAVAILABLE", error.code());
        verifyNoInteractions(adapter); verify(sources, never()).insert(any());
    }
}
