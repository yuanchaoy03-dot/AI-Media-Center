package com.shichaoya.aimediacenter.media.infrastructure.webdav;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.domain.MediaDirectory;
import com.shichaoya.aimediacenter.media.domain.MediaFileDirectory;
import com.shichaoya.aimediacenter.media.domain.SourceDirectoryPath;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Depth:1 的 XML/路径边界。任何无效项使整批失败，不悄悄返回看似完整的部分列表。 */
final class WebDavDirectoryReader {
    static final int MAX_ENTRIES = 2000;
    private final URI root;
    private final String rootPath;
    private final String path;
    private final URI target;

    WebDavDirectoryReader(String address, String path) {
        this.root = URI.create(address);
        this.rootPath = decodedPath(root);
        this.path = SourceDirectoryPath.normalize(path);
        try {
            String remotePath = rootPath.equals("/") ? this.path
                    : rootPath + (this.path.equals("/") ? "" : this.path);
            // 根目录沿用已保存的最终地址；子目录显式编码每个字符，避免 %、#、? 改变 URL 含义。
            this.target = this.path.equals("/") ? root : URI.create(new URI(root.getScheme(), null,
                    root.getHost(), root.getPort(), remotePath + "/", null, null).toASCIIString());
        } catch (URISyntaxException error) { throw invalid(); }
    }

    URI target() { return target; }

    /** Depth:0 只能包含目标自身，沿用与浏览相同的来源路径、同源及资源类型边界。 */
    void verifyCurrent(Element document) {
        if (!isDav(document, "multistatus")) throw invalid();
        var responses = children(document, "response");
        if (responses.size() != 1) throw invalid();
        var response = responses.getFirst();
        var hrefs = children(response, "href");
        if (hrefs.size() != 1 || !sourcePath(hrefs.getFirst().getTextContent().strip()).equals(path)) throw invalid();
        if (!kind(response, true).equals("directory")) throw notFound();
    }

    MediaDirectory read(Element document) {
        var result = readFiles(document);
        return new MediaDirectory(result.path(), result.entries().stream()
                .map(entry -> new MediaDirectory.Entry(entry.name(), entry.path(), entry.kind())).toList());
    }

    MediaFileDirectory readFiles(Element document) {
        if (!isDav(document, "multistatus")) throw invalid();
        List<Element> responses = children(document, "response");
        if (responses.isEmpty() || responses.size() > MAX_ENTRIES + 1) throw invalid();
        List<MediaFileDirectory.Entry> entries = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        boolean currentFound = false;
        for (Element response : responses) {
            var hrefs = children(response, "href");
            if (hrefs.size() != 1) throw invalid();
            String relative = sourcePath(hrefs.getFirst().getTextContent().strip());
            if (!seen.add(relative)) throw invalid();
            boolean current = relative.equals(path);
            if (!current && !parent(relative).equals(path)) throw invalid();
            String kind = kind(response, current);
            if (current) {
                if (!kind.equals("directory")) throw notFound();
                currentFound = true;
            } else {
                if (entries.size() == MAX_ENTRIES) throw invalid();
                entries.add(new MediaFileDirectory.Entry(relative.substring(relative.lastIndexOf('/') + 1), relative, kind,
                        contentLength(response), modifiedAt(response)));
            }
        }
        if (!currentFound) throw invalid();
        entries.sort(Comparator.comparing((MediaFileDirectory.Entry entry) -> !entry.kind().equals("directory"))
                .thenComparing(MediaFileDirectory.Entry::name));
        return new MediaFileDirectory(path, entries);
    }

    /** 只采纳唯一、成功的可选属性；不支持、格式错误或重复声明都不伪造事实。 */
    private static String optionalProperty(Element response, String name) {
        String value = null;
        int count = 0;
        for (Element propstat : children(response, "propstat")) {
            var statuses = children(propstat, "status");
            if (statuses.size() != 1 || statusCode(statuses.getFirst()) != 200) continue;
            for (Element prop : children(propstat, "prop")) {
                for (Element property : children(prop, name)) {
                    count++;
                    for (Node child = property.getFirstChild(); child != null; child = child.getNextSibling()) {
                        if (child instanceof Element) return null;
                    }
                    value = property.getTextContent().strip();
                }
            }
        }
        return count == 1 ? value : null;
    }

    private static Long contentLength(Element response) {
        String value = optionalProperty(response, "getcontentlength");
        if (value == null || !value.matches("[0-9]+")) return null;
        try { return Long.valueOf(value); }
        catch (NumberFormatException error) { return null; }
    }

