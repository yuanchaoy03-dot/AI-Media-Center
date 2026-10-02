package com.shichaoya.aimediacenter.media.infrastructure.persistence;

public record MediaScanRootRow(String id, String sourceId, String path, byte[] pathHash, boolean enabled) {}
