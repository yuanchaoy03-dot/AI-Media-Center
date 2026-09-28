package com.shichaoya.aimediacenter.common.web;

import java.util.Map;

public class ApiException extends RuntimeException {
    private final int status;
    private final String code;
    private final Map<String, String> fieldErrors;
    public ApiException(int status, String code, String message) { this(status, code, message, Map.of()); }
    public ApiException(int status, String code, String message, Map<String, String> fieldErrors) {
        super(message); this.status = status; this.code = code; this.fieldErrors = Map.copyOf(fieldErrors);
    }
    public int status() { return status; }
    public String code() { return code; }
    public Map<String, String> fieldErrors() { return fieldErrors; }
    public static ApiException invalid() { return new ApiException(400, "VALIDATION_FAILED", "请检查输入内容。"); }
    public static ApiException unauthenticated() { return new ApiException(401, "UNAUTHENTICATED", "登录已失效，请重新登录。"); }
    public static ApiException internal() { return new ApiException(500, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试。"); }
}
