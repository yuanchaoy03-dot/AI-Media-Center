package com.shichaoya.aimediacenter.user.infrastructure.persistence;

public record UserRow(String id, String username, String passwordHash, String role, String status) {
    @Override public String toString() { return "UserRow[redacted]"; }
}
