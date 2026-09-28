package com.shichaoya.aimediacenter.user.web.dto;

import com.shichaoya.aimediacenter.common.web.ApiException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public record CredentialsRequest(String username, String password) {
    public static CredentialsRequest parse(Map<String, Object> body, boolean registering) {
        if (body == null || !Set.of("username", "password").containsAll(body.keySet())) throw ApiException.invalid();
        Map<String, String> errors = new LinkedHashMap<>();
        // Check ASCII before lowercasing: Unicode case folding must not produce a valid login name.
        String rawName = body.get("username") instanceof String s ? s.replaceAll("^[\\s\\p{Z}\\uFEFF]+|[\\s\\p{Z}\\uFEFF]+$", "") : "";
        String name = rawName.toLowerCase(Locale.ROOT);
        if (!rawName.matches("[a-zA-Z0-9_]{3,32}")) errors.put("username", "用户名须为 3–32 位英文字母、数字或下划线。");
        String password = body.get("password") instanceof String s ? s : "";
        int length = password.codePointCount(0, password.length());
        if (length == 0 || length > 128 || password.codePoints().anyMatch(c -> c >= 0xd800 && c <= 0xdfff)
                || (registering && (length < 15 || password.codePoints().allMatch(c -> Character.isWhitespace(c) || Character.isSpaceChar(c) || c == 0xfeff)))) {
            errors.put("password", registering ? "密码须为 15–128 个字符，且不能全部为空白。" : "请输入不超过 128 个字符的密码。");
        }
        if (!errors.isEmpty()) throw new ApiException(400, "VALIDATION_FAILED", "请检查输入内容。", errors);
        return new CredentialsRequest(name, password);
    }
    @Override public String toString() { return "CredentialsRequest[redacted]"; }
}
