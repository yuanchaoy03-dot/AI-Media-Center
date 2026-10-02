package com.shichaoya.aimediacenter.media.application.service;

import java.time.Instant;

/** 本人来源最小公开 DTO；地址输入禁止内嵌凭据，认证字段与密文永不返回。 */
public record MediaSourceSummary(String id, String name, String type, String address, boolean enabled,
                                 Instant lastConnectionTestAt, Instant createdAt) {}
