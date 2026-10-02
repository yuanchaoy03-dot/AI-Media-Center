package com.shichaoya.aimediacenter.media.infrastructure.security;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;
import static org.junit.jupiter.api.Assertions.*;

class SourceConnectionEncryptionTest {
    private static final SourceConnection CONNECTION = new SourceConnection("https://nas.example/dav/", "用户", "private-password-😀");
    @Test void encryptsEntireConfigWithFreshNonceAndRoundTripsUnicode() {
        var encryption = configured();
        byte[] first = encryption.encrypt(CONNECTION, "alice", "source1");
        byte[] second = encryption.encrypt(CONNECTION, "alice", "source1");
        assertFalse(Arrays.equals(first, second));
        assertEquals(CONNECTION, encryption.decrypt(first, "alice", "source1"));
        assertFalse(new String(first, StandardCharsets.ISO_8859_1).contains("nas.example"));
        assertFalse(new String(first, StandardCharsets.ISO_8859_1).contains("private-password"));
    }
    @Test void detectsCiphertextTamperingAndBindsBothUserAndSourceIdentity() {
        var encryption = configured();
        byte[] encrypted = encryption.encrypt(CONNECTION, "alice", "source1");
        assertInvalid(() -> encryption.decrypt(encrypted, "bob", "source1"));
        assertInvalid(() -> encryption.decrypt(encrypted, "alice", "source2"));
        encrypted[encrypted.length - 1] ^= 1;
        assertInvalid(() -> encryption.decrypt(encrypted, "alice", "source1"));
        assertInvalid(() -> encryption.decrypt(new byte[]{1}, "alice", "source1"));
    }
    @Test void absentOrInvalidKeyDoesNotPreventConstructionButBlocksUse() {
        for (String key : new String[]{"", "not-base64", Base64.getEncoder().encodeToString(new byte[16])}) {
            var encryption = new SourceConnectionEncryption(key, JsonMapper.builder().build());
            var error = assertThrows(ApiException.class, () -> encryption.encrypt(CONNECTION, "alice", "source1"));
            assertEquals(503, error.status());
            assertEquals("SOURCE_CONFIG_UNAVAILABLE", error.code());
            assertEquals("SOURCE_CONFIG_UNAVAILABLE", assertThrows(ApiException.class,
                    () -> encryption.decrypt(new byte[]{1}, "alice", "source1")).code());
        }
    }
    private SourceConnectionEncryption configured() {
        byte[] key = new byte[32]; new SecureRandom().nextBytes(key);
        return new SourceConnectionEncryption(Base64.getEncoder().encodeToString(key), JsonMapper.builder().build());
    }
    private void assertInvalid(org.junit.jupiter.api.function.Executable action) {
        var error = assertThrows(ApiException.class, action);
        assertEquals(500, error.status());
        assertEquals("SOURCE_CONFIG_INVALID", error.code());
        assertFalse(error.getMessage().contains(CONNECTION.password()));
    }
}
