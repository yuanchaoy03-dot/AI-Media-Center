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

@Configuration
public class TokenConfiguration {
    @Bean PasswordEncoder passwordEncoder() {
        var pbkdf2 = new Pbkdf2PasswordEncoder("", 16, 600_000, Pbkdf2PasswordEncoder.SecretKeyFactoryAlgorithm.PBKDF2WithHmacSHA256);
        return new DelegatingPasswordEncoder("pbkdf2-sha256-600k", Map.of("pbkdf2-sha256-600k", pbkdf2));
    }
    @Bean SecretKey jwtKey(@Value("${app.jwt.secret}") String secret) {
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(secret); }
        catch (IllegalArgumentException error) { throw new IllegalStateException("JWT_SECRET must be Base64 encoded."); }
        if (bytes.length < 32) throw new IllegalStateException("JWT_SECRET must contain at least 32 random bytes.");
        return new SecretKeySpec(bytes, "HmacSHA256");
    }
    @Bean JwtEncoder jwtEncoder(SecretKey key) { return NimbusJwtEncoder.withSecretKey(key).algorithm(MacAlgorithm.HS256).build(); }
    @Bean JwtDecoder jwtDecoder(SecretKey key, @Value("${app.jwt.issuer}") String issuer, @Value("${app.jwt.audience}") String audience) {
        var decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        OAuth2TokenValidator<Jwt> requiredClaims = jwt -> jwt.getExpiresAt() != null && jwt.getSubject() != null && !jwt.getSubject().isBlank()
                && jwt.getAudience() != null && jwt.getAudience().contains(audience)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(new JwtTimestampValidator(Duration.ZERO), new JwtIssuerValidator(issuer), requiredClaims));
        return decoder;
    }
}
