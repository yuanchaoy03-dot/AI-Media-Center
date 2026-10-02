package com.shichaoya.aimediacenter.common.web;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.user.application.service.AuthService;
import com.shichaoya.aimediacenter.user.web.controller.AuthController;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/**
 * 使用真实 MVC 映射、JSON 转换、认证 Controller、公共过滤器及异常出口；不启动数据库。
 * 只替换 AuthService，并注入已有可信 principal；JWT 与数据库校验由 AuthHttpIntegrationTest 覆盖。
 */
class ApiExceptionHandlerTest {
    private static final CurrentUser USER = new CurrentUser("fixture-user-id", "alice", "USER");
    private static final String PASSWORD = "fixture password 12+";
    private final JsonMapper json = JsonMapper.builder().build();
    private AuthService auth;
    private MockMvc mvc;

    @BeforeEach void setUp() {
        auth = mock(AuthService.class);
        var responses = new ApiResponses(json);
        mvc = MockMvcBuilders.standaloneSetup(new AuthController(auth), new ProtocolFixtureController())
                .setMessageConverters(new JacksonJsonHttpMessageConverter(json))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new ApiExceptionHandler(responses))
                .addFilters(new ApiRequestFilter(responses))
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(USER, null, List.of()));
    }

    @AfterEach void clearContext() { SecurityContextHolder.clearContext(); }

    @Test void unsupportedMethodRetains405AndAllowedMethods() throws Exception {
        var result = mvc.perform(post("/api/auth/me")).andReturn();

        error(result, 405, "METHOD_NOT_ALLOWED");
        assertNotNull(result.getResponse().getHeader("Allow"));
        assertTrue(result.getResponse().getHeader("Allow").contains("GET"));
        verifyNoInteractions(auth);
    }

    @Test void unacceptableRepresentationRetains406WithTheApiErrorEnvelope() throws Exception {
        var result = mvc.perform(get("/api/auth/me").accept(MediaType.IMAGE_PNG)).andReturn();

        error(result, 406, "NOT_ACCEPTABLE");
        verifyNoInteractions(auth);
    }

    @Test void unsupportedRequestMediaTypeRetains415() throws Exception {
        var result = mvc.perform(post("/api/auth/login")
                .contentType(MediaType.TEXT_PLAIN).content("invalid request representation")).andReturn();

        error(result, 415, "UNSUPPORTED_MEDIA_TYPE");
        verifyNoInteractions(auth);
    }

    @Test void unmappedApiPathRetains404() throws Exception {
        error(mvc.perform(get("/api/unknown-fixture-path")).andReturn(), 404, "NOT_FOUND");
        verifyNoInteractions(auth);
    }

    @Test void malformedJsonRemainsValidationFailure() throws Exception {
        error(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":")).andReturn(), 400, "VALIDATION_FAILED");
        verifyNoInteractions(auth);
    }

    @Test void missingRequiredRequestParameterRemainsValidationFailure() throws Exception {
        error(mvc.perform(get("/api/protocol-fixture/required")).andReturn(), 400, "VALIDATION_FAILED");
        verifyNoInteractions(auth);
    }

    @Test void frameworkServerErrorStillReturns500WithoutItsReason() throws Exception {
        var result = mvc.perform(get("/api/protocol-fixture/server-error")).andReturn();

        error(result, 500, "INTERNAL_ERROR");
        assertFalse(result.getResponse().getContentAsString().contains("sensitive framework fixture"));
        verifyNoInteractions(auth);
    }

    @Test void normalRegistrationLoginAndIdentityResponsesRemainUnchanged() throws Exception {
        when(auth.register("alice", PASSWORD)).thenReturn(USER);
        when(auth.login("alice", PASSWORD)).thenReturn("fixture-issued-token");
        String credentials = json.writeValueAsString(Map.of("username", " ALICE ", "password", PASSWORD));

        var registered = success(mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(credentials)).andReturn(), 201);
        assertEquals(Map.of("id", USER.id(), "username", USER.username(), "role", USER.role()), registered.get("data"));
        var loggedIn = success(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(credentials)).andReturn(), 200);
        assertEquals(Map.of("accessToken", "fixture-issued-token", "tokenType", "Bearer", "expiresIn", 3600), loggedIn.get("data"));
        var identity = success(mvc.perform(get("/api/auth/me")).andReturn(), 200);
        assertEquals(registered.get("data"), identity.get("data"));
        verify(auth).register("alice", PASSWORD);
        verify(auth).login("alice", PASSWORD);
        verifyNoMoreInteractions(auth);
    }

    @Test void knownAuthenticationFailureRemains401WithItsOriginalMessage() throws Exception {
        String message = "用户名或密码错误，或账号暂不可用。";
        when(auth.login("alice", PASSWORD)).thenThrow(new ApiException(401, "INVALID_CREDENTIALS", message));

        var result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "alice", "password", PASSWORD)))).andReturn();

        assertEquals(message, error(result, 401, "INVALID_CREDENTIALS").get("message"));
        assertNull(result.getResponse().getHeader("WWW-Authenticate"));
    }

    @Test void unexpectedServerFailureStillReturns500WithoutInternalDetails() throws Exception {
        when(auth.login("alice", PASSWORD)).thenThrow(new IllegalStateException("sensitive diagnostic fixture"));

        var result = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", "alice", "password", PASSWORD)))).andReturn();

        error(result, 500, "INTERNAL_ERROR");
        assertFalse(result.getResponse().getContentAsString().contains("sensitive diagnostic fixture"));
        assertFalse(result.getResponse().getContentAsString().contains(PASSWORD));
    }

    private Map<?, ?> error(MvcResult result, int status, String code) throws Exception {
        var body = envelope(result, status, code);
        assertNull(body.get("data"));
        assertInstanceOf(String.class, body.get("message"));
        assertFalse(((String) body.get("message")).isBlank());
        String serialized = result.getResponse().getContentAsString();
        assertFalse(serialized.contains("Exception"));
        assertFalse(serialized.contains("stackTrace"));
        assertFalse(serialized.contains("at com.shichaoya"));
        return body;
    }

    private Map<?, ?> success(MvcResult result, int status) throws Exception {
        var body = envelope(result, status, "OK");
        assertEquals("", body.get("message"));
        assertNotNull(body.get("data"));
        return body;
    }

    private Map<?, ?> envelope(MvcResult result, int status, String code) throws Exception {
        var response = result.getResponse();
        assertEquals(status, response.getStatus());
        assertTrue(MediaType.APPLICATION_JSON.isCompatibleWith(MediaType.parseMediaType(response.getContentType())));
        assertEquals("no-store", response.getHeader("Cache-Control"));
        var body = json.readValue(response.getContentAsString(), Map.class);
        assertEquals(Set.of("code", "message", "data", "requestId"), body.keySet());
        assertEquals(code, body.get("code"));
        assertInstanceOf(String.class, body.get("requestId"));
        assertFalse(((String) body.get("requestId")).isBlank());
        assertDoesNotThrow(() -> UUID.fromString((String) body.get("requestId")));
        assertEquals(result.getRequest().getAttribute("requestId"), body.get("requestId"));
        return body;
    }

    @RestController
    static class ProtocolFixtureController {
        @GetMapping("/api/protocol-fixture/required")
        public Object required(@RequestParam("required") String value) { return Map.of("value", value); }

        @GetMapping("/api/protocol-fixture/server-error")
        public Object serverError() {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "sensitive framework fixture");
        }
    }
}
