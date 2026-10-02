package com.shichaoya.aimediacenter.common.web;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.shichaoya.aimediacenter.user.application.port.AccessTokens;
import com.shichaoya.aimediacenter.user.application.service.AuthService;
import com.shichaoya.aimediacenter.user.infrastructure.persistence.UserMapper;
import com.shichaoya.aimediacenter.user.infrastructure.persistence.UserRow;
import com.shichaoya.aimediacenter.user.web.controller.AuthController;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.sql.SQLException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** 验证实际 HTTP 错误出口与认证边界的日志，不依赖数据库或诊断格式器的内部实现。 */
class ApiDiagnosticsTest {
    // 全部为非凭据的测试哨兵，用于识别意外记录的异常消息、请求数据和认证参数。
    private static final List<String> SENSITIVE = List.of(
            "test-only-password-sentinel", "test-only-jwt-sentinel", "test-only-authorization-sentinel",
            "test-only-db-password-sentinel", "test-only-webdav-secret-sentinel",
            "https://example.invalid/private/play?signature=test-only-playback-sentinel",
            "test-only-request-body-sentinel", "SELECT test_only_secret FROM private_fixture");
    private static final String RAW_DETAILS = String.join(" ", SENSITIVE);
    private static final String PASSWORD = SENSITIVE.getFirst();
    private static final String DUMMY_HASH = "test-only-dummy-hash";
    private static final String USER_HASH = "test-only-user-hash";
    private final ObjectMapper json = new ObjectMapper();
    private final ApiResponses responses = new ApiResponses(json);
    private final List<Capture> captures = new ArrayList<>();

    @AfterEach void restoreLoggers() {
        captures.forEach(Capture::close);
    }

    @Test void mvcFailureRecordsCauseAndLocationWithoutThrowableMessagesOrRequestData() throws Exception {
        var logs = capture(ApiExceptionHandler.class);
        var request = request("request-mvc-fault");
        var response = new MockHttpServletResponse();
        var cause = new SQLException(RAW_DETAILS);
        cause.setStackTrace(new StackTraceElement[]{
                new StackTraceElement("example.FaultRepository", "read", "FaultRepository.java", 47)});
        var error = new IllegalStateException(RAW_DETAILS, cause);
        error.addSuppressed(new IllegalArgumentException(RAW_DETAILS));

        new ApiExceptionHandler(responses).unexpected(error, request, response);

        var event = onlyEvent(logs);
        assertEquals(Level.ERROR, event.getLevel());
        assertDiagnostic(event, "request-mvc-fault", IllegalStateException.class, "DATABASE_ERROR");
        assertTrue(event.getFormattedMessage().contains(SQLException.class.getName()));
        assertTrue(event.getFormattedMessage().contains("FaultRepository.read(FaultRepository.java:47)"));
        assertInternalResponse(response, "request-mvc-fault");
    }

    @Test void outerFilterFailureUsesGeneratedRequestIdAndSafeDatabaseCauseTrace() throws Exception {
        var logs = capture(ApiRequestFilter.class);
        var request = request("ignored-before-filter");
        var response = new MockHttpServletResponse();
        var cause = new SQLException(RAW_DETAILS);
        cause.setStackTrace(new StackTraceElement[]{
                new StackTraceElement("example.SecurityLookup", "load", "SecurityLookup.java", 29)});
        var error = new ServletException(RAW_DETAILS, cause);
        error.addSuppressed(new IllegalArgumentException(RAW_DETAILS));

        new ApiRequestFilter(responses).doFilterInternal(request, response, (ignoredRequest, ignoredResponse) -> {
            throw error;
        });

        String requestId = (String) request.getAttribute("requestId");
        assertNotNull(requestId);
        assertFalse(requestId.isBlank());
        assertNotEquals("ignored-before-filter", requestId);
        var event = onlyEvent(logs);
        assertDiagnostic(event, requestId, ServletException.class, "DATABASE_ERROR");
        assertTrue(event.getFormattedMessage().contains(SQLException.class.getName()));
        assertTrue(event.getFormattedMessage().contains("SecurityLookup.load(SecurityLookup.java:29)"));
        assertInternalResponse(response, requestId);
    }

