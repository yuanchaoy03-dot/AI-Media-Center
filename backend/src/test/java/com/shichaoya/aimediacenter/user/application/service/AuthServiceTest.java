package com.shichaoya.aimediacenter.user.application.service;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.user.application.port.AccessTokens;
import com.shichaoya.aimediacenter.user.infrastructure.persistence.UserMapper;
import com.shichaoya.aimediacenter.user.infrastructure.persistence.UserRow;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 不启动 Spring 或数据库；验证通用密码编码器的使用，以及登录签发 Token 前的认证与账号状态检查。 */
class AuthServiceTest {
    private static final String PASSWORD = "中文密码 with emoji 😀 and complete input";
    private static final String USER_ID = "test-user-id";
    private static final String CURRENT_HASH = "{argon2id}$argon2id$current-fixture";
    private static final String DUMMY_HASH = "dummy-fixture";
    private UserMapper users;
    private PasswordEncoder passwords;
    private AccessTokens tokens;
    private AuthService service;

    @BeforeEach void setUp() {
        users = mock(UserMapper.class);
        passwords = mock(PasswordEncoder.class);
        tokens = mock(AccessTokens.class);
        when(passwords.encode(any(CharSequence.class))).thenReturn(DUMMY_HASH);
        service = new AuthService(users, passwords, tokens);
        // 单独的 dummy 测试验证初始化；其他场景只计登录/注册本身的 encode 调用。
        clearInvocations(passwords);
    }

    @Test void registrationPersistsThePasswordEncoderOutputAndDoesNotIssueToken() {
        when(passwords.encode(PASSWORD)).thenReturn(CURRENT_HASH);

        var current = service.register("alice", PASSWORD);

        var inserted = ArgumentCaptor.forClass(UserRow.class);
        verify(users).insert(inserted.capture());
        var user = inserted.getValue();
        assertEquals(CURRENT_HASH, user.passwordHash());
        assertEquals("alice", user.username());
        assertEquals("USER", user.role());
        assertEquals("ACTIVE", user.status());
        assertEquals(user.id(), current.id());
        assertEquals(user.username(), current.username());
        assertEquals(user.role(), current.role());
        verify(passwords).encode(PASSWORD);
        verifyNoMoreInteractions(passwords, users);
        verifyNoInteractions(tokens);
    }

    @Test void activeUserLoginVerifiesPasswordBeforeIssuingTokenWithoutEncodingAgain() {
        when(users.byUsername("alice")).thenReturn(user("ACTIVE"));
        when(passwords.matches(PASSWORD, CURRENT_HASH)).thenReturn(true);
        when(tokens.issue(USER_ID)).thenReturn("issued-token");

        assertEquals("issued-token", service.login("alice", PASSWORD));

        var order = inOrder(users, passwords, tokens);
        order.verify(users).byUsername("alice");
        order.verify(passwords).matches(PASSWORD, CURRENT_HASH);
        order.verify(tokens).issue(USER_ID);
        order.verifyNoMoreInteractions();
    }

    @Test void wrongPasswordDoesNotIssueToken() {
        when(users.byUsername("alice")).thenReturn(user("ACTIVE"));
        when(passwords.matches(PASSWORD, CURRENT_HASH)).thenReturn(false);

        assertInvalidCredentials(() -> service.login("alice", PASSWORD));

        verify(users).byUsername("alice");
        verify(passwords).matches(PASSWORD, CURRENT_HASH);
        verifyNoMoreInteractions(passwords, users);
        verifyNoInteractions(tokens);
    }

    @Test void disabledUserWithCorrectPasswordCannotReceiveToken() {
        when(users.byUsername("alice")).thenReturn(user("DISABLED"));
        when(passwords.matches(PASSWORD, CURRENT_HASH)).thenReturn(true);

        assertInvalidCredentials(() -> service.login("alice", PASSWORD));

        verify(users).byUsername("alice");
        verify(passwords).matches(PASSWORD, CURRENT_HASH);
        verifyNoMoreInteractions(passwords, users);
        verifyNoInteractions(tokens);
    }

    @Test void dummyHashIsGeneratedOnceAndMissingUsersStillMatchOnEveryAttempt() {
        // 重新构造一次服务，保留本测试对初始化 encode 的调用记录。
        clearInvocations(passwords);
        var localService = new AuthService(users, passwords, tokens);
        when(passwords.matches(PASSWORD, DUMMY_HASH)).thenReturn(false);

        assertInvalidCredentials(() -> localService.login("missing", PASSWORD));
        assertInvalidCredentials(() -> localService.login("missing", PASSWORD));

        verify(passwords).encode(argThat(raw -> raw.toString().startsWith("unusable-dummy-")));
        verify(passwords, times(2)).matches(PASSWORD, DUMMY_HASH);
        verify(users, times(2)).byUsername("missing");
        verifyNoMoreInteractions(passwords, users);
        verifyNoInteractions(tokens);
    }

    @Test void matchingDummyHashStillCannotAuthenticateAMissingUser() {
        when(passwords.matches(PASSWORD, DUMMY_HASH)).thenReturn(true);

        assertInvalidCredentials(() -> service.login("missing", PASSWORD));

        verify(users).byUsername("missing");
        verify(passwords).matches(PASSWORD, DUMMY_HASH);
        verifyNoMoreInteractions(passwords, users);
        verifyNoInteractions(tokens);
    }

    private UserRow user(String status) {
        return new UserRow(USER_ID, "alice", CURRENT_HASH, "USER", status);
    }

    private void assertInvalidCredentials(org.junit.jupiter.api.function.Executable operation) {
        var error = assertThrows(ApiException.class, operation);
        assertEquals(401, error.status());
        assertEquals("INVALID_CREDENTIALS", error.code());
    }
}
