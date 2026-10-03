package com.shichaoya.aimediacenter.media.application.service;

import java.time.Instant;
import java.util.List;

public record MediaScanTask(String id, String sourceId, String status, List<String> rootPaths,
                            int discoveredCount, int persistedCount, int directoryCount,
                            String errorCode, String errorMessage, Instant createdAt,
                            Instant startedAt, Instant finishedAt) {
    public MediaScanTask { rootPaths = List.copyOf(rootPaths); }
}
