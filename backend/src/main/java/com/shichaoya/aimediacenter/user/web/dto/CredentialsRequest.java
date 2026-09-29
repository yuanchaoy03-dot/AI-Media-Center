package com.shichaoya.aimediacenter.user.web.dto;

import com.shichaoya.aimediacenter.common.web.ApiException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * HTTP 边界的账号输入：只接受 username/password，先规范化用户名并验证格式，
 * 再交给 AuthService。密码保持原样，登录时不重复要求注册密码强度。
 */
public record CredentialsRequest(String username, String password) {
    public static CredentialsRequest parse(Map<String, Object> body, boolean registering) {
        if (body == null || !Set.of("username", "password").containsAll(body.keySet())) throw ApiException.invalid();
        Map<String, String> errors = new LinkedHashMap<>();
        // 先检查原文是否为 ASCII，再转小写；避免某些 Unicode 字符折叠后变成合法账号名。
        String rawName = body.get("username") instanceof String s ? s.replaceAll("^[\\s\\p{Z}\\uFEFF]+|[\\s\\p{Z}\\uFEFF]+$", "") : "";
        String name = rawName.toLowerCase(Locale.ROOT);
        if (!rawName.matches("[a-zA-Z0-9_]{3,32}")) errors.put("username", "用户名须为 3–32 位英文字母、数字或下划线。");
        String password = body.get("password") instanceof String s ? s : "";
        int length = password.codePointCount(0, password.length());
        if (length == 0 || length > 128 || password.codePoints().anyMatch(c -> c >= 0xd800 && c <= 0xdfff)
                || (registering && (length < 12 || password.codePoints().allMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c) || c == 0xfeff)))) {
            errors.put("password", registering ? "密码须为 12–128 个字符，且不能全部为空白。" : "请输入不超过 128 个字符的密码。");
        }
        if (!errors.isEmpty()) throw new ApiException(400, "VALIDATION_FAILED", "请检查输入内容。", errors);
        return new CredentialsRequest(name, password);
    }
    // 防止日志意外打印 record 的默认 toString 而泄露明文密码。
    @Override public String toString() { return "CredentialsRequest[redacted]"; }
}
