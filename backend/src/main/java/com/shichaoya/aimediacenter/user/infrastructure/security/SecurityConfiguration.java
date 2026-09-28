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

@Configuration
public class SecurityConfiguration {
    @Bean SecurityFilterChain security(HttpSecurity http, AuthService auth, ApiResponses responses) throws Exception {
        var resolver = new DefaultBearerTokenResolver();
        http.csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(cache -> cache.disable())
                .authorizeHttpRequests(rules -> rules.requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login").permitAll().anyRequest().authenticated())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) -> responses.error(request, response, ApiException.unauthenticated()))
                        .accessDeniedHandler((request, response, error) -> responses.error(request, response, new ApiException(403, "FORBIDDEN", "没有访问权限。"))))
                .oauth2ResourceServer(resource -> resource
                        .bearerTokenResolver(request -> {
                            boolean publicAuth = request.getMethod().equals("POST") && (request.getServletPath().equals("/api/auth/register") || request.getServletPath().equals("/api/auth/login"));
                            return publicAuth ? null : resolver.resolve(request);
                        })
                        .authenticationEntryPoint((request, response, error) -> responses.error(request, response, ApiException.unauthenticated()))
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(token -> {
                            var user = auth.requireActive(token.getSubject());
                            return new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_" + user.role())));
                        })));
        return http.build();
    }
}
