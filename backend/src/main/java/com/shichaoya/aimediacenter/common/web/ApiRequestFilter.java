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

/**
 * Servlet 请求链入口处的公共过滤器。@Order(HIGHEST_PRECEDENCE) 使它先于后续过滤器运行，
 * 请求随后继续经过 Spring Security，最后才可能到达 Controller。
 * 每次请求生成 requestId，供成功/失败响应与脱敏日志关联；它不是用户 ID，也不是认证凭据。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiRequestFilter extends OncePerRequestFilter {
    private final ApiResponses responses;
    public ApiRequestFilter(ApiResponses responses) { this.responses = responses; }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        // 放在 request 属性中，同一请求的 Security 处理器、Controller 和异常处理器都能取到同一个值。
        request.setAttribute("requestId", UUID.randomUUID().toString());
        // 认证与个人数据不应被浏览器或中间缓存当作可复用响应保存；错误响应写出时也会再次设置。
        response.setHeader("Cache-Control", "no-store");
        try { chain.doFilter(request, response); }
        // 捕获向外传播的异常；MVC 内部处理的异常走 ApiExceptionHandler，Security 入口错误由其处理器直接写响应。
        catch (ApiException error) { responses.error(request, response, error); }
        catch (Exception error) {
            // 只记录 requestId 与异常类型；SQL 参数、凭据、请求体及异常消息可能泄露敏感数据。
            LoggerFactory.getLogger(getClass()).error("Request {} failed ({})", request.getAttribute("requestId"), error.getClass().getSimpleName());
            if (!response.isCommitted()) responses.error(request, response, ApiException.internal());
        }
    }
}
