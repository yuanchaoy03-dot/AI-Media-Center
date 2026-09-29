package com.shichaoya.aimediacenter.user.application.port;

/**
 * application/port 是应用用例依赖的能力接口。AuthService 只要求“能为 userId 签发访问 Token”；
 * infrastructure 中的 JwtAccessTokens 负责目前采用的 JWT 细节，替换实现时不必把签发代码写入业务服务。
 */
public interface AccessTokens {
    String issue(String userId);
}
