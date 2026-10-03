package com.shichaoya.aimediacenter.media.application.service;

import java.util.List;

public record MediaResourcePage(List<MediaResource> items, long total, int page, int pageSize) {
    public MediaResourcePage { items = List.copyOf(items); }
}
