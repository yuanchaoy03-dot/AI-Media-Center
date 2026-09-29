package com.shichaoya.aimediacenter.common.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.LoggerFactory;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.io.IOException;

/**
 * Spring MVC 的异常出口：处理 MVC 解析请求或执行 Controller 时发生的错误，并交给 ApiResponses 写统一响应。
 * Spring Security 在 Controller 之前处理的认证/拒绝访问错误，由 SecurityConfiguration 中的处理器写出；
 * 两条路径共享 ApiResponses，因此客户端看到相同的响应结构。
 */
@RestControllerAdvice
public class ApiExceptionHandler {
    private final ApiResponses responses;
    public ApiExceptionHandler(ApiResponses responses) { this.responses = responses; }
    @ExceptionHandler(ApiException.class)
    void known(ApiException error, HttpServletRequest request, HttpServletResponse response) throws IOException {
        responses.error(request, response, error);
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, HttpMediaTypeNotSupportedException.class})
    void malformed(HttpServletRequest request, HttpServletResponse response) throws IOException {
        // 请求 JSON 无法读取或 Content-Type 不受支持时，归为输入错误，不向客户端暴露解析异常。
        responses.error(request, response, ApiException.invalid());
    }
    @ExceptionHandler(Exception.class)
    void unexpected(Exception error, HttpServletRequest request, HttpServletResponse response) throws IOException {
        // 数据库等未预期故障返回固定文案；日志只保留 requestId 与异常类型，避免泄露内部数据。
        LoggerFactory.getLogger(getClass()).error("Request {} failed ({})", request.getAttribute("requestId"), error.getClass().getSimpleName());
        responses.error(request, response, ApiException.internal());
    }
}