    private static Instant modifiedAt(Element response) {
        String value = optionalProperty(response, "getlastmodified");
        if (value == null) return null;
        try { return ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME.withResolverStyle(ResolverStyle.STRICT)).toInstant(); }
        catch (DateTimeParseException error) { return null; }
    }

    private String sourcePath(String href) {
        try {
            if (href.isEmpty()) throw invalid();
            URI supplied = URI.create(href);
            // 先校验原始 href，不能让 URI.resolve 消去点段后把越界访问重新伪装成合法目录。
            decodedPath(supplied);
            // RFC relative hrefs resolve against a directory even when the saved root omits its trailing slash.
            String targetPath = target.getRawPath();
            URI base = targetPath != null && targetPath.endsWith("/") ? target : URI.create(target.toASCIIString() + "/");
            URI resource = base.resolve(supplied);
            if (resource.getRawUserInfo() != null || resource.getRawQuery() != null || resource.getRawFragment() != null
                    || resource.getHost() == null || !resource.getHost().equalsIgnoreCase(root.getHost())
                    || !resource.getScheme().equalsIgnoreCase(root.getScheme()) || port(resource) != port(root)) throw invalid();
            String remotePath = decodedPath(resource);
            if (rootPath.equals("/")) return SourceDirectoryPath.normalize(remotePath);
            if (remotePath.equals(rootPath)) return "/";
            if (!remotePath.startsWith(rootPath + "/")) throw invalid();
            // 完整远程路径的结构已校验；只有移除连接根前缀后的来源内路径消耗业务长度预算。
            return SourceDirectoryPath.normalize(remotePath.substring(rootPath.length()));
        } catch (IllegalArgumentException | ApiException error) { throw invalid(); }
    }

    private static String decodedPath(URI uri) {
        String rawPath = URI.create(uri.toASCIIString()).getRawPath();
        if (rawPath == null || rawPath.isEmpty()) return "/";
        List<String> decoded = new ArrayList<>();
        for (String segment : rawPath.split("/", -1)) {
            var bytes = new ByteArrayOutputStream();
            for (int i = 0; i < segment.length();) {
                char ch = segment.charAt(i++);
                if (ch == '%') {
                    if (i + 1 >= segment.length()) throw invalid();
                    int first = Character.digit(segment.charAt(i++), 16), second = Character.digit(segment.charAt(i++), 16);
                    if (first < 0 || second < 0) throw invalid();
                    int value = first * 16 + second;
                    if (value == '/' || value == '\\') throw invalid();
                    bytes.write(value);
                } else {
                    // toASCIIString 已把 Unicode 编成 UTF-8 percent bytes；这里仅剩 ASCII。
                    if (ch > 127) throw invalid();
                    bytes.write(ch);
                }
            }
            try {
                decoded.add(StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes.toByteArray())).toString());
            } catch (CharacterCodingException error) { throw invalid(); }
        }
        // 保留路径段边界；编码后的点段同样由来源内路径规则拒绝。
        String value = String.join("/", decoded);
        if (!value.startsWith("/")) value = "/" + value;
        try { return SourceDirectoryPath.normalizeDecodedPath(value); }
        catch (ApiException error) { throw invalid(); }
    }

    private static String kind(Element response, boolean current) {
        for (Element status : children(response, "status")) {
            int code = statusCode(status);
            if (code == 401 || code == 403) throw authFailed();
            if (code == 404 && current) throw notFound();
            if (code != 200) throw invalid();
        }
        String kind = null;
        for (Element propstat : children(response, "propstat")) {
            var statuses = children(propstat, "status");
            if (statuses.size() != 1) throw invalid();
            int status = statusCode(statuses.getFirst());
            for (Element prop : children(propstat, "prop")) {
                for (Element type : children(prop, "resourcetype")) {
                    // 资源类型是必需属性；大小、修改时间等可选属性的权限失败只保留空值。
                    if (status == 401 || status == 403) throw authFailed();
                    if (status == 404 && current) throw notFound();
                    if (status != 200 || kind != null) throw invalid();
                    var collections = children(type, "collection");
                    if (collections.size() > 1) throw invalid();
                    kind = collections.isEmpty() ? "file" : "directory";
                }
            }
        }
        if (kind == null) throw invalid();
        return kind;
    }

    private static int statusCode(Element status) {
        String value = status.getTextContent().strip();
        if (!value.matches("HTTP/[0-9.]+\\s+[0-9]{3}(?:\\s+.*)?")) throw invalid();
        return Integer.parseInt(value.split("\\s+")[1]);
    }
    private static int port(URI uri) {
        return uri.getPort() == -1 ? uri.getScheme().equalsIgnoreCase("https") ? 443 : 80 : uri.getPort();
    }
    private static String parent(String path) {
        int index = path.lastIndexOf('/');
        return index <= 0 ? "/" : path.substring(0, index);
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
    static ApiException invalid() { return new ApiException(422, "SOURCE_DIRECTORY_INVALID", "来源未返回有效、完整的单层目录，请检查来源后重试。"); }
    static ApiException notFound() { return new ApiException(404, "SOURCE_DIRECTORY_NOT_FOUND", "找不到这个文件夹，请返回上一级。"); }
    private static ApiException authFailed() { return new ApiException(422, "SOURCE_AUTH_FAILED", "来源认证失败或无权访问此目录，请检查账号和密码。"); }
}
