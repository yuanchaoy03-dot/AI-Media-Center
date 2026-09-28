package com.shichaoya.aimediacenter.common.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

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
        response.setStatus(error.status());
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Cache-Control", "no-store");
        if (error.status() == 401 && error.code().equals("UNAUTHENTICATED")) response.setHeader("WWW-Authenticate", "Bearer");
        var body = body(request, error.code(), error.getMessage(), null);
        if (!error.fieldErrors().isEmpty()) body.put("fieldErrors", error.fieldErrors());
        response.getWriter().write(mapper.writeValueAsString(body));
    }
    public static void noQuery(HttpServletRequest request) {
        if (request.getQueryString() != null && !request.getQueryString().isEmpty()) throw ApiException.invalid();
        if (request.getMethod().equals("GET") && (request.getContentLengthLong() > 0 || request.getHeader("Transfer-Encoding") != null)) throw ApiException.invalid();
    }
}
