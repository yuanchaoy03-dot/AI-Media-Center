package com.shichaoya.aimediacenter.user.infrastructure.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.*;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.time.Duration;
import java.util.Base64;
import java.util.Map;

/**
 * infrastructure/security 的密码与 JWT 组件配置。PasswordEncoder 供 AuthService 散列/比对密码；
 * JwtEncoder 供 JwtAccessTokens 签发，JwtDecoder 由 Spring Security 在受保护请求中验签和校验声明。
 * JwtEncoder 与 JwtDecoder 使用同一服务端密钥，但职责分别是“签发”和“验证”；Base64 只是密钥的文本表示。
 */
@Configuration
public class TokenConfiguration {
    @Bean PasswordEncoder passwordEncoder() {
        // PBKDF2-HMAC-SHA256 处理完整密码输入；DelegatingPasswordEncoder 在散列前加算法标识，供 matches 选用对应算法。
        var pbkdf2 = new Pbkdf2PasswordEncoder("", 16, 600_000, Pbkdf2PasswordEncoder.SecretKeyFactoryAlgorithm.PBKDF2WithHmacSHA256);
        return new DelegatingPasswordEncoder("pbkdf2-sha256-600k", Map.of("pbkdf2-sha256-600k", pbkdf2));
    }
    @Bean SecretKey jwtKey(@Value("${app.jwt.secret}") String secret) {
        // JWT_SECRET 从环境配置注入，Base64 仅是密钥字节的文本表示，不提供保密性；至少要求 32 字节。
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(secret); }
        catch (IllegalArgumentException error) { throw new IllegalStateException("JWT_SECRET must be Base64 encoded."); }
        if (bytes.length < 32) throw new IllegalStateException("JWT_SECRET must contain at least 32 random bytes.");
        return new SecretKeySpec(bytes, "HmacSHA256");
    }
    // 登录成功时的签发器；实际调用点在 JwtAccessTokens.issue。
    @Bean JwtEncoder jwtEncoder(SecretKey key) { return NimbusJwtEncoder.withSecretKey(key).algorithm(MacAlgorithm.HS256).build(); }
    @Bean JwtDecoder jwtDecoder(SecretKey key, @Value("${app.jwt.issuer}") String issuer, @Value("${app.jwt.audience}") String audience) {
        // 资源服务器验证 Bearer JWT 的 HS256 签名，再执行下面的时间、签发者和必需声明校验。
        var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        // sub 对应 users.id；iss 必须是本服务，aud 必须包含当前 Web 客户端，exp 必须存在且尚未过期。
        OAuth2TokenValidator<Jwt> requiredClaims = jwt -> jwt.getExpiresAt() != null && jwt.getSubject() != null && !jwt.getSubject().isBlank()
                && jwt.getAudience() != null && jwt.getAudience().contains(audience)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
        // Duration.ZERO 不给过期 Token 额外宽限；通过这些基础验证后才会调用 requireActive 查数据库。
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(new JwtTimestampValidator(Duration.ZERO), new JwtIssuerValidator(issuer), requiredClaims));
        return decoder;
    }
}
