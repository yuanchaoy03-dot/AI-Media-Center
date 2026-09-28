package com.shichaoya.aimediacenter;

import com.shichaoya.aimediacenter.common.id.BusinessIds;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in integration test. Requires a disposable MySQL database ending in _auth_test. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@EnabledIfEnvironmentVariable(named = "AUTH_TEST_DB_URL", matches = ".+")
class AuthHttpIntegrationTest {
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        String url = System.getenv("AUTH_TEST_DB_URL");
        if (!url.matches("jdbc:mysql://[^/]+/[a-zA-Z0-9_]+_auth_test(?:\\?.*)?")) throw new IllegalStateException("Use a disposable _auth_test database.");
        byte[] secret = new byte[32]; new SecureRandom().nextBytes(secret);
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> System.getenv("AUTH_TEST_DB_USERNAME"));
        registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("AUTH_TEST_DB_PASSWORD", ""));
        registry.add("app.jwt.secret", () -> Base64.getEncoder().encodeToString(secret));
    }
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;
    @Autowired JwtEncoder encoder;
    @Autowired PasswordEncoder passwords;
    final HttpClient client = HttpClient.newHttpClient();
    final String password = " 中文密码 full input 😀 " + "z".repeat(90);

    @BeforeEach void clear() {
        assertTrue(db.queryForObject("SELECT DATABASE()", String.class).endsWith("_auth_test"));
        db.update("DELETE FROM media_source"); db.update("DELETE FROM users");
    }
    @AfterEach void cleanup() { clear(); }

    @Test void registrationLoginIdentityIsolationAndFailures() throws Exception {
        for (var extra : List.of("role", "userId", "confirmation")) {
            check(call("/auth/register", Map.of("username", "alice", "password", password, extra, "ADMIN"), null), 400, "VALIDATION_FAILED");
        }
        check(call("/auth/register", Map.of("username", "ALICE", "password", "short"), null), 400, "VALIDATION_FAILED");
        check(call("/auth/register", Map.of("username", 1234, "password", password), null), 400, "VALIDATION_FAILED");
        check(call("/auth/register", Map.of("username", "aKb", "password", password), null), 400, "VALIDATION_FAILED");
        check(call("/auth/register", Map.of("username", "alice", "password", "\u00a0".repeat(15)), null), 400, "VALIDATION_FAILED");
        var registered = check(call("/auth/register", Map.of("username", "\u00a0 ALICE \uFEFF", "password", password), "bad-old-token"), 201, "OK");
        var alice = data(registered);
        assertEquals(Set.of("id", "username", "role"), alice.keySet());
        assertEquals("alice", alice.get("username")); assertEquals("USER", alice.get("role"));
        String aliceId = (String) alice.get("id");
        assertEquals(7, UUID.fromString(aliceId).version()); assertEquals(aliceId.toLowerCase(Locale.ROOT), aliceId);
        String hash = db.queryForObject("SELECT password_hash FROM users WHERE id=?", String.class, aliceId);
        assertNotEquals(password, hash); assertTrue(passwords.matches(password, hash));
        assertFalse(passwords.matches(password.substring(0, 72), hash));
        assertFalse(passwords.matches(password.substring(0, password.length()-1) + "x", hash));
        assertTrue(hash.length() <= 255);
        check(call("/auth/register", Map.of("username", "Alice", "password", password), null), 409, "USERNAME_TAKEN");
        assertEquals(0, db.queryForObject("SELECT COUNT(*) FROM media_source", Integer.class));
        for (var credentials : List.of(Map.of("username", "missing", "password", password), Map.of("username", "alice", "password", "bad"))) {
            check(call("/auth/login", credentials, null), 401, "INVALID_CREDENTIALS");
        }
        var login = data(check(call("/auth/login", Map.of("username", " ALICE ", "password", password), "old"), 200, "OK"));
        assertEquals(3600, login.get("expiresIn")); assertEquals("Bearer", login.get("tokenType"));
        String token = (String) login.get("accessToken");
        assertEquals(alice, data(check(call("/auth/me", null, token), 200, "OK")));
        check(call("/auth/me?userId=other", null, token), 400, "VALIDATION_FAILED");
        check(call("/media-sources?userId=other", null, token), 400, "VALIDATION_FAILED");
        check(call("/media-sources?userId=other", null, null), 401, "UNAUTHENTICATED");
        for (String invalid : List.of("bad", token.substring(0, token.lastIndexOf('.')+1) + "tampered", token(aliceId, Instant.now().minusSeconds(60), "ai-media-center", "ai-media-center-web"), token(aliceId, Instant.now().plusSeconds(60), "wrong", "ai-media-center-web"), token(aliceId, Instant.now().plusSeconds(60), "ai-media-center", "wrong"))) {
            check(call("/auth/me", null, invalid), 401, "UNAUTHENTICATED");
        }
        check(call("/auth/me", null, token(BusinessIds.next(), Instant.now().plusSeconds(60), "ai-media-center", "ai-media-center-web")), 401, "UNAUTHENTICATED");
        for (String missing : List.of("sub", "exp", "aud", "iss")) {
            var claims = JwtClaimsSet.builder().subject(aliceId).issuer("ai-media-center").audience(List.of("ai-media-center-web"))
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).claims(values -> values.remove(missing)).build();
            String incomplete = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
            check(call("/auth/me", null, incomplete), 401, "UNAUTHENTICATED");
        }
        var bob = data(check(call("/auth/register", Map.of("username", "bob", "password", password), null), 201, "OK"));
        db.update("INSERT INTO media_source(id,user_id,name,connection_config_ciphertext,created_at,updated_at) VALUES(?,?,?,X'010203',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))", BusinessIds.next(), bob.get("id"), "fixture");
        assertEquals(List.of(), check(call("/media-sources", null, token), 200, "OK").get("data"));
        db.update("UPDATE users SET role='ADMIN' WHERE id=?", aliceId);
        assertEquals("ADMIN", data(check(call("/auth/me", null, token), 200, "OK")).get("role"));
        assertEquals(List.of(), check(call("/media-sources", null, token), 200, "OK").get("data"));
        String bobToken = (String) data(check(call("/auth/login", Map.of("username", "bob", "password", password), null), 200, "OK")).get("accessToken");
        check(call("/media-sources", null, bobToken), 501, "SOURCE_LIST_NOT_READY");
        db.update("UPDATE users SET status='DISABLED' WHERE id=?", aliceId);
        check(call("/auth/me", null, token), 403, "ACCOUNT_DISABLED");
        check(call("/media-sources", null, token), 403, "ACCOUNT_DISABLED");
        check(call("/auth/login", Map.of("username", "alice", "password", password), null), 401, "INVALID_CREDENTIALS");
        db.update("UPDATE users SET status='ACTIVE' WHERE id=?", aliceId);
        db.execute("RENAME TABLE media_source TO unavailable_sources");
        try { check(call("/media-sources", null, token), 500, "INTERNAL_ERROR"); }
        finally { db.execute("RENAME TABLE unavailable_sources TO media_source"); }
        db.execute("RENAME TABLE users TO unavailable_users");
        try { check(call("/auth/me", null, token), 500, "INTERNAL_ERROR"); }
        finally { db.execute("RENAME TABLE unavailable_users TO users"); }
        assertEquals(aliceId, data(check(call("/auth/me", null, token), 200, "OK")).get("id"));
    }

    @Test void concurrentRegistrationAndUnicodeLimit() throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            Callable<Integer> attempt = () -> { start.await(); return call("/auth/register", Map.of("username", "race_user", "password", password), null).statusCode(); };
            var first = pool.submit(attempt); var second = pool.submit(attempt); start.countDown();
            assertEquals(Set.of(201, 409), Set.of(first.get(), second.get()));
        }
        String unicode = "😀".repeat(128);
        check(call("/auth/register", Map.of("username", "unicode_user", "password", unicode), null), 201, "OK");
        check(call("/auth/login", Map.of("username", "unicode_user", "password", unicode), null), 200, "OK");
        check(call("/auth/login", Map.of("username", "unicode_user", "password", "😀".repeat(127)+"😁"), null), 401, "INVALID_CREDENTIALS");
        check(call("/auth/register", Map.of("username", "too_long", "password", unicode+"x"), null), 400, "VALIDATION_FAILED");
    }

    HttpResponse<String> call(String path, Object body, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api"+path));
        if (token != null) builder.header("Authorization", "Bearer "+token);
        if (body != null) builder.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        else builder.GET();
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
    @SuppressWarnings("unchecked") Map<String, Object> check(HttpResponse<String> response, int status, String code) {
        assertEquals(status, response.statusCode(), () -> "Unexpected status; response code: " + json.readValue(response.body(), Map.class).get("code"));
        var body = (Map<String, Object>) json.readValue(response.body(), Map.class);
        assertEquals(code, body.get("code")); assertNotNull(body.get("requestId"));
        assertTrue(response.headers().firstValue("Cache-Control").orElse("").contains("no-store"));
        if (status >= 400) {
            assertNull(body.get("data")); assertFalse(response.body().contains(password));
            assertFalse(response.body().contains("password_hash")); assertFalse(response.body().contains("Exception"));
        }
        if (status == 401 && code.equals("UNAUTHENTICATED")) assertEquals("Bearer", response.headers().firstValue("WWW-Authenticate").orElse(""));
        return body;
    }
    @SuppressWarnings("unchecked") Map<String, Object> data(Map<String, Object> body) { return (Map<String, Object>) body.get("data"); }
    String token(String sub, Instant expires, String issuer, String audience) {
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), JwtClaimsSet.builder()
                .subject(sub).issuer(issuer).audience(List.of(audience)).issuedAt(Instant.now().minusSeconds(120)).expiresAt(expires).build())).getTokenValue();
    }
}
