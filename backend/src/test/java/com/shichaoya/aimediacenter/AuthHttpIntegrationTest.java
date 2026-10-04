package com.shichaoya.aimediacenter;

import com.shichaoya.aimediacenter.common.id.BusinessIds;
import com.sun.net.httpserver.HttpServer;
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
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

/**
 * 真实 HTTP + MySQL 的认证/本人来源集成测试，需显式提供独立且可清空的 *_auth_test 数据库。
 * 覆盖 Argon2id 注册、JWT 校验、账号现状复核及真实 WebDAV 测试/加密保存/本人列表隔离；
 * WebDAV 使用临时本机 HTTP 服务，不连接外部来源。未设置 AUTH_TEST_DB_URL 时不会运行，
 * 因而普通 package 通过不能说明这些集成场景已实际执行。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@EnabledIfEnvironmentVariable(named = "AUTH_TEST_DB_URL", matches = ".+")
class AuthHttpIntegrationTest {
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        String url = System.getenv("AUTH_TEST_DB_URL");
        if (!url.matches("jdbc:mysql://[^/]+/[a-zA-Z0-9_]+_auth_test(?:\\?.*)?")) throw new IllegalStateException("Use a disposable _auth_test database.");
        byte[] secret = new byte[32]; new SecureRandom().nextBytes(secret);
        byte[] mediaKey = new byte[32]; new SecureRandom().nextBytes(mediaKey);
        registry.add("spring.datasource.url", () -> url);
        registry.add("spring.datasource.username", () -> System.getenv("AUTH_TEST_DB_USERNAME"));
        registry.add("spring.datasource.password", () -> System.getenv().getOrDefault("AUTH_TEST_DB_PASSWORD", ""));
        registry.add("app.jwt.secret", () -> Base64.getEncoder().encodeToString(secret));
        registry.add("app.media-source.encryption-key", () -> Base64.getEncoder().encodeToString(mediaKey));
        registry.add("app.media-source.connection-timeout-ms", () -> 1000);
    }
    @Value("${local.server.port}") int port;
    @Autowired JdbcTemplate db;
    @Autowired ObjectMapper json;
    @Autowired JwtEncoder encoder;
    @Autowired PasswordEncoder passwords;
    final HttpClient client = HttpClient.newHttpClient();
    final String password = " 中文密码 full input 😀 " + "z".repeat(90);

    @BeforeEach void clear() {
        // 本测试会删除表中数据，先再次核对数据库名称，避免误清理普通开发库。
        assertTrue(db.queryForObject("SELECT DATABASE()", String.class).endsWith("_auth_test"));
        db.update("DELETE FROM media_resource"); db.update("DELETE FROM scan_task");
        db.update("DELETE FROM media_scan_root"); db.update("DELETE FROM media_source"); db.update("DELETE FROM users");
    }
    @AfterEach void cleanup() { clear(); }

    @Test void registrationAcceptsTwelveCharacterPassword() throws Exception {
        check(call("/auth/register", Map.of("username", "boundary_user", "password", "a".repeat(11)), null), 400, "VALIDATION_FAILED");
        check(call("/auth/register", Map.of("username", "boundary_user", "password", "a".repeat(12)), null), 201, "OK");
        check(call("/auth/login", Map.of("username", "boundary_user", "password", "a".repeat(12)), null), 200, "OK");
    }

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
        assertTrue(hash.startsWith("{argon2id}$argon2id$"));
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
        // 不重新签发 Token：同一 Token 的 /me 应读取数据库中的最新角色。
        assertEquals("ADMIN", data(check(call("/auth/me", null, token), 200, "OK")).get("role"));
        assertEquals(List.of(), check(call("/media-sources", null, token), 200, "OK").get("data"));
        String bobToken = (String) data(check(call("/auth/login", Map.of("username", "bob", "password", password), null), 200, "OK")).get("accessToken");
        // 损坏的本人密文不能伪装为空列表；其他用户（包括管理员）不读取或解密这条来源。
        check(call("/media-sources", null, bobToken), 500, "SOURCE_CONFIG_INVALID");
        db.update("UPDATE users SET status='DISABLED' WHERE id=?", aliceId);
        // Token 仍在有效期内，但下次受保护请求仍须被当前账号状态拦下。
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

    @Test void firstWebDavSourceCanBeTestedSavedAndReadOnlyByItsOwner() throws Exception {
        String aliceToken = registerAndLogin("source_alice");
        String bobToken = registerAndLogin("source_bob");
        String aliceId = (String) data(check(call("/auth/me", null, aliceToken), 200, "OK")).get("id");
        try (var dav = new TemporaryWebDavServer()) {
            var input = dav.input("/dav/");
            var scanArtifacts = scanArtifactCounts();
            var test = data(check(call("/media-sources/test-connection", input, aliceToken), 200, "OK"));
            assertEquals(Set.of("testedAt"), test.keySet());
            assertNotNull(Instant.parse((String) test.get("testedAt")));
            assertEquals(1, dav.davRequests.get());
            assertEquals(0, db.queryForObject("SELECT COUNT(*) FROM media_source", Integer.class));

            var createdResponse = call("/media-sources", input, aliceToken);
            var created = data(check(createdResponse, 201, "OK"));
            assertEquals(Set.of("id", "name", "type", "address", "enabled", "lastConnectionTestAt", "createdAt"), created.keySet());
            String sourceId = (String) created.get("id");
            assertEquals(7, UUID.fromString(sourceId).version());
            assertEquals(input.get("name"), created.get("name"));
            assertEquals("WebDAV", created.get("type"));
            assertEquals(input.get("address"), created.get("address"));
            assertEquals(true, created.get("enabled"));
            assertNotNull(Instant.parse((String) created.get("lastConnectionTestAt")));
            assertNotNull(Instant.parse((String) created.get("createdAt")));
            assertFalse(createdResponse.body().contains(input.get("username")));
            assertFalse(createdResponse.body().contains(input.get("password")));
            // 保存必须在服务端重新测试本次输入，不能信任前端的“已测试”状态。
            assertEquals(2, dav.davRequests.get());
            assertEquals(aliceId, db.queryForObject("SELECT user_id FROM media_source WHERE id=?", String.class, sourceId));
            byte[] cipher = db.queryForObject("SELECT connection_config_ciphertext FROM media_source WHERE id=?", byte[].class, sourceId);
            assertNotNull(cipher);
            assertTrue(cipher.length > 32);
            String stored = new String(cipher, StandardCharsets.ISO_8859_1);
            for (String field : List.of("address", "username", "password")) assertFalse(stored.contains(input.get(field)));
            assertEquals(scanArtifacts, scanArtifactCounts());

            // 再次 GET 相当于刷新后读取；测试/保存响应不是来源页面的数据缓存。
            assertEquals(List.of(created), check(call("/media-sources", null, aliceToken), 200, "OK").get("data"));
            assertEquals(List.of(created), check(call("/media-sources", null, aliceToken), 200, "OK").get("data"));
            assertEquals(List.of(), check(call("/media-sources", null, bobToken), 200, "OK").get("data"));
            db.update("UPDATE users SET role='ADMIN' WHERE username='source_bob'");
            assertEquals(List.of(), check(call("/media-sources", null, bobToken), 200, "OK").get("data"));
            db.update("UPDATE users SET role='ADMIN' WHERE id=?", aliceId);
            assertEquals(List.of(created), check(call("/media-sources", null, aliceToken), 200, "OK").get("data"));

            dav.rejectCredentials.set(true);
            var rejectedSave = call("/media-sources", input, aliceToken);
            check(rejectedSave, 422, "SOURCE_AUTH_FAILED");
            assertSourceFailurePrivate(rejectedSave, input);
            assertEquals(3, dav.davRequests.get());
            assertEquals(1, db.queryForObject("SELECT COUNT(*) FROM media_source", Integer.class));
            assertEquals(List.of(created), check(call("/media-sources", null, aliceToken), 200, "OK").get("data"));
        }
    }

    @Test void webDavValidationAndProtocolFailuresStayPrivateAndDoNotCreateSources() throws Exception {
        String token = registerAndLogin("source_failures");
        try (var dav = new TemporaryWebDavServer()) {
            var input = dav.input("/dav/");
            for (String endpoint : List.of("/media-sources/test-connection", "/media-sources")) {
                check(call(endpoint, input, null), 401, "UNAUTHENTICATED");
                check(call(endpoint + "?userId=other", input, token), 400, "VALIDATION_FAILED");
                for (String extra : List.of("userId", "role", "testedAt")) {
                    var invalid = new HashMap<>(input); invalid.put(extra, "client-cannot-assert-identity-or-test");
                    check(call(endpoint, invalid, token), 400, "VALIDATION_FAILED");
                }
                for (String address : List.of("ftp://example.invalid/", "https://user:secret@example.invalid/dav/", "https://example.invalid/dav/?credential=secret", "https://example.invalid/dav/#secret")) {
                    var invalid = new HashMap<>(input); invalid.put("address", address);
                    var response = call(endpoint, invalid, token);
                    check(response, 400, "VALIDATION_FAILED"); assertSourceFailurePrivate(response, invalid);
                }
            }
            assertEquals(0, dav.davRequests.get());
            var wrongPassword = new HashMap<>(input); wrongPassword.put("password", "wrong-webdav-password-fixture");
            for (String endpoint : List.of("/media-sources/test-connection", "/media-sources")) {
                var response = call(endpoint, wrongPassword, token);
                check(response, 422, "SOURCE_AUTH_FAILED"); assertSourceFailurePrivate(response, wrongPassword);
            }
            for (var failure : Map.of("/not-dav/", "SOURCE_NOT_WEBDAV", "/redirect/", "SOURCE_REDIRECT_UNSUPPORTED", "/unavailable/", "SOURCE_CONNECTION_FAILED").entrySet()) {
                var failingInput = dav.input(failure.getKey());
                var response = call("/media-sources/test-connection", failingInput, token);
                check(response, 422, failure.getValue()); assertSourceFailurePrivate(response, failingInput);
            }
            assertEquals(0, dav.followedRedirects.get());
            var slowInput = dav.input("/slow/");
            var timeout = call("/media-sources/test-connection", slowInput, token);
            check(timeout, 504, "SOURCE_CONNECTION_TIMEOUT"); assertSourceFailurePrivate(timeout, slowInput);
            assertEquals(List.of(), check(call("/media-sources", null, token), 200, "OK").get("data"));
            assertEquals(0, db.queryForObject("SELECT COUNT(*) FROM media_source", Integer.class));
        }
    }

    @Test void savedSourceDirectoryBrowsingIsReadOnlyAndRejectsOtherUsersBeforeWebDav() throws Exception {
        String aliceToken = registerAndLogin("directory_alice");
        String bobToken = registerAndLogin("directory_bob");
        try (var dav = new TemporaryWebDavServer()) {
            var input = dav.input("/dav/");
            String sourceId = (String) data(check(call("/media-sources", input, aliceToken), 201, "OK")).get("id");
            db.update("UPDATE media_source SET enabled=0 WHERE id=?", sourceId);
            Object before = check(call("/media-sources", null, aliceToken), 200, "OK").get("data");
            var artifacts = scanArtifactCounts();
            String endpoint = "/media-sources/" + sourceId + "/directory";
            var rootResponse = call(endpoint + "?path=%2F", null, aliceToken);
            var root = data(check(rootResponse, 200, "OK"));
            assertEquals(Set.of("path", "entries"), root.keySet()); assertEquals("/", root.get("path"));
            assertEquals(List.of(Map.of("name", "empty", "path", "/empty", "kind", "directory"),
                    Map.of("name", "电影 库 #?100%+", "path", "/电影 库 #?100%+", "kind", "directory"),
                    Map.of("name", "video.mkv", "path", "/video.mkv", "kind", "file")), root.get("entries"));
            assertSourceFailurePrivate(rootResponse, input);
            var child = data(check(call(endpoint + "?path=" + URLEncoder.encode("/电影 库 #?100%+/", StandardCharsets.UTF_8), null, aliceToken), 200, "OK"));
            assertEquals("/电影 库 #?100%+", child.get("path"));
            assertEquals(List.of(Map.of("name", "notes %#?.txt", "path", "/电影 库 #?100%+/notes %#?.txt", "kind", "file")), child.get("entries"));
            assertEquals(List.of(), data(check(call(endpoint + "?path=%2Fempty", null, aliceToken), 200, "OK")).get("entries"));
            int requests = dav.directoryRequests.get();
            check(call(endpoint + "?path=%2F", null, null), 401, "UNAUTHENTICATED");
            var denied = call(endpoint + "?path=%2F", null, bobToken);
            var absent = call("/media-sources/missing-source/directory?path=%2F", null, aliceToken);
            check(denied, 404, "SOURCE_NOT_FOUND"); check(absent, 404, "SOURCE_NOT_FOUND");
            assertEquals(dataOrMessage(denied), dataOrMessage(absent));
            db.update("UPDATE users SET role='ADMIN' WHERE username='directory_bob'");
            check(call(endpoint + "?path=%2F", null, bobToken), 404, "SOURCE_NOT_FOUND");
            for (String query : List.of("", "?path=%2F&path=%2F", "?path=%2F&userId=other", "?path=", "?path=%2F..%2Fescape", "?path=%2Fa%252fb", "?path=https%3A%2F%2Foutside.invalid")) {
                check(call(endpoint + query, null, aliceToken), 400, "VALIDATION_FAILED");
            }
            var getWithBody = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api" + endpoint + "?path=%2F"))
                    .header("Authorization", "Bearer " + aliceToken).method("GET", HttpRequest.BodyPublishers.ofString("unexpected")).build();
            check(client.send(getWithBody, HttpResponse.BodyHandlers.ofString()), 400, "VALIDATION_FAILED");
            assertEquals(requests, dav.directoryRequests.get());
            assertEquals(before, check(call("/media-sources", null, aliceToken), 200, "OK").get("data"));
            assertEquals(1, db.queryForObject("SELECT COUNT(*) FROM media_source", Integer.class));
            assertEquals(artifacts, scanArtifactCounts());
        }
    }

    @Test void directoryProtocolFailuresRemainPrivateAndNeverChangeSavedSourceOrCreateArtifacts() throws Exception {
        String token = registerAndLogin("directory_failures");
        try (var dav = new TemporaryWebDavServer()) {
            var input = dav.input("/dav/");
            String id = (String) data(check(call("/media-sources", input, token), 201, "OK")).get("id");
            String endpoint = "/media-sources/" + id + "/directory?path=";
            Object before = check(call("/media-sources", null, token), 200, "OK").get("data");
            var artifacts = scanArtifactCounts();
            for (var failure : Map.of("/missing", "SOURCE_DIRECTORY_NOT_FOUND", "/file.mkv", "SOURCE_DIRECTORY_NOT_FOUND",
                    "/invalid", "SOURCE_DIRECTORY_INVALID", "/redirect", "SOURCE_REDIRECT_UNSUPPORTED", "/offline", "SOURCE_CONNECTION_FAILED", "/html", "SOURCE_NOT_WEBDAV").entrySet()) {
                var response = call(endpoint + URLEncoder.encode(failure.getKey(), StandardCharsets.UTF_8), null, token);
                check(response, failure.getValue().equals("SOURCE_DIRECTORY_NOT_FOUND") ? 404 : 422, failure.getValue());
                assertSourceFailurePrivate(response, input);
            }
            dav.rejectCredentials.set(true);
            var rejected = call(endpoint + "%2F", null, token);
            check(rejected, 422, "SOURCE_AUTH_FAILED"); assertSourceFailurePrivate(rejected, input);
            dav.rejectCredentials.set(false);
            var slow = call(endpoint + "%2Fslow", null, token);
            check(slow, 504, "SOURCE_CONNECTION_TIMEOUT"); assertSourceFailurePrivate(slow, input);
            assertEquals(0, dav.followedRedirects.get());
            assertEquals(before, check(call("/media-sources", null, token), 200, "OK").get("data"));
            assertEquals(1, db.queryForObject("SELECT COUNT(*) FROM media_source", Integer.class));
            assertEquals(artifacts, scanArtifactCounts());
        }
    }

    String dataOrMessage(HttpResponse<String> response) { return (String) json.readValue(response.body(), Map.class).get("message"); }

    @Test void scanRootsPersistAfterLoginPreserveIdsAndEnabledAndEnforceIsolationBeforeWebDav() throws Exception {
        String aliceToken = registerAndLogin("roots_alice"); String bobToken = registerAndLogin("roots_bob");
        try (var dav = new TemporaryWebDavServer()) {
            var input = dav.input("/dav/");
            var source = data(check(call("/media-sources", input, aliceToken), 201, "OK"));
            String sourceId = (String) source.get("id"); String endpoint = "/media-sources/" + sourceId + "/scan-roots";
            assertEquals(List.of(), check(call(endpoint, null, aliceToken), 200, "OK").get("data"));
            int requests = dav.directoryRequests.get();
            check(call(endpoint, null, null), 401, "UNAUTHENTICATED");
            check(put(endpoint, Map.of("paths", List.of("/empty")), null), 401, "UNAUTHENTICATED");
            check(call(endpoint, null, bobToken), 404, "SOURCE_NOT_FOUND");
            check(put(endpoint, Map.of("paths", List.of("/empty")), bobToken), 404, "SOURCE_NOT_FOUND");
            db.update("UPDATE users SET role='ADMIN' WHERE username='roots_bob'");
            check(call(endpoint, null, bobToken), 404, "SOURCE_NOT_FOUND");
            check(put(endpoint, Map.of("paths", List.of("/empty")), bobToken), 404, "SOURCE_NOT_FOUND");
            check(put("/media-sources/missing/scan-roots", Map.of("paths", List.of("/empty")), aliceToken), 404, "SOURCE_NOT_FOUND");
            assertEquals(requests, dav.directoryRequests.get());

            db.update("UPDATE media_source SET enabled=0 WHERE id=?", sourceId);
            var savedResponse = put(endpoint, Map.of("paths", List.of("/电影 库 #?100%+/", "/empty/")), aliceToken);
            var saved = rootData(check(savedResponse, 200, "OK"));
            assertSourceFailurePrivate(savedResponse, input);
            assertEquals(List.of("/empty", "/电影 库 #?100%+"), saved.stream().map(root -> root.get("path")).toList());
            for (var root : saved) {
                assertEquals(Set.of("id", "sourceId", "path", "enabled"), root.keySet()); assertEquals(sourceId, root.get("sourceId"));
                assertEquals(true, root.get("enabled")); assertEquals(7, UUID.fromString((String) root.get("id")).version());
            }
            assertEquals(saved, check(call(endpoint, null, aliceToken), 200, "OK").get("data"));
            String relogged = (String) data(check(call("/auth/login", Map.of("username", "roots_alice", "password", password), null), 200, "OK")).get("accessToken");
            assertEquals(saved, check(call(endpoint, null, relogged), 200, "OK").get("data"));
            String retainedId = (String) saved.getFirst().get("id");
            db.update("UPDATE media_scan_root SET enabled=0 WHERE id=?", retainedId);
            var replaced = rootData(check(put(endpoint, Map.of("paths", List.of("/empty", "/a", "/ab")), aliceToken), 200, "OK"));
            assertEquals(List.of("/a", "/ab", "/empty"), replaced.stream().map(root -> root.get("path")).toList());
            assertEquals(Map.of("id", retainedId, "sourceId", sourceId, "path", "/empty", "enabled", false), replaced.getLast());
            assertEquals(0, db.queryForObject("SELECT COUNT(*) FROM media_scan_root WHERE id=?", Integer.class, saved.getLast().get("id")));
            assertEquals(source.get("lastConnectionTestAt"), dataSource(aliceToken).get("lastConnectionTestAt"));
            assertEquals(false, dataSource(aliceToken).get("enabled"));
            requests = dav.directoryRequests.get(); dav.rejectCredentials.set(true);
            assertEquals(List.of(), check(put(endpoint, Map.of("paths", List.of()), aliceToken), 200, "OK").get("data"));
            assertEquals(requests, dav.directoryRequests.get());
            assertEquals(List.of(), check(call(endpoint, null, aliceToken), 200, "OK").get("data"));
            assertEquals(Map.of("media_scan_root", 0, "scan_task", 0, "media_resource", 0, "user_movie", 0), scanArtifactCounts());
        }
    }

    @Test void scanRootValidationAndDatabaseFailuresRetainWholePreviousConfiguration() throws Exception {
        String token = registerAndLogin("roots_failures");
        try (var dav = new TemporaryWebDavServer()) {
            var input = dav.input("/dav/");
            String sourceId = (String) data(check(call("/media-sources", input, token), 201, "OK")).get("id");
            String endpoint = "/media-sources/" + sourceId + "/scan-roots";
            Object saved = check(put(endpoint, Map.of("paths", List.of("/empty")), token), 200, "OK").get("data");
            int requests = dav.directoryRequests.get();
            for (var invalid : List.of(Map.of(), Map.of("paths", List.of(), "enabled", false), Map.of("paths", List.of(), "sourceId", "other"),
                    Map.of("paths", "/empty"), Map.of("paths", List.of(12)), Map.of("paths", List.of("/empty", "/empty/")),
                    Map.of("paths", List.of("/a/b", "/a")), Map.of("paths", List.of("/", "/empty")), Map.of("paths", List.of("/../escape")))) {
                check(put(endpoint, invalid, token), 400, "VALIDATION_FAILED");
            }
            check(call(endpoint + "?userId=other", null, token), 400, "VALIDATION_FAILED");
            check(put(endpoint + "?userId=other", Map.of("paths", List.of()), token), 400, "VALIDATION_FAILED");
            var getWithBody = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api" + endpoint))
                    .header("Authorization", "Bearer " + token).method("GET", HttpRequest.BodyPublishers.ofString("unexpected")).build();
            check(client.send(getWithBody, HttpResponse.BodyHandlers.ofString()), 400, "VALIDATION_FAILED");
            assertEquals(requests, dav.directoryRequests.get());
            for (var failure : Map.of("/missing", "SOURCE_DIRECTORY_NOT_FOUND", "/file.mkv", "SOURCE_DIRECTORY_NOT_FOUND", "/invalid", "SOURCE_DIRECTORY_INVALID").entrySet()) {
                var response = put(endpoint, Map.of("paths", List.of("/a-valid-first", failure.getKey())), token);
                check(response, failure.getValue().equals("SOURCE_DIRECTORY_NOT_FOUND") ? 404 : 422, failure.getValue());
                assertSourceFailurePrivate(response, input);
                assertEquals(saved, check(call(endpoint, null, token), 200, "OK").get("data"));
            }
            dav.rejectCredentials.set(true);
            check(put(endpoint, Map.of("paths", List.of("/empty")), token), 422, "SOURCE_AUTH_FAILED");
            assertEquals(saved, check(call(endpoint, null, token), 200, "OK").get("data")); dav.rejectCredentials.set(false);
            // 删除旧根后新增失败，也必须整体回滚；故障仅作用于独立测试库。
            db.execute("CREATE TRIGGER reject_scan_root_insert BEFORE INSERT ON media_scan_root FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture failure'");
            try {
                check(put(endpoint, Map.of("paths", List.of("/new")), token), 500, "INTERNAL_ERROR");
                assertEquals(saved, check(call(endpoint, null, token), 200, "OK").get("data"));
            } finally { db.execute("DROP TRIGGER reject_scan_root_insert"); }
            assertEquals(1, db.queryForObject("SELECT COUNT(*) FROM media_scan_root", Integer.class));
        }
    }

    @Test void concurrentScanRootReplacementsStayWholeAndLongUnicodePathsDoNotNeedTruncatedIndexes() throws Exception {
        String token = registerAndLogin("roots_concurrent");
        try (var dav = new TemporaryWebDavServer()) {
            String sourceId = (String) data(check(call("/media-sources", dav.input("/dav/"), token), 201, "OK")).get("id");
            String endpoint = "/media-sources/" + sourceId + "/scan-roots";
            try (var pool = Executors.newFixedThreadPool(2)) {
                var start = new CountDownLatch(1);
                Callable<HttpResponse<String>> first = () -> { start.await(); return put(endpoint, Map.of("paths", List.of("/A", "/a")), token); };
                Callable<HttpResponse<String>> second = () -> { start.await(); return put(endpoint, Map.of("paths", List.of("/B", "/b")), token); };
                var one = pool.submit(first); var two = pool.submit(second); start.countDown();
                var firstResult = check(one.get(), 200, "OK").get("data"); var secondResult = check(two.get(), 200, "OK").get("data");
                Object finalResult = check(call(endpoint, null, token), 200, "OK").get("data");
                assertTrue(finalResult.equals(firstResult) || finalResult.equals(secondResult));
                assertEquals(2, db.queryForObject("SELECT COUNT(*) FROM media_scan_root WHERE source_id=?", Integer.class, sourceId));
            }
            String longPath = "/" + "😀".repeat(2047);
            byte[] hash = java.security.MessageDigest.getInstance("SHA-256").digest(longPath.getBytes(StandardCharsets.UTF_8));
            db.update("INSERT INTO media_scan_root(id,source_id,path,path_hash,enabled,created_at,updated_at) VALUES(?,?,?,?,1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))", BusinessIds.next(), sourceId, longPath, hash);
            assertEquals(2048, db.queryForObject("SELECT CHAR_LENGTH(path) FROM media_scan_root WHERE source_id=? AND path_hash=?", Integer.class, sourceId, hash));
            assertTrue(rootData(check(call(endpoint, null, token), 200, "OK")).stream().anyMatch(root -> longPath.equals(root.get("path"))));
        }
    }

    @SuppressWarnings("unchecked") List<Map<String, Object>> rootData(Map<String, Object> response) { return (List<Map<String, Object>>) response.get("data"); }
    @SuppressWarnings("unchecked") Map<String, Object> dataSource(String token) throws Exception { return ((List<Map<String, Object>>) check(call("/media-sources", null, token), 200, "OK").get("data")).getFirst(); }

    @Test void mvcProtocolErrorsKeepTheirStatusAfterJwtAuthentication() throws Exception {
        check(call("/auth/register", Map.of("username", "protocol_user", "password", password), null), 201, "OK");
        String token = (String) data(check(call("/auth/login", Map.of("username", "protocol_user", "password", password), null), 200, "OK")).get("accessToken");
        var unsupportedMethod = call("/auth/me", Map.of(), token);
        check(unsupportedMethod, 405, "METHOD_NOT_ALLOWED");
        assertTrue(unsupportedMethod.headers().firstValue("Allow").orElse("").contains("GET"));
        var unacceptable = HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/auth/me"))
                .header("Authorization", "Bearer "+token).header("Accept", "image/png").GET().build();
        check(client.send(unacceptable, HttpResponse.BodyHandlers.ofString()), 406, "NOT_ACCEPTABLE");
        var unsupportedMedia = HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api/auth/login"))
                .header("Content-Type", "text/plain").POST(HttpRequest.BodyPublishers.ofString("fixture")).build();
        check(client.send(unsupportedMedia, HttpResponse.BodyHandlers.ofString()), 415, "UNSUPPORTED_MEDIA_TYPE");
        check(call("/unknown-fixture-path", null, token), 404, "NOT_FOUND");
        // Security 仍先于 MVC：没有身份的受保护请求继续返回 401；错误请求不会改变已有身份。
        check(call("/auth/me", Map.of(), null), 401, "UNAUTHENTICATED");
        assertEquals("protocol_user", data(check(call("/auth/me", null, token), 200, "OK")).get("username"));
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

    @Test void realScanPersistsFileFactsIdempotentlyAndRejectsOtherUsersBeforeNetwork() throws Exception {
        String owner = registerAndLogin("scan_owner"), other = registerAndLogin("scan_other");
        try (var dav = new ScanWebDavServer()) {
            String sourceId = (String) data(check(call("/media-sources", dav.input(), owner), 201, "OK")).get("id");
            String scans = "/media-sources/" + sourceId + "/scans", resources = "/media-sources/" + sourceId + "/resources";
            String rootApi = "/media-sources/" + sourceId + "/scan-roots";
            check(put(rootApi, Map.of("paths", List.of("/selected", "/other")), owner), 200, "OK");
            db.update("UPDATE media_scan_root SET enabled=0 WHERE source_id=? AND path='/other'", sourceId);
            int before = dav.requests.get();
            for (String role : List.of("USER", "ADMIN")) {
                db.update("UPDATE users SET role=? WHERE username='scan_other'", role);
                check(postEmpty(scans, other), 404, "SOURCE_NOT_FOUND");
                check(call(scans, null, other), 404, "SOURCE_NOT_FOUND");
                check(call(resources, null, other), 404, "SOURCE_NOT_FOUND");
            }
            assertEquals(before, dav.requests.get());
            check(call(scans, null, null), 401, "UNAUTHENTICATED");
            check(call(scans, Map.of("rootPaths", List.of("/other")), owner), 400, "VALIDATION_FAILED");
            var started = data(check(postEmpty(scans, owner), 202, "OK"));
            var completed = awaitScan(scans, (String) started.get("id"), owner);
            assertEquals("completed", completed.get("status"));
            assertEquals(List.of("/selected"), completed.get("rootPaths"));
            assertEquals(3, completed.get("discoveredCount")); assertEquals(3, completed.get("persistedCount"));
            assertEquals(2, completed.get("directoryCount"));
            assertEquals(0, dav.outsideRequests.get());
            var page = data(check(call(resources + "?page=0&pageSize=2", null, owner), 200, "OK"));
            assertEquals(3, ((Number) page.get("total")).intValue());
            assertEquals(2, ((List<?>) page.get("items")).size());
            var all = data(check(call(resources, null, owner), 200, "OK"));
            var files = objectList(all.get("items"));
            assertEquals(Set.of("/selected/" + ScanWebDavServer.RELEASE_NAME, "/selected/电影 #100%.mp4",
                            "/selected/sub/" + ScanWebDavServer.UNICODE_SPACE_NAME),
                    files.stream().map(row -> (String) row.get("path")).collect(java.util.stream.Collectors.toSet()));
            for (var file : files) {
                assertEquals("unidentified", file.get("recognitionStatus"));
                var candidate = (Map<?, ?>) file.get("nameCandidate");
                assertEquals(Set.of("title", "year", "editionLabel"), candidate.keySet());
                if (ScanWebDavServer.RELEASE_NAME.equals(file.get("name"))) {
                    assertEquals("Example Saga Sequel", candidate.get("title"));
                    assertEquals(2004, candidate.get("year"));
                    assertEquals("Uncut", candidate.get("editionLabel"));
                } else if (ScanWebDavServer.UNICODE_SPACE_NAME.equals(file.get("name"))) {
                    assertEquals("/selected/sub/" + ScanWebDavServer.UNICODE_SPACE_NAME, file.get("path"));
                    assertEquals("Example Whitespace Movie", candidate.get("title"));
                    assertEquals(2021, candidate.get("year"));
                    assertEquals("Extended Cut", candidate.get("editionLabel"));
                } else {
                    assertEquals(((String) file.get("name")).replaceFirst("(?i)\\.(mkv|mp4|mov)$", ""), candidate.get("title"));
                    assertNull(candidate.get("year")); assertNull(candidate.get("editionLabel"));
                }
                assertEquals(7, UUID.fromString((String) file.get("id")).version());
                assertEquals(1024, ((Number) file.get("size")).intValue());
                assertEquals("2024-01-01T00:00:00Z", file.get("modifiedAt"));
            }
            var previousIds = files.stream().map(file -> file.get("id")).collect(java.util.stream.Collectors.toSet());
            String againId = (String) data(check(postEmpty(scans, owner), 202, "OK")).get("id");
            assertNotEquals(started.get("id"), againId);
            assertEquals("completed", awaitScan(scans, againId, owner).get("status"));
            String reLogin = (String) data(check(call("/auth/login", Map.of("username", "scan_owner", "password", password), null), 200, "OK")).get("accessToken");
            var reloaded = objectList(data(check(call(resources, null, reLogin), 200, "OK")).get("items"));
            assertEquals(previousIds, reloaded.stream().map(file -> file.get("id")).collect(java.util.stream.Collectors.toSet()));
            assertEquals(new HashSet<>(files), new HashSet<>(reloaded));
            assertEquals(3, db.queryForObject("SELECT COUNT(*) FROM media_resource", Integer.class));
            for (String query : List.of("?page=-1", "?pageSize=101", "?page=1.1", "?page=0&page=1", "?userId=other"))
                check(call(resources + query, null, owner), 400, "VALIDATION_FAILED");
            assertEquals(List.of(), check(call("/media-sources", null, other), 200, "OK").get("data"));
        }
    }

    @Test void activeScanFreezesRootsAndConcurrentStartsReturnOneTask() throws Exception {
        String owner = registerAndLogin("scan_snapshot");
        try (var dav = new ScanWebDavServer()) {
            String sourceId = (String) data(check(call("/media-sources", dav.input(), owner), 201, "OK")).get("id");
            String scans = "/media-sources/" + sourceId + "/scans", roots = "/media-sources/" + sourceId + "/scan-roots";
            check(put(roots, Map.of("paths", List.of("/selected")), owner), 200, "OK");
            dav.block.set(true);
            String taskId = (String) data(check(postEmpty(scans, owner), 202, "OK")).get("id");
            try {
                assertTrue(dav.entered.await(2, TimeUnit.SECONDS));
                try (var callers = Executors.newVirtualThreadPerTaskExecutor()) {
                    var one = callers.submit(() -> postEmpty(scans, owner));
                    var two = callers.submit(() -> postEmpty(scans, owner));
                    assertEquals(taskId, data(check(one.get(), 202, "OK")).get("id"));
                    assertEquals(taskId, data(check(two.get(), 202, "OK")).get("id"));
                }
                check(put(roots, Map.of("paths", List.of("/other")), owner), 200, "OK");
            } finally { dav.release.countDown(); }
            var finished = awaitScan(scans, taskId, owner);
            assertEquals("completed", finished.get("status")); assertEquals(List.of("/selected"), finished.get("rootPaths"));
            assertEquals(1, db.queryForObject("SELECT COUNT(*) FROM scan_task", Integer.class));
            assertEquals(3, db.queryForObject("SELECT COUNT(*) FROM media_resource", Integer.class));
            assertEquals(0, dav.outsideRequests.get());
        }
    }

    @Test void failedScanKeepsPreviouslyDiscoveredResourcesAndPrivateErrors() throws Exception {
        String owner = registerAndLogin("scan_failure");
        try (var dav = new ScanWebDavServer()) {
            var input = dav.input();
            String sourceId = (String) data(check(call("/media-sources", input, owner), 201, "OK")).get("id");
            String scans = "/media-sources/" + sourceId + "/scans";
            check(put("/media-sources/" + sourceId + "/scan-roots", Map.of("paths", List.of("/selected")), owner), 200, "OK");
            String taskId = (String) data(check(postEmpty(scans, owner), 202, "OK")).get("id");
            assertEquals("completed", awaitScan(scans, taskId, owner).get("status"));
            dav.failChild.set(true);
            String failedId = (String) data(check(postEmpty(scans, owner), 202, "OK")).get("id");
            var failed = awaitScan(scans, failedId, owner);
            assertEquals("failed", failed.get("status")); assertNotNull(failed.get("errorCode"));
            assertNotNull(failed.get("errorMessage")); assertNotNull(failed.get("finishedAt"));
            assertSourceFailurePrivate(call(scans, null, owner), input);
            assertEquals(3, db.queryForObject("SELECT COUNT(*) FROM media_resource", Integer.class));
        }
    }

    @Test void disabledSourceOrMissingEnabledRootsCannotCreateScans() throws Exception {
        String owner = registerAndLogin("scan_validation");
        try (var dav = new ScanWebDavServer()) {
            String sourceId = (String) data(check(call("/media-sources", dav.input(), owner), 201, "OK")).get("id");
            String scans = "/media-sources/" + sourceId + "/scans";
            int requests = dav.requests.get();
            check(postEmpty(scans, owner), 409, "SCAN_ROOTS_REQUIRED");
            check(postEmpty(scans + "?userId=other", owner), 400, "VALIDATION_FAILED");
            db.update("UPDATE media_source SET enabled=0 WHERE id=?", sourceId);
            check(postEmpty(scans, owner), 409, "SOURCE_DISABLED");
            assertEquals(requests, dav.requests.get());
            assertEquals(0, db.queryForObject("SELECT COUNT(*) FROM scan_task", Integer.class));
        }
    }

    HttpResponse<String> postEmpty(String path, String token) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api" + path))
                .header("Authorization", "Bearer " + token).POST(HttpRequest.BodyPublishers.noBody()).build();
        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }
    Map<String, Object> awaitScan(String path, String id, String token) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(8);
        while (System.nanoTime() < deadline) {
            var tasks = objectList(check(call(path, null, token), 200, "OK").get("data"));
            for (var task : tasks) if (id.equals(task.get("id")) && Set.of("completed", "failed").contains(task.get("status"))) return task;
            Thread.sleep(20);
        }
        throw new AssertionError("Scan did not finish within test deadline");
    }
    @SuppressWarnings("unchecked") List<Map<String, Object>> objectList(Object value) { return (List<Map<String, Object>>) value; }

    static final class ScanWebDavServer implements AutoCloseable {
        // 保留开发库实际发行命名结构，片名和发行组脱敏。
        static final String RELEASE_NAME = "Example.Saga.Sequel.Uncut.2004.2160p.BluRay.REMUX.DV.HDR.HEVC.TrueHD.7.1.Atmos-GROUP.mkv";
        // 合法路径保留 NBSP、窄 NBSP、全角空格和 FEFF；仅派生命名候选规范化空白。
        static final String UNICODE_SPACE_NAME = "\u00a0\ufeffExample\u202fWhitespace\u3000Movie\u00a0.2021.[Extended\u00a0Cut].1080p.MOV";
        final HttpServer server;
        final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        final AtomicInteger requests = new AtomicInteger(), outsideRequests = new AtomicInteger();
        final AtomicBoolean block = new AtomicBoolean(), failChild = new AtomicBoolean();
        final CountDownLatch entered = new CountDownLatch(1), release = new CountDownLatch(1);
        ScanWebDavServer() throws Exception {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0); server.setExecutor(executor);
            server.createContext("/", exchange -> {
                try (exchange) {
                    exchange.getRequestBody().readAllBytes(); requests.incrementAndGet();
                    String path = exchange.getRequestURI().getPath(), raw = exchange.getRequestURI().getRawPath();
                    String depth = exchange.getRequestHeaders().getFirst("Depth");
                    String expected = "Basic " + Base64.getEncoder().encodeToString("scan-dav-user:scan-dav-secret".getBytes(StandardCharsets.UTF_8));
                    int status = 207; String body;
                    if (!expected.equals(exchange.getRequestHeaders().getFirst("Authorization"))) { status = 401; body = "scan-dav-secret"; }
                    else if (failChild.get() && path.equals("/dav/selected/sub/")) { status = 503; body = "scan-dav-secret"; }
                    else {
                        body = node(raw, true);
                        if ("1".equals(depth) && path.equals("/dav/selected/")) {
                            if (block.get()) { entered.countDown(); try { release.await(5, TimeUnit.SECONDS); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } }
                            body += node(raw + RELEASE_NAME, false) + node(raw + "%E7%94%B5%E5%BD%B1%20%23100%25.mp4", false)
                                    + node(raw + "notes.txt", false) + node(raw + "sub/", true);
                        } else if ("1".equals(depth) && path.equals("/dav/selected/sub/"))
                            body += node(raw + URLEncoder.encode(UNICODE_SPACE_NAME, StandardCharsets.UTF_8).replace("+", "%20"), false);
                        else if ("1".equals(depth) && path.equals("/dav/other/")) { outsideRequests.incrementAndGet(); body += node(raw + "outside.mkv", false); }
                        body = "<d:multistatus xmlns:d=\"DAV:\">" + body + "</d:multistatus>";
                    }
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8); exchange.sendResponseHeaders(status, bytes.length); exchange.getResponseBody().write(bytes);
                }
            }); server.start();
        }
        Map<String, String> input() { return Map.of("name", "扫描测试来源", "address", "http://127.0.0.1:" + server.getAddress().getPort() + "/dav/", "username", "scan-dav-user", "password", "scan-dav-secret"); }
        static String node(String href, boolean directory) {
            return "<d:response><d:href>" + href + "</d:href><d:propstat><d:prop><d:resourcetype>"
                    + (directory ? "<d:collection/>" : "") + "</d:resourcetype><d:getcontentlength>1024</d:getcontentlength>"
                    + "<d:getlastmodified>Mon, 01 Jan 2024 00:00:00 GMT</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>";
        }
        @Override public void close() { release.countDown(); server.stop(0); executor.close(); }
    }

    HttpResponse<String> call(String path, Object body, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api"+path));
        if (token != null) builder.header("Authorization", "Bearer "+token);
        if (body != null) builder.header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        else builder.GET();
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
    HttpResponse<String> put(String path, Object body, String token) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:"+port+"/api"+path)).header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        if (token != null) builder.header("Authorization", "Bearer "+token);
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
    String registerAndLogin(String username) throws Exception {
        check(call("/auth/register", Map.of("username", username, "password", password), null), 201, "OK");
        return (String) data(check(call("/auth/login", Map.of("username", username, "password", password), null), 200, "OK")).get("accessToken");
    }
    void assertSourceFailurePrivate(HttpResponse<String> response, Map<String, String> input) {
        for (String field : List.of("address", "username", "password")) assertFalse(response.body().contains(input.get(field)));
        assertFalse(response.body().contains("Authorization"));
        assertFalse(response.body().contains("Basic "));
        assertFalse(response.body().contains("connection_config_ciphertext"));
    }
    Map<String, Integer> scanArtifactCounts() {
        var counts = new HashMap<String, Integer>();
        for (String table : List.of("media_scan_root", "scan_task", "media_resource", "user_movie")) {
            boolean exists = db.queryForObject("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?", Integer.class, table) != 0;
            counts.put(table, exists ? db.queryForObject("SELECT COUNT(*) FROM " + table, Integer.class) : 0);
        }
        return counts;
    }
    static final class TemporaryWebDavServer implements AutoCloseable {
        static final String USERNAME = "webdav-user-fixture";
        static final String PASSWORD = "webdav-password-fixture";
        final HttpServer server;
        final AtomicInteger davRequests = new AtomicInteger();
        final AtomicInteger directoryRequests = new AtomicInteger();
        final AtomicInteger followedRedirects = new AtomicInteger();
        final AtomicBoolean rejectCredentials = new AtomicBoolean();
        TemporaryWebDavServer() throws Exception {
            server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/", exchange -> {
                try (exchange) {
                    exchange.getRequestBody().readAllBytes();
                    String path = exchange.getRequestURI().getPath();
                    String body; int status;
                    String depth = exchange.getRequestHeaders().getFirst("Depth");
                    if (!exchange.getRequestMethod().equals("PROPFIND") || !("0".equals(depth) || "1".equals(depth))) {
                        status = 405; body = "Expected PROPFIND Depth: 0";
                    } else if (path.startsWith("/dav/") && ("1".equals(depth) || !path.equals("/dav/"))) {
                        directoryRequests.incrementAndGet();
                        String expected = "Basic " + Base64.getEncoder().encodeToString((USERNAME + ":" + PASSWORD).getBytes(StandardCharsets.UTF_8));
                        if (rejectCredentials.get() || !expected.equals(exchange.getRequestHeaders().getFirst("Authorization"))) {
                            status = 401; body = USERNAME + ":" + PASSWORD;
                        } else if (path.equals("/dav/redirect/")) {
                            status = 302; body = PASSWORD; exchange.getResponseHeaders().set("Location", address("/redirect-target/"));
                        } else if (path.equals("/dav/missing/")) {
                            status = 404; body = PASSWORD;
                        } else if (path.equals("/dav/offline/")) {
                            status = 503; body = PASSWORD;
                        } else if (path.equals("/dav/html/")) {
                            status = 200; body = "regular page " + PASSWORD;
                        } else if (path.equals("/dav/slow/")) {
                            try { Thread.sleep(1600); } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
                            status = 503; body = PASSWORD;
                        } else {
                            status = 207;
                            String encoded = exchange.getRequestURI().getRawPath();
                            body = directoryResource(encoded, !path.equals("/dav/file.mkv/"));
                            if ("1".equals(depth) && path.equals("/dav/")) body += directoryResource("/dav/empty/", true)
                                    + directoryResource("/dav/%E7%94%B5%E5%BD%B1%20%E5%BA%93%20%23%3F100%25+/", true) + directoryResource("/dav/video.mkv", false);
                            else if ("1".equals(depth) && path.equals("/dav/电影 库 #?100%+/")) body += directoryResource(encoded + "notes%20%25%23%3F.txt", false);
                            else if (path.equals("/dav/invalid/")) body += directoryResource("http://example.invalid/outside/", true);
                            body = "<d:multistatus xmlns:d=\"DAV:\">" + body + "</d:multistatus>";
                        }
                    } else if (path.equals("/dav/")) {
                        davRequests.incrementAndGet();
                        String expected = "Basic " + Base64.getEncoder().encodeToString((USERNAME + ":" + PASSWORD).getBytes(StandardCharsets.UTF_8));
                        if (rejectCredentials.get() || !expected.equals(exchange.getRequestHeaders().getFirst("Authorization"))) {
                            status = 401; body = USERNAME + ":" + PASSWORD;
                        } else {
                            status = 207;
                            body = "<d:multistatus xmlns:d=\"DAV:\"><d:response><d:href>/dav/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>";
                            exchange.getResponseHeaders().set("Content-Type", "application/xml; charset=utf-8");
                        }
                    } else if (path.equals("/redirect/")) {
                        status = 302; body = USERNAME + ":" + PASSWORD;
                        exchange.getResponseHeaders().set("Location", address("/redirect-target/" + PASSWORD));
                    } else if (path.startsWith("/redirect-target/")) {
                        followedRedirects.incrementAndGet(); status = 200; body = PASSWORD;
                    } else if (path.equals("/slow/")) {
                        try { Thread.sleep(1600); } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
                        status = 503; body = USERNAME + ":" + PASSWORD;
                    } else if (path.equals("/unavailable/")) {
                        status = 503; body = USERNAME + ":" + PASSWORD;
                    } else {
                        status = 200; body = "A regular HTTP page " + USERNAME + ":" + PASSWORD;
                    }
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(status, bytes.length);
                    exchange.getResponseBody().write(bytes);
                }
            });
            server.start();
        }
        String address(String path) { return "http://127.0.0.1:" + server.getAddress().getPort() + path; }
        Map<String, String> input(String path) { return Map.of("name", "个人 WebDAV", "address", address(path), "username", USERNAME, "password", PASSWORD); }
        static String directoryResource(String href, boolean directory) {
            return "<d:response><d:href>" + href + "</d:href><d:propstat><d:prop><d:resourcetype>"
                    + (directory ? "<d:collection/>" : "") + "</d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>";
        }
        @Override public void close() { server.stop(0); }
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
