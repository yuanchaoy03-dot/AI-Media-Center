package com.shichaoya.aimediacenter.media.infrastructure.webdav;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.shichaoya.aimediacenter.media.web.dto.MediaSourceRequest;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class WebDavMediaSourceAdapterTest {
    private HttpServer server;
    private ExecutorService executor;
    private String address;
    private final WebDavMediaSourceAdapter adapter = new WebDavMediaSourceAdapter(2000);
    private static final String DIRECTORY = """
            <?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/</d:href>
            <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
            <d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>
            """;
    @BeforeEach void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newVirtualThreadPerTaskExecutor();
        server.setExecutor(executor); server.start();
        address = "http://127.0.0.1:" + server.getAddress().getPort() + "/dav/";
    }
    @AfterEach void stopServer() { server.stop(0); executor.shutdownNow(); }
    @Test void makesReadOnlyDepthZeroRequestAndSendsExactBasicCredentials() {
        var method = new AtomicReference<String>(); var depth = new AtomicReference<String>();
        var auth = new AtomicReference<String>(); var requestBody = new AtomicReference<String>();
        server.createContext("/dav/", exchange -> {
            method.set(exchange.getRequestMethod()); depth.set(exchange.getRequestHeaders().getFirst("Depth"));
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] content = DIRECTORY.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(207, content.length); exchange.getResponseBody().write(content); exchange.close();
        });
        adapter.testConnection(new SourceConnection(address, "用户", " secret 😀 "));
        assertEquals("PROPFIND", method.get()); assertEquals("0", depth.get());
        assertEquals("Basic " + Base64.getEncoder().encodeToString("用户: secret 😀 ".getBytes(StandardCharsets.UTF_8)), auth.get());
        assertTrue(requestBody.get().contains("resourcetype"));
    }
    @Test void anonymousTestOmitsAuthorizationAndRequiresTargetCollection() {
        var auth = new AtomicReference<String>();
        server.createContext("/dav/", exchange -> {
            auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] content = DIRECTORY.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(207, content.length); exchange.getResponseBody().write(content); exchange.close();
        });
        adapter.testConnection(new SourceConnection(address, "", ""));
        assertNull(auth.get());
    }
    @Test void rejectsUnbrowsableRootInputBeforeTestingOrSavingItsConnection() {
        var requests = new AtomicInteger();
        server.createContext("/", exchange -> {
            requests.incrementAndGet();
            byte[] content = DIRECTORY.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(207, content.length); exchange.getResponseBody().write(content); exchange.close();
        });
        for (String path : new String[]{"/dav/../dav/", "/dav/%2e%2e/dav/", "/dav/%2F/", "/dav/%FF/"}) {
            var error = assertThrows(ApiException.class, () -> {
                var input = MediaSourceRequest.parse(Map.of("name", "NAS", "address", address.replace("/dav/", path),
                        "username", "", "password", ""));
                adapter.testConnection(input.connection());
            });
            assertEquals("VALIDATION_FAILED", error.code()); assertTrue(error.fieldErrors().containsKey("address"));
        }
        assertEquals(0, requests.get());
    }
    @Test void acceptedUnicodeAndEncodedRootNamesPassConnectionTestAndBrowsing() {
        server.createContext("/", exchange -> {
            String path = exchange.getRequestURI().getRawPath();
            byte[] content = DIRECTORY.replace("/dav/", path).getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(207, content.length); exchange.getResponseBody().write(content); exchange.close();
        });
        for (String path : new String[]{"/dav/中文/", "/dav/%E7%94%B5%E5%BD%B1%20%E5%BA%93/", "/dav/100%25%23%3F+/",
                "/dav/Movie%2E2020/"}) {
            var input = MediaSourceRequest.parse(Map.of("name", "NAS", "address", address.replace("/dav/", path),
                    "username", "", "password", ""));
            adapter.testConnection(input.connection());
            assertEquals("/", adapter.browseDirectory(input.connection(), "/").path());
        }
    }
    @Test void treatsUnreservedEncodingAsEquivalentButPreservesEncodedPathSeparators() {
        server.createContext("/dav/", exchange -> {
            byte[] content = DIRECTORY.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(207, content.length); exchange.getResponseBody().write(content); exchange.close();
        });
        adapter.testConnection(new SourceConnection(address.replace("/dav/", "/d%61v/"), "", ""));
        var error = assertThrows(ApiException.class, () -> adapter.testConnection(new SourceConnection(address.replace("/dav/", "/dav%2F"), "", "")));
        assertEquals("SOURCE_NOT_WEBDAV", error.code());
    }
    @Test void rejectsHttp200AndInvalidOrNonDirectoryMultistatus() {
        assertResponseError(200, "<html>login page</html>", "SOURCE_NOT_WEBDAV");
        assertResponseError(207, "<multistatus/>", "SOURCE_NOT_WEBDAV");
        assertResponseError(207, DIRECTORY.replace("/dav/", "/other/"), "SOURCE_NOT_WEBDAV");
        assertResponseError(207, DIRECTORY.replace("<d:collection/>", ""), "SOURCE_NOT_WEBDAV");
        assertResponseError(207, DIRECTORY.replace("HTTP/1.1 200 OK", "HTTP/1.1 404 Not Found"), "SOURCE_NOT_WEBDAV");
        assertResponseError(207, DIRECTORY.replace("HTTP/1.1 200 OK", "HTTP/1.1 403 Forbidden"), "SOURCE_AUTH_FAILED");
    }
    @Test void classifiesAuthAndConnectionFailuresWithoutExposingUpstreamBody() {
        assertResponseError(401, "upstream secret", "SOURCE_AUTH_FAILED");
        assertResponseError(403, "upstream secret", "SOURCE_AUTH_FAILED");
        assertResponseError(404, "upstream secret", "SOURCE_CONNECTION_FAILED");
        assertResponseError(503, "upstream secret", "SOURCE_CONNECTION_FAILED");
    }
    @Test void doesNotFollowRedirectOrForwardCredentialsToRedirectTarget() {
        var redirected = new AtomicInteger();
        server.createContext("/dav/", exchange -> {
            exchange.getResponseHeaders().set("Location", "/redirected/"); exchange.sendResponseHeaders(302, -1); exchange.close();
        });
        server.createContext("/redirected/", exchange -> { redirected.incrementAndGet(); exchange.sendResponseHeaders(401, -1); exchange.close(); });
        var error = assertThrows(ApiException.class, () -> adapter.testConnection(new SourceConnection(address, "user", "secret")));
        assertEquals("SOURCE_REDIRECT_UNSUPPORTED", error.code()); assertEquals(0, redirected.get());
    }
    @Test void rejectsDtdExternalEntitiesAndOversizedXml() {
        assertResponseError(207, DIRECTORY.replace("?>", "?><!DOCTYPE foo [<!ENTITY secret SYSTEM 'file:///should-not-be-read'>]>"), "SOURCE_NOT_WEBDAV");
        assertResponseError(207, DIRECTORY + " ".repeat(129 * 1024), "SOURCE_NOT_WEBDAV");
    }
    @Test void rejectsDeeplyNestedHrefBelowTheConnectionBodySizeLimit() {
        String body = DIRECTORY.replace("/dav/", "<x>".repeat(12000) + "/dav/" + "</x>".repeat(12000));
        assertTrue(body.getBytes(StandardCharsets.UTF_8).length < 128 * 1024);
        assertResponseError(207, body, "SOURCE_NOT_WEBDAV");
    }
    @Test void boundsSlowResponseBodyAfterHeadersArrive() {
        server.createContext("/dav/", exchange -> {
            exchange.sendResponseHeaders(207, 0); exchange.getResponseBody().write("<d:".getBytes(StandardCharsets.UTF_8));
            exchange.getResponseBody().flush();
            try { Thread.sleep(1000); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
            exchange.close();
        });
        long started = System.nanoTime();
        var error = assertThrows(ApiException.class, () -> new WebDavMediaSourceAdapter(100).testConnection(new SourceConnection(address, "", "")));
        assertEquals(504, error.status()); assertEquals("SOURCE_CONNECTION_TIMEOUT", error.code());
        assertTrue((System.nanoTime() - started) / 1_000_000 < 900);
    }
    @Test void refusesObviousMetadataAndNonRoutableTargetsBeforeNetworkAccess() {
        for (String target : new String[]{"http://169.254.169.254/", "http://0.0.0.0/", "http://224.0.0.1/", "http://[fe80::1]/", "http://[fd00:ec2::254]/", "http://metadata.google.internal/"}) {
            var error = assertThrows(ApiException.class, () -> adapter.testConnection(new SourceConnection(target, "", "")));
            assertEquals(400, error.status()); assertTrue(error.fieldErrors().containsKey("address"));
        }
    }
    @Test void connectionTestDoesNotNormalizeRepeatedSlashHrefsToTheRequestedRoot() {
        for (String href : new String[]{"/dav//", "dav//", address + "/"}) {
            assertResponseError(207, DIRECTORY.replace("/dav/", href), "SOURCE_NOT_WEBDAV");
        }
    }
    private void assertResponseError(int status, String body, String code) {
        try { server.removeContext("/dav/"); } catch (IllegalArgumentException ignored) {}
        server.createContext("/dav/", exchange -> {
            byte[] content = body.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, content.length); exchange.getResponseBody().write(content); exchange.close();
        });
        var error = assertThrows(ApiException.class, () -> adapter.testConnection(new SourceConnection(address, "user", "secret")));
        assertEquals(code, error.code()); assertEquals(422, error.status());
        assertFalse(error.getMessage().contains("upstream secret"));
    }
}
