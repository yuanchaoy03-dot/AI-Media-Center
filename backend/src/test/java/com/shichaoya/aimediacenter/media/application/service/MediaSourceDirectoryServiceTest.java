package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.application.port.MediaSourceAdapter;
import com.shichaoya.aimediacenter.media.domain.MediaDirectory;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.security.SourceConnectionEncryption;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class MediaSourceDirectoryServiceTest {
    private final MediaSourceMapper sources = mock(MediaSourceMapper.class);
    private final MediaSourceAdapter adapter = mock(MediaSourceAdapter.class);
    private final SourceConnectionEncryption encryption = new SourceConnectionEncryption(Base64.getEncoder().encodeToString(new byte[32]), JsonMapper.builder().build());
    private final MediaSourceDirectoryService service = new MediaSourceDirectoryService(sources, encryption, adapter);
    private final CurrentUser alice = new CurrentUser("alice", "alice", "USER");
    private final SourceConnection connection = new SourceConnection("http://localhost/dav/", "fixture-user", "fixture-password");

    @Test void checksTrustedOwnershipThenDecryptsAndBrowsesEvenWhenScanningIsDisabled() {
        when(sources.findOwned("alice", "source-id")).thenReturn(row(false));
        var result = new MediaDirectory("/电影", List.of());
        when(adapter.browseDirectory(connection, "/电影")).thenReturn(result);
        assertEquals(result, service.browse(alice, "source-id", "/电影/"));
        var order = inOrder(sources, adapter);
        order.verify(sources).findOwned("alice", "source-id");
        order.verify(adapter).browseDirectory(connection, "/电影");
        order.verifyNoMoreInteractions();
    }
    @Test void missingAndOtherUsersSourcesAreIdenticalAndNeverReachWebDavOrDecryption() {
        var missingKey = new SourceConnectionEncryption("", JsonMapper.builder().build());
        var protectedService = new MediaSourceDirectoryService(sources, missingKey, adapter);
        for (String id : List.of("missing", "other-users-source")) {
            var error = assertThrows(ApiException.class, () -> protectedService.browse(alice, id, "/"));
            assertEquals(404, error.status()); assertEquals("SOURCE_NOT_FOUND", error.code());
            verify(sources).findOwned("alice", id);
        }
        verifyNoInteractions(adapter); verify(sources, never()).insert(any());
    }
    @Test void invalidPathAndUnreadableConfigurationFailBeforeNetworkAndNeverWrite() {
        when(sources.findOwned("alice", "source-id")).thenReturn(row(true));
        var invalid = assertThrows(ApiException.class, () -> service.browse(alice, "source-id", "/../escape"));
        assertEquals("VALIDATION_FAILED", invalid.code());
        var row = row(true);
        when(sources.findOwned("alice", "source-id")).thenReturn(new MediaSourceRow(row.id(), row.userId(), row.name(), row.sourceType(), new byte[]{1}, true, null, row.createdAt()));
        assertEquals("SOURCE_CONFIG_INVALID", assertThrows(ApiException.class, () -> service.browse(alice, "source-id", "/")).code());
        verifyNoInteractions(adapter); verify(sources, never()).insert(any());
    }
    @Test void sourceFailuresPropagateWithoutWriteOrChangingConnectionTestTime() {
        when(sources.findOwned("alice", "source-id")).thenReturn(row(true));
        var failure = new ApiException(422, "SOURCE_AUTH_FAILED", "fixture");
        when(adapter.browseDirectory(connection, "/")).thenThrow(failure);
        assertSame(failure, assertThrows(ApiException.class, () -> service.browse(alice, "source-id", "/")));
        verify(sources).findOwned("alice", "source-id"); verifyNoMoreInteractions(sources);
    }
    private MediaSourceRow row(boolean enabled) {
        return new MediaSourceRow("source-id", "alice", "来源", "WEBDAV", encryption.encrypt(connection, "alice", "source-id"), enabled, null, LocalDateTime.of(2026, 10, 2, 0, 0));
    }
}
