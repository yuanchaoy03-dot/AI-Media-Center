package com.shichaoya.aimediacenter.media.web.dto;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.shichaoya.aimediacenter.media.domain.SourceDirectoryPath;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** 新增与测试共享严格输入边界；凭据保留原样，禁止客户端声明归属或测试结果。 */
public record MediaSourceRequest(String name, SourceConnection connection) {
    public static MediaSourceRequest parse(Map<String, Object> body) {
        if (body == null || !body.keySet().equals(Set.of("name", "address", "username", "password"))) {
            throw ApiException.invalid();
        }
        Map<String, String> errors = new LinkedHashMap<>();
        String name = text(body, "name", errors).replaceAll("^[\\s\\p{Z}\\uFEFF]+|[\\s\\p{Z}\\uFEFF]+$", "");
        String address = text(body, "address", errors).strip();
        String username = text(body, "username", errors);
        String password = text(body, "password", errors);
        if (name.isEmpty() || length(name) > 80 || invalidUnicode(name) || name.codePoints().anyMatch(Character::isISOControl)) {
            errors.put("name", "来源名称须为 1–80 个字符。");
        }
        if (length(address) > 2048 || invalidUnicode(address) || !validAddress(address)) {
            errors.put("address", "请输入不含账号、查询参数或片段的 HTTP(S) WebDAV 目录地址。");
        }
        if (length(username) > 256 || invalidUnicode(username) || username.indexOf(':') >= 0
                || username.codePoints().anyMatch(Character::isISOControl)) {
            errors.put("username", "用户名不能超过 256 个字符，或包含冒号及控制字符。");
        }
        if (length(password) > 1024 || invalidUnicode(password) || password.codePoints().anyMatch(Character::isISOControl)) {
            errors.put("password", "密码不能超过 1024 个字符，或包含控制字符。");
        }
        if (username.isEmpty() && !password.isEmpty()) errors.put("username", "使用密码时请填写用户名。");
        if (!errors.isEmpty()) throw new ApiException(400, "VALIDATION_FAILED", "请检查输入内容。", errors);
        return new MediaSourceRequest(name, new SourceConnection(URI.create(address).toASCIIString(), username, password));
    }
    private static String text(Map<String, Object> body, String key, Map<String, String> errors) {
        if (body.get(key) instanceof String value) return value;
        errors.put(key, "此字段须为文本。");
        return "";
    }
    private static int length(String value) { return value.codePointCount(0, value.length()); }
    private static boolean invalidUnicode(String value) {
        return value.codePoints().anyMatch(c -> c >= 0xd800 && c <= 0xdfff);
    }
    private static boolean validAddress(String value) {
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            return scheme != null && Set.of("http", "https").contains(scheme.toLowerCase(Locale.ROOT))
                    && uri.getHost() != null && uri.getRawUserInfo() == null && uri.getRawQuery() == null
                    && uri.getRawFragment() == null && (uri.getPort() == -1 || uri.getPort() >= 1 && uri.getPort() <= 65535)
                    && !uri.getHost().contains("%") && validRootPath(uri);
        } catch (IllegalArgumentException | ApiException | CharacterCodingException error) { return false; }
    }
    /** 根地址沿用浏览的严格解码和路径边界，不能保存测试成功但无法浏览的来源。 */
    private static boolean validRootPath(URI uri) throws CharacterCodingException {
        String rawPath = URI.create(uri.toASCIIString()).getRawPath();
        if (rawPath == null || rawPath.isEmpty()) return true;
        var bytes = new ByteArrayOutputStream();
        for (int i = 0; i < rawPath.length();) {
            char ch = rawPath.charAt(i++);
            if (ch == '%') {
                int value = Character.digit(rawPath.charAt(i++), 16) * 16 + Character.digit(rawPath.charAt(i++), 16);
                if (value == '/' || value == '\\') return false;
                bytes.write(value);
            } else bytes.write(ch);
        }
        String decoded = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes.toByteArray())).toString();
        SourceDirectoryPath.normalize(decoded);
        return true;
    }
    @Override public String toString() { return "MediaSourceRequest[redacted]"; }
}
