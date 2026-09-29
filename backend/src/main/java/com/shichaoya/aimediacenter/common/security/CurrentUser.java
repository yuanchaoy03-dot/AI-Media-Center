package com.shichaoya.aimediacenter.common.security;

/**
 * 当前请求可用的用户身份快照。受保护请求经 JWT 校验后，由 AuthService 根据数据库现状创建；
 * Spring Security 将它放入 Authentication.principal，Controller 可用 @AuthenticationPrincipal 取得。
 * 不包含密码散列，也不直接暴露 UserRow 这样的持久化对象。
 */
public record CurrentUser(String id, String username, String role) {}
