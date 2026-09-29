package com.shichaoya.aimediacenter;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.user.web.dto.CredentialsRequest;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class CredentialsRequestTest {
    @Test void registrationPasswordLengthBoundary() {
        assertThrows(ApiException.class, () -> CredentialsRequest.parse(Map.of("username", "alice", "password", "a".repeat(11)), true));
        assertEquals("a".repeat(12), CredentialsRequest.parse(Map.of("username", "alice", "password", "a".repeat(12)), true).password());
        assertEquals("😀".repeat(12), CredentialsRequest.parse(Map.of("username", "alice", "password", "😀".repeat(12)), true).password());
        assertEquals("a".repeat(11), CredentialsRequest.parse(Map.of("username", "alice", "password", "a".repeat(11)), false).password());
    }
}
