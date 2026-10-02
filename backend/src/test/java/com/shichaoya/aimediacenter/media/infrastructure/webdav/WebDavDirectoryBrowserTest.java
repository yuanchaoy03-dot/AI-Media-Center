package com.shichaoya.aimediacenter.media.infrastructure.webdav;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.domain.MediaDirectory;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class WebDavDirectoryBrowserTest {
    private HttpServer server;
    private ExecutorService executor;
    private String address;
    private final WebDavMediaSourceAdapter adapter = new WebDavMediaSourceAdapter(2000);
    private final AtomicInteger status = new AtomicInteger(207);
    private final AtomicReference<String> xml = new AtomicReference<>();
    private final AtomicReference<String> method = new AtomicReference<>(), depth = new AtomicReference<>(), auth = new AtomicReference<>(), rawPath = new AtomicReference<>();
    private final AtomicInteger requests = new AtomicInteger();
    @BeforeEach void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newVirtualThreadPerTaskExecutor(); server.setExecutor(executor);
        server.createContext("/", exchange -> {
            try (exchange) {
                requests.incrementAndGet(); method.set(exchange.getRequestMethod());
                depth.set(exchange.getRequestHeaders().getFirst("Depth")); auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
                rawPath.set(exchange.getRequestURI().getRawPath()); exchange.getRequestBody().readAllBytes();
                exchange.getResponseHeaders().set("Location", "/redirect-target/");
                byte[] bytes = xml.get().getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(status.get(), bytes.length); exchange.getResponseBody().write(bytes);
            }
        });
        server.start(); address = "http://127.0.0.1:" + server.getAddress().getPort() + "/dav/";
        xml.set(listing(resource("/dav/", true)));
    }
    @AfterEach void stop() { server.stop(0); executor.shutdownNow(); }

    @Test void requestsDepthOneAndReturnsOnlyDecodedDirectItemsWithoutRemoteUrls() {
        xml.set(listing(resource("/dav/video%20%23%3F100%25%2B.mkv", false), resource("/dav/", true), resource("/dav/%E7%94%B5%E5%BD%B1%20%E5%BA%93/", true)));
        var result = adapter.browseDirectory(new SourceConnection(address, "用户", " secret 😀 "), "/");
        assertEquals("PROPFIND", method.get()); assertEquals("1", depth.get());
        assertEquals("Basic " + Base64.getEncoder().encodeToString("用户: secret 😀 ".getBytes(StandardCharsets.UTF_8)), auth.get());
        assertEquals("/", result.path());
        assertEquals(List.of(new MediaDirectory.Entry("电影 库", "/电影 库", "directory"), new MediaDirectory.Entry("video #?100%+.mkv", "/video #?100%+.mkv", "file")), result.entries());
        assertThrows(UnsupportedOperationException.class, () -> result.entries().clear());
    }
    @Test void encodesChildRequestsExactlyOnceUnderEncodedRootAndAcceptsAbsoluteOrRelativeHrefs() {
        String rootAddress = address.replace("/dav/", "/dav%20root%25/");
        String child = "/电影 #?100%+";
        String encoded = "/dav%20root%25/%E7%94%B5%E5%BD%B1%20%23%3F100%25+/";
        xml.set(listing(resource(rootAddress.replace("/dav%20root%25/", encoded), true), resource("note%20%25%23%3F.txt", false)));
        var result = adapter.browseDirectory(new SourceConnection(rootAddress, "", ""), child + "/");
        assertEquals(encoded, rawPath.get()); assertNull(auth.get());
        assertEquals(child, result.path());
        assertEquals(List.of(new MediaDirectory.Entry("note %#?.txt", child + "/note %#?.txt", "file")), result.entries());
    }
    @Test void allowsEmptyDirectoriesAndMapsMissingOrFileTargetsToDirectoryNotFound() {
        assertEquals(List.of(), browse().entries());
        assertError(404, "private upstream body", "SOURCE_DIRECTORY_NOT_FOUND", 404);
        assertError(207, listing(resource("/dav/", false)), "SOURCE_DIRECTORY_NOT_FOUND", 404);
        assertError(207, listing(resource("/dav/", true).replace("200 OK", "404 Not Found")), "SOURCE_DIRECTORY_NOT_FOUND", 404);
    }
    @Test void acceptsRootAddressesWithoutAnyPathOrTrailingSlash() {
        String origin = address.substring(0, address.length() - "/dav/".length());
        xml.set(listing(resource("/", true), resource("child/", true)));
        assertEquals(List.of(new MediaDirectory.Entry("child", "/child", "directory")),
                adapter.browseDirectory(new SourceConnection(origin, "", ""), "/").entries());
        xml.set(listing(resource("/dav/", true), resource("child/", true)));
        assertEquals(List.of(new MediaDirectory.Entry("child", "/child", "directory")),
                adapter.browseDirectory(new SourceConnection(address.substring(0, address.length() - 1), "", ""), "/").entries());
    }
    @Test void rejectsEveryInvalidHrefInsteadOfSilentlyReturningPartialListings() {
        for (String href : List.of("http://example.invalid/dav/x/", "https://127.0.0.1/dav/x/", "/dav2/x/", "/other/x/",
                "/dav/child/grandchild/", "/dav/../dav/x/", "/dav/%2e%2e/dav/x/", "/dav/x%2Fy/", "/dav/x%5Cy/", "/dav/%252f/",
                "/dav/x/?secret=y", "/dav/x/#fragment", "/dav/%C0%AF/", "/dav/%ED%A0%80/", "/dav/x\\y/")) {
            assertError(207, listing(resource("/dav/", true), resource(href, true)), "SOURCE_DIRECTORY_INVALID", 422);
        }
    }
    @Test void rejectsIncompleteDuplicateMalformedAndOverLimitResponses() {
        assertError(207, listing(resource("/dav/child/", true)), "SOURCE_DIRECTORY_INVALID", 422);
        assertError(207, listing(resource("/dav/", true), resource("/dav/x/", true), resource("/dav/x", false)), "SOURCE_DIRECTORY_INVALID", 422);
        assertError(207, listing(resource("/dav/", true), resource("/dav/x", false).replace("<d:resourcetype></d:resourcetype>", "")), "SOURCE_DIRECTORY_INVALID", 422);
        assertError(207, listing(resource("/dav/", true), resource("/dav/x", false).replace("200 OK", "404 Not Found")), "SOURCE_DIRECTORY_INVALID", 422);
        assertError(207, "<multistatus/>", "SOURCE_DIRECTORY_INVALID", 422);
        assertError(207, "<d:multistatus xmlns:d=\"DAV:\">", "SOURCE_DIRECTORY_INVALID", 422);
        assertError(207, listing(resource("/dav/", true)) + " ".repeat(1024 * 1024), "SOURCE_DIRECTORY_INVALID", 422);
        var many = new StringBuilder(resource("/dav/", true));
        for (int i = 0; i <= WebDavDirectoryReader.MAX_ENTRIES; i++) many.append(resource("/dav/entry-" + i, false));
        assertError(207, listing(many.toString()), "SOURCE_DIRECTORY_INVALID", 422);
    }
    @Test void keepsAuthenticationRedirectAndHttpErrorsPrivateWithoutFollowingRedirects() {
        assertError(401, "fixture-private", "SOURCE_AUTH_FAILED", 422);
        assertError(403, "fixture-private", "SOURCE_AUTH_FAILED", 422);
        int previous = requests.get();
        assertError(302, "fixture-private", "SOURCE_REDIRECT_UNSUPPORTED", 422); assertEquals(previous + 1, requests.get());
        assertError(200, "regular HTTP page", "SOURCE_NOT_WEBDAV", 422);
        assertError(503, "fixture-private", "SOURCE_CONNECTION_FAILED", 422);
        assertError(207, listing(resource("/dav/", true).replace("200 OK", "403 Forbidden")), "SOURCE_AUTH_FAILED", 422);
    }
    @Test void rejectsDtdBeforeReadingExternalResources() {
        String body = "<?xml version=\"1.0\"?><!DOCTYPE d:multistatus [<!ENTITY secret SYSTEM 'http://127.0.0.1/secret'>]>" + listing(resource("/dav/", true));
        assertError(207, body, "SOURCE_DIRECTORY_INVALID", 422);
        assertEquals(1, requests.get());
    }
    @Test void boundsSlowDirectoryBodiesAfterHeaders() {
        server.removeContext("/");
        server.createContext("/", exchange -> {
            try (exchange) {
                exchange.sendResponseHeaders(207, 0); exchange.getResponseBody().write("<d:".getBytes(StandardCharsets.UTF_8)); exchange.getResponseBody().flush();
                try { Thread.sleep(1000); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
            }
        });
        long started = System.nanoTime();
        var error = assertThrows(ApiException.class, () -> new WebDavMediaSourceAdapter(100).browseDirectory(new SourceConnection(address, "", ""), "/"));
        assertEquals(504, error.status()); assertEquals("SOURCE_CONNECTION_TIMEOUT", error.code());
        assertTrue((System.nanoTime() - started) / 1_000_000 < 900);
    }
    @Test void refusesInvalidSourcePathsBeforeNetworkAndKeepsDepthZeroLimitSeparate() {
        for (String path : List.of("/../outside", "/a%2fb", "//host/dav/", "/a\\b")) {
            assertEquals("VALIDATION_FAILED", assertThrows(ApiException.class, () -> adapter.browseDirectory(new SourceConnection(address, "", ""), path)).code());
        }
        assertEquals(0, requests.get());
        xml.set(listing(resource("/dav/", true)) + " ".repeat(129 * 1024));
        assertEquals(List.of(), browse().entries());
        assertEquals("SOURCE_NOT_WEBDAV", assertThrows(ApiException.class, () -> adapter.testConnection(new SourceConnection(address, "", ""))).code());
    }
    private MediaDirectory browse() { return adapter.browseDirectory(new SourceConnection(address, "", ""), "/"); }
    private void assertError(int httpStatus, String body, String code, int expectedStatus) {
        status.set(httpStatus); xml.set(body);
        var error = assertThrows(ApiException.class, this::browse);
        assertEquals(code, error.code()); assertEquals(expectedStatus, error.status());
        assertFalse(error.getMessage().contains("fixture-private"));
    }
    static String listing(String... resources) { return "<d:multistatus xmlns:d=\"DAV:\">" + String.join("", resources) + "</d:multistatus>"; }
    static String resource(String href, boolean directory) {
        return "<d:response><d:href>" + href.replace("&", "&amp;").replace("<", "&lt;") + "</d:href><d:propstat><d:prop><d:resourcetype>"
                + (directory ? "<d:collection/>" : "") + "</d:resourcetype></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>";
    }
}
