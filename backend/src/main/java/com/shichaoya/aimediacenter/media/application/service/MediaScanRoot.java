package com.shichaoya.aimediacenter.media.application.service;

/** 来源内扫描范围配置；对外不投影连接配置、路径散列或持久化时间。 */
public record MediaScanRoot(String id, String sourceId, String path, boolean enabled) {}
