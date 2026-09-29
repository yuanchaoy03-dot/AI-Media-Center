package com.shichaoya.aimediacenter.user.infrastructure.security;

import com.shichaoya.aimediacenter.user.application.port.AccessTokens;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.List;

/**
 * AccessTokens port 的 infrastructure/security 实现。AuthService.login 调用 issue 后，
 * 这里用 JwtEncoder 签发 HS256 JWT；客户端随后以 Authorization: Bearer &lt;token&gt; 访问受保护接口。
 * 签发不等于认证：后续请求仍由 JwtDecoder 与 SecurityConfiguration 验证。
 */
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
        // sub 是稳定的 users.id，便于下一次请求重新查询该用户；不把可变的用户名/角色当作身份事实。
        // iss 标明本服务签发，aud 限定给当前 Web 客户端使用；iat/exp 使 Token 有明确的一小时有效期。
        var claims = JwtClaimsSet.builder().issuer(issuer).audience(List.of(audience)).subject(userId)
                .issuedAt(now).expiresAt(now.plusSeconds(3600)).build();
        // JwtEncoder 用配置中的对称密钥签名；Token 可被持有者使用，应按凭据保护。
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }
}
