package com.shichaoya.aimediacenter.media.application.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 单实例有限队列、遍历量和整体截止时间；配置不允许取消上限。 */
@Component
public record MediaScanLimits(int workers, int queueCapacity, int maxDirectories, int maxResources,
                              int maxEntries, int maxDepth, int maxSeconds) {
    public MediaScanLimits(@Value("${app.media-scan.workers:1}") int workers,
                           @Value("${app.media-scan.queue-capacity:8}") int queueCapacity,
                           @Value("${app.media-scan.max-directories:5000}") int maxDirectories,
                           @Value("${app.media-scan.max-resources:20000}") int maxResources,
                           @Value("${app.media-scan.max-entries:100000}") int maxEntries,
                           @Value("${app.media-scan.max-depth:64}") int maxDepth,
                           @Value("${app.media-scan.max-seconds:300}") int maxSeconds) {
        if (workers < 1 || workers > 4 || queueCapacity < 1 || queueCapacity > 32
                || maxDirectories < 1 || maxDirectories > 50000 || maxResources < 1 || maxResources > 200000
                || maxEntries < 1 || maxEntries > 1000000 || maxDepth < 1 || maxDepth > 128
                || maxSeconds < 1 || maxSeconds > 3600) {
            throw new IllegalArgumentException("Invalid media scan budget configuration");
        }
        this.workers = workers; this.queueCapacity = queueCapacity; this.maxDirectories = maxDirectories;
        this.maxResources = maxResources; this.maxEntries = maxEntries; this.maxDepth = maxDepth; this.maxSeconds = maxSeconds;
    }
}
