package com.shichaoya.aimediacenter.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiRequestFilter extends OncePerRequestFilter {
    private final ApiResponses responses;
    public ApiRequestFilter(ApiResponses responses) { this.responses = responses; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        request.setAttribute("requestId", UUID.randomUUID().toString());
        response.setHeader("Cache-Control", "no-store");
        try { chain.doFilter(request, response); }
        catch (ApiException error) { responses.error(request, response, error); }
        catch (Exception error) {
            // Do not log SQL arguments, credentials, request bodies or exception messages.
            LoggerFactory.getLogger(getClass()).error("Request {} failed ({})", request.getAttribute("requestId"), error.getClass().getSimpleName());
            if (!response.isCommitted()) responses.error(request, response, ApiException.internal());
        }
    }
}
