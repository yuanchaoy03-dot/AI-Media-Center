package com.shichaoya.aimediacenter.media.infrastructure.persistence;

import java.time.LocalDateTime;

/** 扫描范围是创建时的 JSON 快照；时间按 UTC 解释，不直接返回 HTTP。 */
public record MediaScanTaskRow(String id, String sourceId, String status, String rootPathsJson,
                               int discoveredCount, int persistedCount, int directoryCount,
                               String errorCode, String errorMessage, LocalDateTime createdAt,
                               LocalDateTime startedAt, LocalDateTime finishedAt) {}
