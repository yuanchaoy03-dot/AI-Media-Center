package com.shichaoya.aimediacenter.media.application.service;

import java.time.Instant;

public record MediaResource(String id, String sourceId, String path, String name, Long size,
                             Instant modifiedAt, String recognitionStatus) {}
