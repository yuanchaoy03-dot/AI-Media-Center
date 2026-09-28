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

@Service
public class AuthService {
    private final UserMapper users;
    private final PasswordEncoder passwords;
    private final AccessTokens tokens;
    private final String dummyHash;
    public AuthService(UserMapper users, PasswordEncoder passwords, AccessTokens tokens) {
        this.users = users; this.passwords = passwords; this.tokens = tokens;
        dummyHash = passwords.encode("unusable-dummy-" + BusinessIds.next());
    }
    public CurrentUser register(String username, String password) {
        var user = new UserRow(BusinessIds.next(), username, passwords.encode(password), "USER", "ACTIVE");
        try { users.insert(user); }
        catch (DuplicateKeyException error) { throw new ApiException(409, "USERNAME_TAKEN", "这个用户名已被使用。"); }
        return current(user);
    }
    public String login(String username, String password) {
        var user = users.byUsername(username);
        boolean matches = passwords.matches(password, user == null ? dummyHash : user.passwordHash());
        if (!matches || user == null || !"ACTIVE".equals(user.status())) {
            throw new ApiException(401, "INVALID_CREDENTIALS", "用户名或密码错误，或账号暂不可用。");
        }
        return tokens.issue(user.id());
    }
    public CurrentUser requireActive(String id) {
        var user = users.byId(id);
        if (user == null) throw ApiException.unauthenticated();
        if (!"ACTIVE".equals(user.status())) throw new ApiException(403, "ACCOUNT_DISABLED", "账号暂不可用，请联系管理员。");
        return current(user);
    }
    private CurrentUser current(UserRow user) { return new CurrentUser(user.id(), user.username(), user.role()); }
}
