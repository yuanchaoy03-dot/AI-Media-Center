package com.shichaoya.aimediacenter.media.domain;

import java.util.List;

/** 仅包含来源内路径和直接子项；没有远程 URL、连接凭据或扫描状态。 */
public record MediaDirectory(String path, List<Entry> entries) {
    public MediaDirectory { entries = List.copyOf(entries); }
    public record Entry(String name, String path, String kind) {}
}
