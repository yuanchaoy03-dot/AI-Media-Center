package com.shichaoya.aimediacenter.media.infrastructure.persistence;

import java.time.LocalDateTime;

/** 来源文件事实；P0 未识别资源不伪造 Movie 或进入个人片库。 */
public record MediaResourceRow(String id, String sourceId, String path, byte[] pathHash, String name,
                               Long size, LocalDateTime modifiedAt, String recognitionStatus) {}
