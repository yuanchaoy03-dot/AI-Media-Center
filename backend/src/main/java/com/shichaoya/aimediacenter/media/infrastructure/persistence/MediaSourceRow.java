package com.shichaoya.aimediacenter.media.infrastructure.persistence;

import java.time.LocalDateTime;

/** media_source 持久化对象；时间按 UTC 解释，不能直接返回 HTTP。 */
public record MediaSourceRow(String id, String userId, String name, String sourceType,
                             byte[] connectionConfigCiphertext, boolean enabled,
                             LocalDateTime lastConnectionTestAt, LocalDateTime createdAt) {
    @Override public String toString() { return "MediaSourceRow[redacted]"; }
}
