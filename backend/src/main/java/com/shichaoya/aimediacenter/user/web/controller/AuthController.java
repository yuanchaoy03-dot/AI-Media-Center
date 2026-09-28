package com.shichaoya.aimediacenter.user.web.controller;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiResponses;
import com.shichaoya.aimediacenter.user.application.service.AuthService;
import com.shichaoya.aimediacenter.user.web.dto.CredentialsRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

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
        return ApiResponses.success(request, Map.of("accessToken", auth.login(input.username(), input.password()), "tokenType", "Bearer", "expiresIn", 3600));
    }
    @GetMapping("/me")
    public Object me(@AuthenticationPrincipal CurrentUser user, HttpServletRequest request) {
        ApiResponses.noQuery(request);
        return ApiResponses.success(request, Map.of("id", user.id(), "username", user.username(), "role", user.role()));
    }
}
