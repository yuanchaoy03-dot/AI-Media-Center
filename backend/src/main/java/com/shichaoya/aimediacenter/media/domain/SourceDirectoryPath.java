package com.shichaoya.aimediacenter.media.domain;

import com.shichaoya.aimediacenter.common.web.ApiException;
import java.util.Map;
import java.util.regex.Pattern;

/** 来源内已解码路径；不是 URL。不二次解码客户端输入，也不允许目录边界被编码隐藏。 */
public final class SourceDirectoryPath {
    private static final Pattern ENCODED_BOUNDARY = Pattern.compile("(?i)%(?:25)*(?:2f|5c|2e)");
    private SourceDirectoryPath() {}

    public static String normalize(String value) {
        if (value == null || value.isBlank() || !value.startsWith("/") || value.startsWith("//")
                || value.codePointCount(0, value.length()) > 2048 || value.indexOf('\\') >= 0
                || value.codePoints().anyMatch(c -> Character.isISOControl(c) || c >= 0xd800 && c <= 0xdfff)
                || ENCODED_BOUNDARY.matcher(value).find()) throw invalid();
        for (String segment : value.split("/", -1)) {
            if (segment.equals(".") || segment.equals("..")) throw invalid();
        }
        String normalized = value.replaceAll("/+", "/");
        return normalized.length() > 1 && normalized.endsWith("/")
                ? normalized.substring(0, normalized.length() - 1) : normalized;
    }

    private static ApiException invalid() {
        return new ApiException(400, "VALIDATION_FAILED", "请检查输入内容。",
                Map.of("path", "请使用有效的来源内绝对目录路径。"));
    }
}
