package com.shichaoya.aimediacenter.common.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.LoggerFactory;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.io.IOException;

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
        responses.error(request, response, ApiException.invalid());
    }
    @ExceptionHandler(Exception.class)
    void unexpected(Exception error, HttpServletRequest request, HttpServletResponse response) throws IOException {
        LoggerFactory.getLogger(getClass()).error("Request {} failed ({})", request.getAttribute("requestId"), error.getClass().getSimpleName());
        responses.error(request, response, ApiException.internal());
    }
}
