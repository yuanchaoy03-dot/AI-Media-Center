package com.shichaoya.aimediacenter.media.domain;

import java.time.Instant;
import java.util.List;

/** 扫描读取的来源内直接子项；可选事实缺失时保持 null，不包含远程 URL 或凭据。 */
public record MediaFileDirectory(String path, List<Entry> entries) {
    public MediaFileDirectory { entries = List.copyOf(entries); }
    public record Entry(String name, String path, String kind, Long size, Instant modifiedAt) {}
}
