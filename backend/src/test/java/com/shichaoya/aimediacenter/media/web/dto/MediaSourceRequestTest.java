package com.shichaoya.aimediacenter.media.web.dto;

import com.shichaoya.aimediacenter.common.web.ApiException;
import org.junit.jupiter.api.Test;
import java.util.HashMap;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class MediaSourceRequestTest {
    @Test void normalizesNameAndAddressButPreservesCredentials() {
        var input = MediaSourceRequest.parse(body("  个人 NAS  ", " https://nas.example/dav/中文/ ", " user ", " password "));
        assertEquals("个人 NAS", input.name());
        assertEquals("https://nas.example/dav/%E4%B8%AD%E6%96%87/", input.connection().address());
        assertEquals(" user ", input.connection().username());
        assertEquals(" password ", input.connection().password());
        assertFalse(input.toString().contains("password"));
        assertFalse(input.connection().toString().contains("password"));
    }
    @Test void rejectsExtraFieldsIncludingClaimedIdentityOrPriorSuccess() {
        for (String extra : new String[]{"userId", "id", "testedAt", "connectionTested"}) {
            var input = new HashMap<String, Object>(body("NAS", "http://localhost:8080/dav/", "", ""));
            input.put(extra, "ignored");
            assertInvalid(input);
        }
    }
    @Test void acceptsAnonymousAndPrivateNasButRejectsMissingOrWrongTypedFields() {
        assertEquals("", MediaSourceRequest.parse(body("NAS", "http://192.168.1.5:5244/dav/", "", "")).connection().username());
        var missing = new HashMap<String, Object>(body("NAS", "http://localhost/dav/", "", ""));
        missing.remove("password");
        assertInvalid(missing);
        missing.put("password", 42);
        assertInvalid(missing);
    }
    @Test void rejectsUnsafeUrlSyntaxAndInvalidCredentialSyntax() {
        for (String address : new String[]{"file:///tmp", "https://user:pass@nas.example/dav/", "http://nas.example/dav/?token=secret",
                "http://nas.example/dav/#fragment", "http://nas.example:0/dav/", "http://nas.example:65536/", "http://[fe80::1%25eth0]/"}) {
            var error = assertThrows(ApiException.class, () -> MediaSourceRequest.parse(body("NAS", address, "", "")));
            assertTrue(error.fieldErrors().containsKey("address"));
        }
        assertInvalid(body("NAS", "http://localhost/dav/", "bad:user", "password"));
        assertInvalid(body("NAS", "http://localhost/dav/", "", "password"));
        assertInvalid(body("NAS", "http://localhost/dav/", "user", "bad\npassword"));
        assertInvalid(body("😀".repeat(81), "http://localhost/dav/", "user", "password"));
    }
    @Test void rejectsRootPathsThatTheDirectoryBrowserCannotDecodeOrUse() {
        for (String path : new String[]{"/dav/../dav/", "/dav/./", "/dav/%2e%2e/dav/", "/dav/.%2E/dav/",
                "/dav/%2E/", "/dav/a%2fb/", "/dav/a%5Cb/", "/dav/%252e/", "/dav/%252f/",
                "//dav/", "/dav/%00/", "/dav/%FF/", "/dav/%C0%AF/"}) {
            var error = assertThrows(ApiException.class, () -> MediaSourceRequest.parse(body("NAS", "http://localhost" + path, "", "")));
            assertEquals(400, error.status()); assertEquals("VALIDATION_FAILED", error.code());
            assertTrue(error.fieldErrors().containsKey("address"));
        }
    }
    @Test void preservesUsableRootNamesAndUnreservedEncodings() {
        for (String address : new String[]{"http://localhost", "http://localhost/", "http://localhost/dav/中文/",
                "http://localhost/dav/%E7%94%B5%E5%BD%B1%20%E5%BA%93/", "http://localhost/dav/100%25%23%3F+/",
                "http://localhost/d%61v/Movie%2E2020/"}) {
            var parsed = MediaSourceRequest.parse(body("NAS", address, "", ""));
            assertEquals(java.net.URI.create(address).toASCIIString(), parsed.connection().address());
        }
    }
    @Test void rejectsRepeatedSlashesInRemoteRootsInsteadOfChangingTheirIdentity() {
        for (String path : new String[]{"/dav//library/", "/dav///library/", "/dav//", "//dav/"}) {
            var error = assertThrows(ApiException.class,
                    () -> MediaSourceRequest.parse(body("NAS", "http://localhost" + path, "", "")));
            assertEquals(400, error.status()); assertEquals("VALIDATION_FAILED", error.code());
            assertEquals(java.util.Set.of("address"), error.fieldErrors().keySet());
        }
    }
    private Map<String, Object> body(String name, String address, String username, String password) {
        return Map.of("name", name, "address", address, "username", username, "password", password);
    }
    private void assertInvalid(Map<String, Object> input) {
        var error = assertThrows(ApiException.class, () -> MediaSourceRequest.parse(input));
        assertEquals(400, error.status());
        assertEquals("VALIDATION_FAILED", error.code());
    }
}