    @Test void sameExceptionTypeAtDifferentFaultLocationsCanBeDistinguished() throws Exception {
        var logs = capture(ApiExceptionHandler.class);
        var handler = new ApiExceptionHandler(responses);

        handler.unexpected(firstFault(), request("request-first"), new MockHttpServletResponse());
        handler.unexpected(secondFault(), request("request-second"), new MockHttpServletResponse());

        assertEquals(2, logs.list.size());
        var first = logs.list.get(0);
        var second = logs.list.get(1);
        assertDiagnostic(first, "request-first", IllegalStateException.class, "INTERNAL_ERROR");
        assertDiagnostic(second, "request-second", IllegalStateException.class, "INTERNAL_ERROR");
        assertTrue(first.getFormattedMessage().contains("firstFault(ApiDiagnosticsTest.java:"));
        assertTrue(second.getFormattedMessage().contains("secondFault(ApiDiagnosticsTest.java:"));
    }

    @Test void cyclicCausesCannotHangTheErrorResponse() {
        var logs = capture(ApiExceptionHandler.class);
        var first = new IllegalStateException(RAW_DETAILS);
        var second = new IllegalArgumentException(RAW_DETAILS);
        first.initCause(second);
        second.initCause(first);
        var response = new MockHttpServletResponse();

        assertTimeoutPreemptively(Duration.ofSeconds(2), () ->
                new ApiExceptionHandler(responses).unexpected(first, request("request-cycle"), response));

        assertDiagnostic(onlyEvent(logs), "request-cycle", IllegalStateException.class, "INTERNAL_ERROR");
        assertEquals(500, response.getStatus());
    }

    @Test void longCauseChainsAndStacksAreBoundedWithoutSerializingRawDetails() throws Exception {
        var logs = capture(ApiExceptionHandler.class);
        Throwable cause = null;
        for (int depth = 0; depth < 64; depth++) {
            var error = new IllegalStateException(RAW_DETAILS, cause);
            var frames = new StackTraceElement[128];
            for (int index = 0; index < frames.length; index++) {
                frames[index] = new StackTraceElement("example.BoundedFault", "frame" + index, "BoundedFault.java", index + 1);
            }
            error.setStackTrace(frames);
            cause = error;
        }

        new ApiExceptionHandler(responses).unexpected((Exception) cause, request("request-bounded"), new MockHttpServletResponse());

        var event = onlyEvent(logs);
        assertDiagnostic(event, "request-bounded", IllegalStateException.class, "INTERNAL_ERROR");
        assertTrue(event.getFormattedMessage().length() < 40000, "Cause and frame output must remain bounded");
        assertTrue(event.getFormattedMessage().contains("truncated"));
    }

    @Test void missingUserWrongPasswordAndDisabledAccountHaveIdenticalMaskedFailureLogs() {
        var logs = capture(AuthController.class);
        var users = mock(UserMapper.class);
        var passwords = mock(PasswordEncoder.class);
        var tokens = mock(AccessTokens.class);
        when(passwords.encode(any(CharSequence.class))).thenReturn(DUMMY_HASH);
        var controller = new AuthController(new AuthService(users, passwords, tokens));
        var active = new UserRow("test-user-id", "alice", USER_HASH, "USER", "ACTIVE");
        var disabled = new UserRow("test-user-id", "alice", USER_HASH, "USER", "DISABLED");
        var input = Map.<String, Object>of("username", " ALICE ", "password", PASSWORD);

        when(users.byUsername("alice")).thenReturn(null);
        when(passwords.matches(PASSWORD, DUMMY_HASH)).thenReturn(false);
        assertInvalidCredentials(() -> controller.login(input, loginRequest("request-login-failure")));
        when(users.byUsername("alice")).thenReturn(active);
        when(passwords.matches(PASSWORD, USER_HASH)).thenReturn(false);
        assertInvalidCredentials(() -> controller.login(input, loginRequest("request-login-failure")));
        when(users.byUsername("alice")).thenReturn(disabled);
        when(passwords.matches(PASSWORD, USER_HASH)).thenReturn(true);
        assertInvalidCredentials(() -> controller.login(input, loginRequest("request-login-failure")));

        assertEquals(3, logs.list.size());
        for (var event : logs.list) {
            assertEquals(Level.WARN, event.getLevel());
            assertNull(event.getThrowableProxy());
            var message = event.getFormattedMessage();
            assertTrue(message.contains("request_id=request-login-failure"));
            assertTrue(message.contains("error_category=AUTHENTICATION_FAILED"));
            assertTrue(message.contains("result=FAILURE"));
            assertTrue(message.contains("code=INVALID_CREDENTIALS"));
            assertTrue(message.contains("username_hint=a***"));
            assertFalse(message.contains("alice"));
            assertFalse(message.contains("ALICE"));
            assertNoSensitiveData(message);
        }
        assertEquals(logs.list.get(0).getFormattedMessage(), logs.list.get(1).getFormattedMessage());
        assertEquals(logs.list.get(1).getFormattedMessage(), logs.list.get(2).getFormattedMessage());
        verify(passwords).matches(PASSWORD, DUMMY_HASH);
        verify(passwords, times(2)).matches(PASSWORD, USER_HASH);
        verifyNoInteractions(tokens);
    }

