package com.shichaoya.aimediacenter.media.infrastructure.webdav;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.application.port.MediaSourceAdapter;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.shichaoya.aimediacenter.media.domain.MediaDirectory;
import com.shichaoya.aimediacenter.media.domain.MediaFileDirectory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.xml.sax.SAXException;
import org.xml.sax.SAXParseException;
import org.xml.sax.helpers.DefaultHandler;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Flow;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/** 只读 PROPFIND；不下载视频、不跟随重定向，不将远程正文或凭据用于日志/错误。 */
@Component
public class WebDavMediaSourceAdapter implements MediaSourceAdapter {
    private static final int MAX_BODY_BYTES = 128 * 1024;
    private static final int MAX_DIRECTORY_BYTES = 1024 * 1024;
    private static final int MAX_XML_ELEMENT_DEPTH = 64;
    private static final String PROPFIND = """
            <?xml version="1.0" encoding="utf-8"?>
            <d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>
            """;
    private static final String SCAN_PROPFIND = """
            <?xml version="1.0" encoding="utf-8"?>
            <d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>
            """;
    private final HttpClient client;
    private final int timeoutMs;
    public WebDavMediaSourceAdapter(@Value("${app.media-source.connection-timeout-ms:8000}") int timeoutMs) {
        if (timeoutMs < 100 || timeoutMs > 15000) throw new IllegalArgumentException("Invalid media source timeout configuration");
        this.timeoutMs = timeoutMs;
        client = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(Math.min(timeoutMs, 3000)))
                .followRedirects(HttpClient.Redirect.NEVER).version(HttpClient.Version.HTTP_1_1).build();
    }
    @Override public void testConnection(SourceConnection connection) {
        URI target = URI.create(connection.address());
        verifyDirectory(request(connection, target, "0", MAX_BODY_BYTES, false), target);
    }
    @Override public MediaDirectory browseDirectory(SourceConnection connection, String path) {
        var reader = new WebDavDirectoryReader(connection.address(), path);
        byte[] xml = request(connection, reader.target(), "1", MAX_DIRECTORY_BYTES, true);
        try { return reader.read(parseXml(xml)); }
        catch (ApiException error) { throw error; }
        catch (Exception error) { throw WebDavDirectoryReader.invalid(); }
    }
    @Override public MediaFileDirectory scanDirectory(SourceConnection connection, String path, long deadlineNanos) {
        long started = System.nanoTime();
        long scanRemainingNanos = deadlineNanos - started;
        long requestBudgetNanos = TimeUnit.MILLISECONDS.toNanos(Math.min(timeoutMs, 8000));
        // 按先到的截止分类；请求毫秒预算向下取整时也不能把任务截止误报为连接超时。
        boolean scanDeadlineFirst = scanRemainingNanos <= requestBudgetNanos;
        long remainingNanos = Math.min(scanRemainingNanos, requestBudgetNanos);
        if (remainingNanos <= 0) throw timeout(scanDeadlineFirst);
        long operationDeadline = started + remainingNanos;
        var reader = new WebDavDirectoryReader(connection.address(), path);
        long remainingMs = TimeUnit.NANOSECONDS.toMillis(operationDeadline - System.nanoTime());
        if (remainingMs <= 0) throw timeout(scanDeadlineFirst);
        byte[] xml = request(connection, reader.target(), "1", MAX_DIRECTORY_BYTES, true, remainingMs, SCAN_PROPFIND, scanDeadlineFirst);
        try {
            if (operationDeadline - System.nanoTime() <= 0) throw timeout(scanDeadlineFirst);
            var result = reader.readFiles(parseXml(xml));
            if (operationDeadline - System.nanoTime() <= 0) throw timeout(scanDeadlineFirst);
            return result;
        } catch (ApiException error) { throw error; }
        catch (Exception error) { throw WebDavDirectoryReader.invalid(); }
    }
    @Override public void validateDirectories(SourceConnection connection, List<String> paths) {
        // 默认整批 8 秒，配置上限 10 秒；32 个根也不能各自重新获得完整超时预算。
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(Math.min(timeoutMs, 10000));
        for (String path : paths) {
            var reader = new WebDavDirectoryReader(connection.address(), path);
            long remaining = TimeUnit.NANOSECONDS.toMillis(deadline - System.nanoTime());
            if (remaining <= 0) throw timeout();
            byte[] xml = request(connection, reader.target(), "0", MAX_BODY_BYTES, true, remaining);
            try { reader.verifyCurrent(parseXml(xml)); }
            catch (ApiException error) { throw error; }
            catch (Exception error) { throw WebDavDirectoryReader.invalid(); }
            if (System.nanoTime() >= deadline) throw timeout();
        }
    }
    private byte[] request(SourceConnection connection, URI target, String depth, int bodyLimit, boolean browsing) {
        return request(connection, target, depth, bodyLimit, browsing, timeoutMs);
    }
    private byte[] request(SourceConnection connection, URI target, String depth, int bodyLimit, boolean browsing, long requestTimeoutMs) {
        return request(connection, target, depth, bodyLimit, browsing, requestTimeoutMs, PROPFIND, false);
    }
    private byte[] request(SourceConnection connection, URI target, String depth, int bodyLimit, boolean browsing,
                           long requestTimeoutMs, String properties, boolean scanDeadlineFirst) {
        rejectDangerousLiteralTarget(target);
        var builder = HttpRequest.newBuilder(target).timeout(Duration.ofMillis(requestTimeoutMs))
                .header("Depth", depth).header("Content-Type", "application/xml; charset=utf-8")
                .header("Accept", "application/xml, text/xml")
                .method("PROPFIND", HttpRequest.BodyPublishers.ofString(properties, StandardCharsets.UTF_8));
        if (!connection.username().isEmpty()) {
            String basic = Base64.getEncoder().encodeToString((connection.username() + ":" + connection.password()).getBytes(StandardCharsets.UTF_8));
            builder.header("Authorization", "Basic " + basic);
        }
        // HttpRequest.timeout 不足以单独保证慢响应体的终点；整个 sendAsync + 有界订阅统一截止。
        var pending = client.sendAsync(builder.build(), info -> new LimitedBodySubscriber(info.statusCode() == 207, bodyLimit, browsing));
        try {
            var response = pending.get(requestTimeoutMs, TimeUnit.MILLISECONDS);
            int status = response.statusCode();
            if (status == 401 || status == 403) throw authFailed();
            if (status >= 300 && status < 400) {
                throw new ApiException(422, "SOURCE_REDIRECT_UNSUPPORTED", "来源地址发生重定向，请填写最终 WebDAV 目录地址。");
            }
            if (browsing && status == 404) throw WebDavDirectoryReader.notFound();
            if (status == 200 || status == 405 || status == 501) throw notWebDav();
            if (status != 207) throw connectionFailed();
            return response.body();
        } catch (TimeoutException error) {
            pending.cancel(true);
            throw timeout(scanDeadlineFirst);
        } catch (InterruptedException error) {
            pending.cancel(true);
            Thread.currentThread().interrupt();
            throw connectionFailed();
        } catch (ExecutionException error) {
            Throwable cause = error.getCause();
            // 新建连接另有更早的截止，不能因目录请求使用任务预算而一律改报整体超时。
            if (cause instanceof HttpConnectTimeoutException) {
                throw timeout(scanDeadlineFirst && requestTimeoutMs <= Math.min(timeoutMs, 3000));
            }
            if (cause instanceof HttpTimeoutException) throw timeout(scanDeadlineFirst);
            if (cause instanceof ApiException known) throw known;
            throw connectionFailed();
        }
    }
    private static void rejectDangerousLiteralTarget(URI uri) {
        String host = uri.getHost().toLowerCase(Locale.ROOT).replaceAll("\\.$", "");
        if (Set.of("metadata.google.internal", "metadata.goog", "instance-data", "metadata.aws.internal").contains(host)) {
            throw unsafeAddress();
        }
        // NAS/RFC1918、localhost 均允许。这里阻止明确危险字面量；部署仍须限定目标网络并防 DNS 重绑定。
        if (host.matches("[0-9.]+") || host.startsWith("[")) {
            try {
                var address = InetAddress.getByName(host);
                if (address.isAnyLocalAddress() || address.isLinkLocalAddress() || address.isMulticastAddress()
                        || address.getHostAddress().equalsIgnoreCase("fd00:ec2:0:0:0:0:0:254")) throw unsafeAddress();
            } catch (java.net.UnknownHostException error) { throw unsafeAddress(); }
        }
    }
    private static void verifyDirectory(byte[] xml, URI target) {
        try {
            Element root = parseXml(xml);
            if (!isDav(root, "multistatus")) throw notWebDav();
            for (var resource : children(root, "response")) {
                var hrefs = children(resource, "href");
                if (hrefs.size() != 1 || !sameResource(target, hrefs.getFirst().getTextContent().strip())) continue;
                for (var status : children(resource, "status")) {
                    if (statusCode(status, 401) || statusCode(status, 403)) throw authFailed();
                }
                for (var propstat : children(resource, "propstat")) {
                    var statuses = children(propstat, "status");
                    if (statuses.size() != 1) continue;
                    var status = statuses.getFirst();
                    if (statusCode(status, 401) || statusCode(status, 403)) throw authFailed();
                    if (!statusCode(status, 200)) continue;
                    for (var prop : children(propstat, "prop")) {
                        for (var type : children(prop, "resourcetype")) {
                            if (!children(type, "collection").isEmpty()) return;
                        }
                    }
                }
            }
            throw notWebDav();
        } catch (ApiException error) { throw error; }
        catch (Exception error) { throw notWebDav(); }
    }
    private static Element parseXml(byte[] xml) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        // 大小上限不能阻止深层嵌套耗尽 DOM getTextContent 的调用栈。
        factory.setAttribute("jdk.xml.maxElementDepth", MAX_XML_ELEMENT_DEPTH);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        var parser = factory.newDocumentBuilder();
        parser.setErrorHandler(new DefaultHandler() {
            @Override public void error(SAXParseException error) throws SAXException { throw error; }
            @Override public void fatalError(SAXParseException error) throws SAXException { throw error; }
        });
        return parser.parse(new ByteArrayInputStream(xml)).getDocumentElement();
    }
    private static boolean sameResource(URI target, String href) {
        try {
            URI resource = target.resolve(href);
            return resource.getRawUserInfo() == null && resource.getRawQuery() == null && resource.getRawFragment() == null
                    && resource.getHost() != null && resource.getHost().equalsIgnoreCase(target.getHost())
                    && resource.getScheme().equalsIgnoreCase(target.getScheme()) && effectivePort(resource) == effectivePort(target)
                    && comparablePath(resource).equals(comparablePath(target));
        } catch (IllegalArgumentException error) { return false; }
    }
    private static int effectivePort(URI uri) {
        return uri.getPort() == -1 ? uri.getScheme().equalsIgnoreCase("https") ? 443 : 80 : uri.getPort();
    }
    private static String comparablePath(URI uri) {
        String path = uri.normalize().toASCIIString();
        path = URI.create(path).getRawPath();
        if (path == null || path.isEmpty()) return "/";
        path = java.util.regex.Pattern.compile("%[0-9a-fA-F]{2}").matcher(path)
                .replaceAll(match -> {
                    char value = (char) Integer.parseInt(match.group().substring(1), 16);
                    // RFC 3986 unreserved 编码等价；%2F 等 reserved 保留，不合并不同目录边界。
                    return value >= 'a' && value <= 'z' || value >= 'A' && value <= 'Z'
                            || value >= '0' && value <= '9' || "-._~".indexOf(value) >= 0
                            ? Character.toString(value) : match.group().toUpperCase(Locale.ROOT);
                });
        return path.length() > 1 && path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
    }
    private static boolean statusCode(Element status, int code) {
        return status.getTextContent().strip().matches("HTTP/[0-9.]+\\s+" + code + "(?:\\s+.*)?");
    }
    private static boolean isDav(Element element, String name) {
        return "DAV:".equals(element.getNamespaceURI()) && name.equals(element.getLocalName());
    }
    private static List<Element> children(Element parent, String name) {
        List<Element> result = new ArrayList<>();
        for (Node node = parent.getFirstChild(); node != null; node = node.getNextSibling()) {
            if (node instanceof Element element && isDav(element, name)) result.add(element);
        }
        return result;
    }
    private static ApiException authFailed() {
        return new ApiException(422, "SOURCE_AUTH_FAILED", "来源认证失败或无权访问此目录，请检查账号和密码。");
    }
    private static ApiException connectionFailed() {
        return new ApiException(422, "SOURCE_CONNECTION_FAILED", "无法连接来源目录，请检查地址及服务状态。");
    }
    private static ApiException notWebDav() {
        return new ApiException(422, "SOURCE_NOT_WEBDAV", "此地址未返回可访问的 WebDAV 目录，请确认 WebDAV 入口。");
    }
    private static ApiException timeout() {
        return new ApiException(504, "SOURCE_CONNECTION_TIMEOUT", "来源连接超时，请检查网络后重试。");
    }
    private static ApiException timeout(boolean scanDeadlineFirst) {
        return scanDeadlineFirst ? new ApiException(504, "SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。") : timeout();
    }
    private static ApiException unsafeAddress() {
        return new ApiException(400, "VALIDATION_FAILED", "请检查输入内容。", java.util.Map.of("address", "此来源地址不能用于 WebDAV 连接。"));
    }
    /** 限制成功 XML 大小，非 207 在 headers 后取消正文；总 deadline 也会取消未完成请求。 */
    private static final class LimitedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
        private final CompletableFuture<byte[]> body = new CompletableFuture<>();
        private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        private final boolean readBody;
        private final int limit;
        private final boolean browsing;
        private Flow.Subscription subscription;
        LimitedBodySubscriber(boolean readBody, int limit, boolean browsing) {
            this.readBody = readBody; this.limit = limit; this.browsing = browsing;
        }
        @Override public CompletionStage<byte[]> getBody() { return body; }
        @Override public void onSubscribe(Flow.Subscription subscription) {
            this.subscription = subscription;
            if (readBody) subscription.request(1);
            else { body.complete(new byte[0]); subscription.cancel(); }
        }
        @Override public void onNext(List<ByteBuffer> buffers) {
            for (var buffer : buffers) {
                if (buffer.remaining() > limit - bytes.size()) {
                    body.completeExceptionally(browsing ? WebDavDirectoryReader.invalid() : notWebDav());
                    subscription.cancel();
                    return;
                }
                byte[] chunk = new byte[buffer.remaining()];
                buffer.get(chunk);
                bytes.writeBytes(chunk);
            }
            subscription.request(1);
        }
        @Override public void onError(Throwable error) { body.completeExceptionally(error); }
        @Override public void onComplete() { body.complete(bytes.toByteArray()); }
    }
}
