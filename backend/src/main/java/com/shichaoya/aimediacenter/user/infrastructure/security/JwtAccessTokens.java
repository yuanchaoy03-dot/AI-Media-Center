package com.shichaoya.aimediacenter.user.infrastructure.security;

import com.shichaoya.aimediacenter.user.application.port.AccessTokens;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.List;

@Component
public class JwtAccessTokens implements AccessTokens {
    private final JwtEncoder encoder;
    private final String issuer;
    private final String audience;
    public JwtAccessTokens(JwtEncoder encoder, @Value("${app.jwt.issuer}") String issuer, @Value("${app.jwt.audience}") String audience) {
        this.encoder = encoder; this.issuer = issuer; this.audience = audience;
    }
    public String issue(String userId) {
        var now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer(issuer).audience(List.of(audience)).subject(userId)
                .issuedAt(now).expiresAt(now.plusSeconds(3600)).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }
}
