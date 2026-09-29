package com.shichaoya.aimediacenter.common.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 统一 HTTP 响应格式。Controller 用 success 返回数据；Security 处理器、MVC 异常处理器及外层过滤器
 * 都调用 error，因此认证失败和业务失败使用相同的 code/message/data/requestId 包裹。
 */
@Component
public class ApiResponses {
    private final ObjectMapper mapper;
    public ApiResponses(ObjectMapper mapper) { this.mapper = mapper; }
    public static Map<String, Object> success(HttpServletRequest request, Object data) {
        return body(request, "OK", "", data);
    }
    private static Map<String, Object> body(HttpServletRequest request, String code, String message, Object data) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("code", code); result.put("message", message); result.put("data", data);
        result.put("requestId", request.getAttribute("requestId"));
        return result;
    }
    public void error(HttpServletRequest request, HttpServletResponse response, ApiException error) throws IOException {
        // Security 错误发生在 Controller 之前，不能依赖 Controller 返回值；这里直接写 Servlet 响应。
        response.setStatus(error.status());
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        // 受保护请求的 401 表示需要 Bearer 身份；登录表单的 INVALID_CREDENTIALS 不使用这个提示。
        if (error.status() == 401 && error.code().equals("UNAUTHENTICATED")) response.setHeader("WWW-Authenticate", "Bearer");
        var body = body(request, error.code(), error.getMessage(), null);
        if (!error.fieldErrors().isEmpty()) body.put("fieldErrors", error.fieldErrors());
        response.getWriter().write(mapper.writeValueAsString(body));
    }
    public static void noQuery(HttpServletRequest request) {
        // 当前这些接口没有查询参数；GET 也没有请求体。拒绝多余输入，避免它被误以为能影响身份或查询范围。
        if (request.getQueryString() != null && !request.getQueryString().isEmpty()) throw ApiException.invalid();
        if (request.getMethod().equals("GET") && (request.getContentLengthLong() > 0 || request.getHeader("Transfer-Encoding") != null)) throw ApiException.invalid();
    }
}
