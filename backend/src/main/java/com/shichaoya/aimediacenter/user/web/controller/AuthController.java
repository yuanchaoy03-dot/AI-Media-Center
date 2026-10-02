package com.shichaoya.aimediacenter.user.web.controller;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.common.web.ApiResponses;
import com.shichaoya.aimediacenter.user.application.service.AuthService;
import com.shichaoya.aimediacenter.user.web.dto.CredentialsRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/**
 * 认证模块的 web 层：把 HTTP 输入交给 CredentialsRequest 校验，再调用应用层 AuthService。
 * 注册只返回 CurrentUser；登录才返回 JWT。/me 的身份由 Spring Security 注入，不从请求参数读取用户 ID。
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    public AuthController(AuthService auth) { this.auth = auth; }
    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED)
    public Object register(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        ApiResponses.noQuery(request);
        var input = CredentialsRequest.parse(body, true);
        return ApiResponses.success(request, auth.register(input.username(), input.password()));
    }
    @PostMapping("/login")
    public Object login(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        ApiResponses.noQuery(request);
        var input = CredentialsRequest.parse(body, false);
        String token;
        try { token = auth.login(input.username(), input.password()); }
        catch (ApiException error) {
            if (error.code().equals("INVALID_CREDENTIALS")) {
                // 输入已规范化且只含合法 ASCII；不区分用户不存在、密码错误或账号不可用。
                LoggerFactory.getLogger(getClass()).warn("request_id={} error_category=AUTHENTICATION_FAILED result=FAILURE code=INVALID_CREDENTIALS username_hint={}",
                        request.getAttribute("requestId"), input.username().charAt(0) + "***");
            }
            throw error;
        }
        return ApiResponses.success(request, Map.of("accessToken", token, "tokenType", "Bearer", "expiresIn", 3600));
    }
    @GetMapping("/me")
    public Object me(@AuthenticationPrincipal CurrentUser user, HttpServletRequest request) {
        // SecurityConfiguration 已将数据库复核后的 CurrentUser 放进 Authentication.principal。
        ApiResponses.noQuery(request);
        return ApiResponses.success(request, Map.of("id", user.id(), "username", user.username(), "role", user.role()));
    }
}
