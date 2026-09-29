package com.shichaoya.aimediacenter.user.application.service;

import com.shichaoya.aimediacenter.common.id.BusinessIds;
import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.user.application.port.AccessTokens;
import com.shichaoya.aimediacenter.user.infrastructure.persistence.UserMapper;
import com.shichaoya.aimediacenter.user.infrastructure.persistence.UserRow;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 认证用例的 application 层：AuthController 调用这里处理注册/登录，安全链也调用 requireActive 复核账号。
 * 它通过 UserMapper 访问 users，通过 AccessTokens 这个 port 请求签发 Token；
 * JWT 的具体实现留在 infrastructure 的 JwtAccessTokens 中。这体现了部分 Ports and Adapters 思想，
 * 无需让业务用例直接依赖 JWT 库或把整个项目定义成完整的六边形架构。
 */
@Service
public class AuthService {
    private final UserMapper users;
    private final PasswordEncoder passwords;
    private final AccessTokens tokens;
    private final String dummyHash;
    public AuthService(UserMapper users, PasswordEncoder passwords, AccessTokens tokens) {
        this.users = users; this.passwords = passwords; this.tokens = tokens;
        // 用户名不存在时仍执行一次密码散列比对，减小“账号不存在”和“密码错误”的耗时差异。
        // 每个服务实例只生成一次随机的不可用散列；它不属于任何真实用户，也不会被用来登录。
        dummyHash = passwords.encode("unusable-dummy-" + BusinessIds.next());
    }
    /** 注册输入已由 web 层规范化/校验；此处落实 ID、密码散列和数据库写入。成功时不签发 JWT。 */
    public CurrentUser register(String username, String password) {
        // 后端生成 UUIDv7 业务 ID，密码只存单向散列；新注册账号固定为 USER / ACTIVE，不能由请求体指定。
        var user = new UserRow(BusinessIds.next(), username, passwords.encode(password), "USER", "ACTIVE");
        try { users.insert(user); }
        // 数据库唯一约束是并发注册时的最终裁决；将其异常转换成前端可识别的 409。
        catch (DuplicateKeyException error) { throw new ApiException(409, "USERNAME_TAKEN", "这个用户名已被使用。"); }
        // 只返回公开身份字段，不返回 UserRow 中的 passwordHash；注册后仍需单独登录。
        return current(user);
    }
    /** 登录用例：查询规范化用户名、验证原始密码、检查当前状态，成功后才请求签发 Token。 */
    public String login(String username, String password) {
        var user = users.byUsername(username);
        // 即使查不到用户，也用 dummyHash 完成 matches；减少通过响应耗时推测账号是否存在的线索。
        boolean matches = passwords.matches(password, user == null ? dummyHash : user.passwordHash());
        // 三种失败共用错误码与文案，避免向外透露用户名是否存在或账号是否禁用。
        if (!matches || user == null || !"ACTIVE".equals(user.status())) {
            throw new ApiException(401, "INVALID_CREDENTIALS", "用户名或密码错误，或账号暂不可用。");
        }
        // AccessTokens 是应用层接口；当前实际注入 JwtAccessTokens，由它用 JwtEncoder 签发 Bearer JWT。
        return tokens.issue(user.id());
    }
    /**
     * 受保护请求在 JWT 签名、时效和声明已通过校验后，再按 JWT.sub 查询 users 的当前记录。
     * Token 未过期不代表账号仍存在或仍为 ACTIVE；这里让数据库中的状态和角色覆盖签发时的旧信息。
     * 当前 JWT 本身只放 userId，不放角色；禁用账号在下一次受保护请求时即返回 403。
     */
    public CurrentUser requireActive(String id) {
        var user = users.byId(id);
        if (user == null) throw ApiException.unauthenticated();
        if (!"ACTIVE".equals(user.status())) throw new ApiException(403, "ACCOUNT_DISABLED", "账号暂不可用，请联系管理员。");
        return current(user);
    }
    private CurrentUser current(UserRow user) { return new CurrentUser(user.id(), user.username(), user.role()); }
}
