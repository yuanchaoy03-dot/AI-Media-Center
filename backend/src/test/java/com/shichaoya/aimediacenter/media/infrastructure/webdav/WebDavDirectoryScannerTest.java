package com.shichaoya.aimediacenter.media.infrastructure.webdav;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.domain.MediaFileDirectory;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static com.shichaoya.aimediacenter.media.infrastructure.webdav.WebDavDirectoryBrowserTest.listing;
import static com.shichaoya.aimediacenter.media.infrastructure.webdav.WebDavDirectoryBrowserTest.resource;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WebDavDirectoryScannerTest {
    private HttpServer server;
    private ExecutorService executor;
    private String address;
    private final WebDavMediaSourceAdapter adapter = new WebDavMediaSourceAdapter(2000);
    private final AtomicReference<String> xml = new AtomicReference<>();
    private final AtomicInteger status = new AtomicInteger(207), requests = new AtomicInteger();
    private final AtomicReference<String> method = new AtomicReference<>(), depth = new AtomicReference<>(),
            auth = new AtomicReference<>(), requestBody = new AtomicReference<>(), rawPath = new AtomicReference<>();

    @BeforeEach void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        executor = Executors.newVirtualThreadPerTaskExecutor(); server.setExecutor(executor);
        server.createContext("/", exchange -> {
            try (exchange) {
                requests.incrementAndGet(); method.set(exchange.getRequestMethod());
                depth.set(exchange.getRequestHeaders().getFirst("Depth"));
                auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
                rawPath.set(exchange.getRequestURI().getRawPath());
                requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
                exchange.getResponseHeaders().set("Location", "/redirect-target/");
                byte[] content = xml.get().getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(status.get(), content.length); exchange.getResponseBody().write(content);
            }
        });
        server.start(); address = "http://127.0.0.1:" + server.getAddress().getPort() + "/dav/";
        xml.set(listing(resource("/dav/", true)));
    }
    @AfterEach void stop() { server.stop(0); executor.shutdownNow(); }

    @Test void requestsOnlyMetadataAndReturnsDecodedStablePathsAndNullableFileFacts() {
        xml.set(listing(resource("/dav/", true), resource("/dav/%E7%94%B5%E5%BD%B1/", true),
                withFacts("/dav/movie%20%23%3F100%25%2B.mkv", "4294967296", "Wed, 02 Oct 2024 10:11:12 GMT")));
        var result = adapter.scanDirectory(new SourceConnection(address, "用户", " secret 😀 "), "/", deadline(5000));
        assertEquals("PROPFIND", method.get()); assertEquals("1", depth.get());
        assertEquals("Basic " + Base64.getEncoder().encodeToString("用户: secret 😀 ".getBytes(StandardCharsets.UTF_8)), auth.get());
        assertTrue(requestBody.get().contains("<d:resourcetype/>"));
        assertTrue(requestBody.get().contains("<d:getcontentlength/>"));
        assertTrue(requestBody.get().contains("<d:getlastmodified/>"));
        assertEquals("/", result.path());
        assertEquals(List.of(new MediaFileDirectory.Entry("电影", "/电影", "directory", null, null),
                new MediaFileDirectory.Entry("movie #?100%+.mkv", "/movie #?100%+.mkv", "file", 4294967296L,
                        Instant.parse("2024-10-02T10:11:12Z"))), result.entries());
        assertThrows(UnsupportedOperationException.class, () -> result.entries().clear());
    }

    @Test void unavailableInvalidNegativeOverflowAndAmbiguousFactsRemainNull() {
        for (String size : List.of("-1", "9223372036854775808", "NaN", "1.5", "")) {
            xml.set(listing(resource("/dav/", true), withFacts("/dav/movie.mkv", size, "Thu, 30 Feb 2024 10:00:00 GMT")));
            var item = scan().entries().getFirst(); assertNull(item.size()); assertNull(item.modifiedAt());
        }
        xml.set(listing(resource("/dav/", true), withFacts("/dav/movie.mkv", "0", "malformed")));
        assertEquals(0L, scan().entries().getFirst().size()); assertNull(scan().entries().getFirst().modifiedAt());
        String unsupported = resource("/dav/movie.mkv", false).replace("</d:response>",
                "<d:propstat><d:prop><d:getcontentlength/><d:getlastmodified/></d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat></d:response>");
        xml.set(listing(resource("/dav/", true), unsupported));
        assertNull(scan().entries().getFirst().size()); assertNull(scan().entries().getFirst().modifiedAt());
        xml.set(listing(resource("/dav/", true), withFacts("/dav/movie.mkv", "12", "malformed")
                .replace("</d:getcontentlength>", "</d:getcontentlength><d:getcontentlength>13</d:getcontentlength>")));
        assertNull(scan().entries().getFirst().size());
        xml.set(listing(resource("/dav/", true), withFacts("/dav/movie.mkv", "<d:invalid>12</d:invalid>", "malformed")));
        assertNull(scan().entries().getFirst().size());
    }

    @Test void deniedOptionalFactsBeforeOrAfterResourceTypeDoNotPreventScanning() {
        for (String deniedStatus : List.of("401 Unauthorized", "403 Forbidden")) {
            for (boolean before : List.of(true, false)) {
                String current = withPropstat(resource("/dav/", true),
                        "<d:getcontentlength/><d:getlastmodified/>", deniedStatus, before);
                String deniedSize = withPropstat(withFacts("/dav/denied-size.mkv", "512", "Wed, 02 Oct 2024 10:11:12 GMT")
                        .replace("<d:getcontentlength>512</d:getcontentlength>", ""),
                        "<d:getcontentlength/>", deniedStatus, before);
                String deniedTime = withPropstat(withFacts("/dav/denied-time.mkv", "512", "Wed, 02 Oct 2024 10:11:12 GMT")
                        .replace("<d:getlastmodified>Wed, 02 Oct 2024 10:11:12 GMT</d:getlastmodified>", ""),
                        "<d:getlastmodified/>", deniedStatus, before);
                xml.set(listing(current, deniedSize, deniedTime));

                var result = scan();
                assertEquals("/", result.path());
                assertEquals(List.of(new MediaFileDirectory.Entry("denied-size.mkv", "/denied-size.mkv", "file", null,
                                Instant.parse("2024-10-02T10:11:12Z")),
                        new MediaFileDirectory.Entry("denied-time.mkv", "/denied-time.mkv", "file", 512L, null)), result.entries());
            }
        }
    }

    @Test void requiredResourceAndHttpAuthenticationFailuresRemainFatal() {
        for (String deniedStatus : List.of("401 Unauthorized", "403 Forbidden")) {
            assertError(Integer.parseInt(deniedStatus.substring(0, 3)), "fixture-private", "SOURCE_AUTH_FAILED");
            for (boolean currentDenied : List.of(true, false)) {
                String current = resource("/dav/", true), file = resource("/dav/movie.mkv", false);
                String responseDenied = (currentDenied ? current : file).replace("</d:href>",
                        "</d:href><d:status>HTTP/1.1 " + deniedStatus + "</d:status>");
                assertError(207, listing(currentDenied ? responseDenied : current, currentDenied ? file : responseDenied),
                        "SOURCE_AUTH_FAILED");
                String typeDenied = (currentDenied ? current : file).replace("200 OK", deniedStatus);
                assertError(207, listing(currentDenied ? typeDenied : current, currentDenied ? file : typeDenied),
                        "SOURCE_AUTH_FAILED");
            }
        }
    }

    @Test void deniedOptionalFactsCannotReplaceMissingResourceType() {
        for (String deniedStatus : List.of("401 Unauthorized", "403 Forbidden")) {
            String current = resource("/dav/", true), file = resource("/dav/movie.mkv", false);
            String missingCurrentType = withPropstat(current.replace("<d:resourcetype><d:collection/></d:resourcetype>", ""),
                    "<d:getcontentlength/><d:getlastmodified/>", deniedStatus, true);
            assertError(207, listing(missingCurrentType, file), "SOURCE_DIRECTORY_INVALID");
            String missingFileType = withPropstat(file.replace("<d:resourcetype></d:resourcetype>", ""),
                    "<d:getcontentlength/><d:getlastmodified/>", deniedStatus, false);
            assertError(207, listing(current, missingFileType), "SOURCE_DIRECTORY_INVALID");
        }
    }

    @Test void encodedRootsAndRelativeHrefsPreserveTheSameSourceLocator() {
        String rootAddress = address.replace("/dav/", "/dav%20root%25/");
        String child = "/电影 #?100%+";
        String encoded = "/dav%20root%25/%E7%94%B5%E5%BD%B1%20%23%3F100%25+/";
        xml.set(listing(resource(rootAddress.replace("/dav%20root%25/", encoded), true), withFacts("note%20%25%23%3F.mkv", "512", "Wed, 02 Oct 2024 10:11:12 GMT")));
        var result = adapter.scanDirectory(new SourceConnection(rootAddress, "", ""), child + "/", deadline(5000));
        assertEquals(encoded, rawPath.get()); assertNull(auth.get());
        assertEquals(child, result.path());
        assertEquals(child + "/note %#?.mkv", result.entries().getFirst().path());
    }

    @Test void scanningAppliesTheCodePointBudgetOnlyAfterRemovingTheConnectionRoot() {
        String origin = address.substring(0, address.length() - "/dav/".length());
        for (String rootPrefix : List.of("/", "/dav/", "/dav%20root%25/")) {
            for (String character : List.of("x", "😀")) {
                String directory = ("/" + character.repeat(254)).repeat(8);
                String file = directory + "/abc.mkv";
                assertEquals(2048, file.codePointCount(0, file.length()));
                String remoteDirectory = rootPrefix + URI.create(directory).toASCIIString().substring(1) + "/";
                xml.set(listing(resource(origin + remoteDirectory, true),
                        withFacts(origin + remoteDirectory + "abc.mkv", "512", "Wed, 02 Oct 2024 10:11:12 GMT")));
                var result = adapter.scanDirectory(new SourceConnection(origin + rootPrefix, "", ""), directory, deadline(5000));
                assertEquals(directory, result.path()); assertEquals(remoteDirectory, rawPath.get());
                assertEquals(List.of(new MediaFileDirectory.Entry("abc.mkv", file, "file", 512L,
                        Instant.parse("2024-10-02T10:11:12Z"))), result.entries());
            }
        }
    }

    @Test void scanningStillRejectsSourceRelativeChildrenAboveTheBudget() {
        String directory = ("/" + "x".repeat(254)).repeat(8);
        String remoteDirectory = "/dav" + directory + "/";
        xml.set(listing(resource(remoteDirectory, true), withFacts(remoteDirectory + "abcd.mkv", "512", "malformed")));
        var error = assertThrows(ApiException.class,
                () -> adapter.scanDirectory(new SourceConnection(address, "", ""), directory, deadline(5000)));
        assertEquals("SOURCE_DIRECTORY_INVALID", error.code()); assertEquals(422, error.status());
    }

    @Test void failsWholeDirectoryOnCrossOriginEscapesGrandchildrenOrDuplicateLocators() {
        for (String href : List.of("http://example.invalid/dav/x.mkv", "/dav2/x.mkv", "/dav/child/grandchild.mkv",
                "/dav/../dav/x.mkv", "/dav/%2e%2e/dav/x.mkv", "/dav/x%2Fy.mkv", "/dav/%252f/x.mkv", "/dav/x.mkv?secret=y")) {
            assertError(207, listing(resource("/dav/", true), resource("/dav/valid.mkv", false), resource(href, false)), "SOURCE_DIRECTORY_INVALID");
        }
        assertError(207, listing(resource("/dav/", true), resource("/dav/x.mkv", false), resource("/dav/%78.mkv", false)), "SOURCE_DIRECTORY_INVALID");
        assertError(207, listing(resource("/dav/movie.mkv", false)), "SOURCE_DIRECTORY_INVALID");
    }

    @Test void rejectsOversizedOverLimitAndDtdResponsesWithoutReturningPartialData() {
        assertError(207, listing(resource("/dav/", true)) + " ".repeat(1024 * 1024), "SOURCE_DIRECTORY_INVALID");
        var many = new StringBuilder(resource("/dav/", true));
        for (int i = 0; i <= WebDavDirectoryReader.MAX_ENTRIES; i++) many.append(resource("/dav/entry-" + i, false));
        assertError(207, listing(many.toString()), "SOURCE_DIRECTORY_INVALID");
        assertError(207, "<!DOCTYPE d:multistatus [<!ENTITY secret SYSTEM 'http://127.0.0.1/secret'>]>" + listing(resource("/dav/", true)), "SOURCE_DIRECTORY_INVALID");
    }

    @Test void deepHrefOrStatusReturnsADirectoryErrorForEveryDirectoryOperation() {
        var connection = new SourceConnection(address, "", "");
        for (String value : List.of("/dav/", "HTTP/1.1 200 OK")) {
            String body = listing(resource("/dav/", true)).replace(value,
                    "<x>".repeat(12000) + value + "</x>".repeat(12000));
            assertTrue(body.getBytes(StandardCharsets.UTF_8).length < 128 * 1024);
            xml.set(body);
            for (Runnable operation : List.<Runnable>of(() -> adapter.browseDirectory(connection, "/"),
                    () -> adapter.validateDirectories(connection, List.of("/")), () -> scan())) {
                var error = assertThrows(ApiException.class, operation::run);
                assertEquals("SOURCE_DIRECTORY_INVALID", error.code());
                assertEquals(422, error.status());
            }
        }
    }

    @Test void mapsHttpAndPropstatErrorsWithoutExposingPrivateUpstreamDetailsOrFollowingRedirects() {
        assertError(404, "fixture-private", "SOURCE_DIRECTORY_NOT_FOUND");
        assertError(401, "fixture-private", "SOURCE_AUTH_FAILED");
        assertError(403, "fixture-private", "SOURCE_AUTH_FAILED");
        int previous = requests.get();
        assertError(302, "fixture-private", "SOURCE_REDIRECT_UNSUPPORTED"); assertEquals(previous + 1, requests.get());
        assertError(503, "fixture-private", "SOURCE_CONNECTION_FAILED");
        assertError(207, listing(resource("/dav/", true), withFacts("/dav/movie.mkv", "100", "malformed")
                .replace("200 OK", "403 Forbidden")), "SOURCE_AUTH_FAILED");
    }

    @Test void expiredDeadlineStopsBeforeAnyRequestAndSlowBodiesCannotReturnEmptyOrPartialResults() {
        var error = assertThrows(ApiException.class, () -> adapter.scanDirectory(new SourceConnection(address, "", ""), "/", System.nanoTime() - 1));
        assertEquals("SCAN_TIMEOUT", error.code()); assertEquals(504, error.status()); assertEquals(0, requests.get());
        server.removeContext("/");
        server.createContext("/", exchange -> {
            try (exchange) {
                exchange.getRequestBody().readAllBytes(); exchange.sendResponseHeaders(207, 0);
                exchange.getResponseBody().write("<d:".getBytes(StandardCharsets.UTF_8)); exchange.getResponseBody().flush();
                try { Thread.sleep(1000); } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
            }
        });
        long started = System.nanoTime();
        error = assertThrows(ApiException.class, () -> adapter.scanDirectory(new SourceConnection(address, "", ""), "/", deadline(200)));
        assertEquals("SCAN_TIMEOUT", error.code()); assertEquals(504, error.status());
        assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started) < 900);
    }

    @Test void subMillisecondOverallBudgetStopsBeforeAnyRequest() {
        var error = assertThrows(ApiException.class, () -> adapter.scanDirectory(new SourceConnection(address, "", ""), "/",
                System.nanoTime() + TimeUnit.MICROSECONDS.toNanos(500)));
        assertEquals("SCAN_TIMEOUT", error.code()); assertEquals(504, error.status()); assertEquals(0, requests.get());
    }

    @Test void perRequestTimeoutRemainsConnectionTimeoutWhenOverallBudgetIsAvailable() {
        server.removeContext("/");
        server.createContext("/", exchange -> {
            try (exchange) {
                exchange.getRequestBody().readAllBytes(); exchange.sendResponseHeaders(207, 0);
                exchange.getResponseBody().write("<d:".getBytes(StandardCharsets.UTF_8)); exchange.getResponseBody().flush();
                try { Thread.sleep(1000); } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
            }
        });
        long started = System.nanoTime(), overallDeadline = deadline(5000);
        var error = assertThrows(ApiException.class, () -> new WebDavMediaSourceAdapter(100)
                .scanDirectory(new SourceConnection(address, "", ""), "/", overallDeadline));
        assertEquals("SOURCE_CONNECTION_TIMEOUT", error.code()); assertEquals(504, error.status());
        assertTrue(System.nanoTime() < overallDeadline);
        assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started) < 900);
    }

    @Test void connectionTimeoutUsesItsOwnBudgetUnlessOverallDeadlineExpiresEarlier() {
        var client = mock(HttpClient.class);
        var builder = mock(HttpClient.Builder.class, RETURNS_SELF);
        when(builder.build()).thenReturn(client);
        when(client.<byte[]>sendAsync(any(), any())).thenReturn(CompletableFuture.failedFuture(
                new HttpConnectTimeoutException("fixture-private")));
        try (var factory = mockStatic(HttpClient.class)) {
            factory.when(HttpClient::newBuilder).thenReturn(builder);
            var connectionAdapter = new WebDavMediaSourceAdapter(8000);
            var connection = new SourceConnection(address, "", "");
            var independent = assertThrows(ApiException.class, () -> connectionAdapter.scanDirectory(connection, "/", deadline(4000)));
            assertEquals("SOURCE_CONNECTION_TIMEOUT", independent.code()); assertEquals(504, independent.status());
            var overall = assertThrows(ApiException.class, () -> connectionAdapter.scanDirectory(connection, "/", deadline(1000)));
            assertEquals("SCAN_TIMEOUT", overall.code()); assertEquals(504, overall.status());
            assertFalse(independent.getMessage().contains("fixture-private"));
            assertFalse(overall.getMessage().contains("fixture-private"));
        }
        assertEquals(0, requests.get());
    }

    @Test void sequentialDirectoryReadsShareTheCallerDeadline() {
        server.removeContext("/");
        server.createContext("/", exchange -> {
            try (exchange) {
                requests.incrementAndGet(); exchange.getRequestBody().readAllBytes();
                byte[] body = listing(resource(exchange.getRequestURI().getRawPath(), true)).getBytes(StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(207, body.length); exchange.getResponseBody().flush();
                try { Thread.sleep(180); } catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); }
                exchange.getResponseBody().write(body);
            }
        });
        long started = System.nanoTime(), deadline = deadline(500);
        var error = assertThrows(ApiException.class, () -> {
            for (String path : List.of("/a", "/b", "/c", "/d")) adapter.scanDirectory(new SourceConnection(address, "", ""), path, deadline);
        });
        assertEquals("SCAN_TIMEOUT", error.code()); assertEquals(504, error.status()); assertTrue(requests.get() < 4);
        assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started) < 950);
    }

    private MediaFileDirectory scan() { return adapter.scanDirectory(new SourceConnection(address, "", ""), "/", deadline(5000)); }
    private static long deadline(long millis) { return System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(millis); }
    private void assertError(int httpStatus, String body, String code) {
        status.set(httpStatus); xml.set(body);
        var error = assertThrows(ApiException.class, this::scan);
        assertEquals(code, error.code()); assertFalse(error.getMessage().contains("fixture-private"));
    }
    private static String withFacts(String href, String size, String modified) {
        return resource(href, false).replace("</d:prop>", "<d:getcontentlength>" + size + "</d:getcontentlength><d:getlastmodified>"
                + modified + "</d:getlastmodified></d:prop>");
    }
    private static String withPropstat(String response, String properties, String status, boolean before) {
        String propstat = "<d:propstat><d:prop>" + properties + "</d:prop><d:status>HTTP/1.1 " + status + "</d:status></d:propstat>";
        return before ? response.replace("<d:propstat>", propstat + "<d:propstat>")
                : response.replace("</d:response>", propstat + "</d:response>");
    }
}
