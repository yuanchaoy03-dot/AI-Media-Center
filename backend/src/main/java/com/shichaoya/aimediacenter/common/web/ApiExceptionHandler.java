package com.shichaoya.aimediacenter.common.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
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
    @ExceptionHandler(HttpMessageNotReadableException.class)
    void malformed(HttpServletRequest request, HttpServletResponse response) throws IOException {
        // 请求 JSON 无法读取时归为输入错误，不向客户端暴露解析异常。
        responses.error(request, response, ApiException.invalid());
    }
    @ExceptionHandler(Exception.class)
    void unexpected(Exception error, HttpServletRequest request, HttpServletResponse response) throws IOException {
        // Spring MVC 已定义请求协议/映射错误的状态与响应头；仅保留明确的 4xx，不读取含输入的 detail。
        if (error instanceof ErrorResponse mvcError && mvcError.getStatusCode().is4xxClientError()) {
            int status = mvcError.getStatusCode().value();
            mvcError.getHeaders().forEach((name, values) -> {
                if (!values.isEmpty()) {
                    response.setHeader(name, values.getFirst());
                    values.stream().skip(1).forEach(value -> response.addHeader(name, value));
                }
            });
            var httpStatus = HttpStatus.resolve(status);
            String code = status == 400 ? "VALIDATION_FAILED" : httpStatus == null ? "CLIENT_ERROR" : httpStatus.name();
            String message = switch (status) {
                case 400 -> "请检查输入内容。";
                case 404 -> "请求的接口或资源不存在。";
                case 405 -> "接口不支持此请求方法。";
                case 406 -> "接口无法提供请求的响应类型。";
                case 415 -> "接口不支持此请求内容类型。";
                default -> "请求不符合接口约定。";
            };
            // 直接写统一 JSON，避免 406 错误体再次触发 Accept 协商。
            responses.error(request, response, new ApiException(status, code, message));
            return;
        }
        ApiDiagnostics.unexpected(LoggerFactory.getLogger(getClass()), request, error);
        responses.error(request, response, ApiException.internal());
    }
}
