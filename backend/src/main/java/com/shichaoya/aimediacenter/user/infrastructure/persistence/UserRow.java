package com.shichaoya.aimediacenter.user.infrastructure.persistence;

/** users 表查询/写入所用的持久化数据，不直接作为 HTTP 响应；包含密码散列。 */
public record UserRow(String id, String username, String passwordHash, String role, String status) {
    // 避免日志意外打印 record 时输出密码散列。
    @Override public String toString() { return "UserRow[redacted]"; }
}
