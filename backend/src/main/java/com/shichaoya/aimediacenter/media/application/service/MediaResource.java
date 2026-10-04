package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.media.domain.MediaFileNameParser.NameCandidate;
import java.time.Instant;

public record MediaResource(String id, String sourceId, String path, String name, Long size,
                             Instant modifiedAt, String recognitionStatus, NameCandidate nameCandidate) {}