    @Test void successfulLoginDoesNotWriteAnAuthenticationFailureLog() {
        var logs = capture(AuthController.class);
        var users = mock(UserMapper.class);
        var passwords = mock(PasswordEncoder.class);
        var tokens = mock(AccessTokens.class);
        when(passwords.encode(any(CharSequence.class))).thenReturn(DUMMY_HASH);
        when(users.byUsername("alice")).thenReturn(new UserRow("test-user-id", "alice", USER_HASH, "USER", "ACTIVE"));
        when(passwords.matches(PASSWORD, USER_HASH)).thenReturn(true);
        when(tokens.issue("test-user-id")).thenReturn("test-only-issued-token");
        var controller = new AuthController(new AuthService(users, passwords, tokens));

        Object response = controller.login(Map.of("username", "alice", "password", PASSWORD), loginRequest("request-login-success"));

        assertEquals("OK", ((Map<?, ?>) response).get("code"));
        assertTrue(logs.list.isEmpty());
        verify(tokens).issue("test-user-id");
    }

    private MockHttpServletRequest request(String requestId) {
        var request = new MockHttpServletRequest();
        request.setAttribute("requestId", requestId);
        request.addHeader("Authorization", "Bearer " + SENSITIVE.get(1) + SENSITIVE.get(2));
        request.setRequestURI(SENSITIVE.get(5));
        request.setQueryString("private=" + RAW_DETAILS);
        request.setContent(RAW_DETAILS.getBytes(StandardCharsets.UTF_8));
        return request;
    }

    private MockHttpServletRequest loginRequest(String requestId) {
        var request = request(requestId);
        request.setMethod("POST");
        request.setQueryString(null);
        return request;
    }

    private void assertDiagnostic(ILoggingEvent event, String requestId, Class<?> errorType, String category) {
        assertNull(event.getThrowableProxy(), "Original Throwable must never be passed to the logger");
        var message = event.getFormattedMessage();
        assertTrue(message.contains("request_id=" + requestId));
        assertTrue(message.contains(errorType.getName()));
        assertTrue(message.contains("error_category=" + category));
        assertNoSensitiveData(message);
    }

    private void assertInternalResponse(MockHttpServletResponse response, String requestId) throws Exception {
        assertEquals(500, response.getStatus());
        var body = json.readValue(response.getContentAsString(), Map.class);
        assertEquals("INTERNAL_ERROR", body.get("code"));
        assertEquals(requestId, body.get("requestId"));
        assertNull(body.get("data"));
        assertFalse(response.getContentAsString().contains("Exception"));
        assertNoSensitiveData(response.getContentAsString());
    }

    private void assertNoSensitiveData(String output) {
        for (String sentinel : SENSITIVE) assertFalse(output.contains(sentinel), "Sensitive test sentinel leaked");
    }

    private void assertInvalidCredentials(org.junit.jupiter.api.function.Executable operation) {
        var error = assertThrows(ApiException.class, operation);
        assertEquals(401, error.status());
        assertEquals("INVALID_CREDENTIALS", error.code());
    }

    private IllegalStateException firstFault() { return new IllegalStateException(RAW_DETAILS); }
    private IllegalStateException secondFault() { return new IllegalStateException(RAW_DETAILS); }

    private ListAppender<ILoggingEvent> capture(Class<?> type) {
        var logger = (Logger) LoggerFactory.getLogger(type);
        var appender = new ListAppender<ILoggingEvent>();
        appender.start();
        captures.add(new Capture(logger, appender, logger.getLevel(), logger.isAdditive()));
        logger.setLevel(Level.TRACE);
        logger.setAdditive(false);
        logger.addAppender(appender);
        return appender;
    }

    private ILoggingEvent onlyEvent(ListAppender<ILoggingEvent> logs) {
        assertEquals(1, logs.list.size());
        return logs.list.getFirst();
    }

    private record Capture(Logger logger, ListAppender<ILoggingEvent> appender, Level level, boolean additive) {
        void close() {
            logger.detachAppender(appender);
            appender.stop();
            logger.setLevel(level);
            logger.setAdditive(additive);
        }
    }
}
