package com.shichaoya.aimediacenter.user.infrastructure.security;

import com.shichaoya.aimediacenter.common.web.*;
import com.shichaoya.aimediacenter.user.application.service.AuthService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;
import java.util.List;

/**
 * infrastructure/security 中的 Spring Security 入口配置。请求先经 ApiRequestFilter，
 * 再进入这里构建的安全过滤链；受保护请求认证成功后才进入 Controller。
 * 对受保护请求，Bearer JWT 经 JwtDecoder 验证后，转换器调用 AuthService.requireActive，
 * 把数据库当前用户放入 Authentication.principal，供 @AuthenticationPrincipal CurrentUser 注入。
 */
@Configuration
public class SecurityConfiguration {
    @Bean SecurityFilterChain security(HttpSecurity http, AuthService auth, ApiResponses responses) throws Exception {
        var resolver = new DefaultBearerTokenResolver();
        // 当前前端每次带 Bearer Token，不用服务端 Session 保存登录态；STATELESS 避免请求依赖旧会话。
        // 当前使用请求头中的 Token，不依赖 Cookie 会话，因此此处关闭 CSRF 和请求缓存。
        http.csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(cache -> cache.disable())
                // 注册与登录需要在尚无 Token 时可访问；包括 /me 与来源列表在内的其他请求均需认证。
                .authorizeHttpRequests(rules -> rules.requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll().anyRequest().authenticated())
                // 401 是未建立有效身份；403 是已建立身份但无访问权限。禁用账号另由 requireActive 返回 ACCOUNT_DISABLED。
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) -> responses.error(request, response, ApiException.unauthenticated()))
                        .accessDeniedHandler((request, response, error) -> responses.error(request, response, new ApiException(403, "FORBIDDEN", "没有访问权限。"))))
                .oauth2ResourceServer(resource -> resource
                        .bearerTokenResolver(request -> {
                            // 公开的注册/登录即使带着旧 Token，也不拿它决定本次请求身份。
                            boolean publicAuth = request.getMethod().equals("POST") && (request.getServletPath().equals("/api/auth/register") || request.getServletPath().equals("/api/auth/login"));
                            return publicAuth ? null : resolver.resolve(request);
                        })
                        .authenticationEntryPoint((request, response, error) -> responses.error(request, response, ApiException.unauthenticated()))
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(token -> {
                            // 到这里时 JwtDecoder 已验证签名、过期时间、iss、aud 和必需的 sub 等声明。
                            // 再查 users 的现状：删除账号返回 401，禁用账号返回 403；角色以数据库为准。
                            var user = auth.requireActive(token.getSubject());
                            // principal 存 CurrentUser，因此 Controller 的 @AuthenticationPrincipal 可直接取得它。
                            return new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.role())));
                        })));
        return http.build();
    }
}
