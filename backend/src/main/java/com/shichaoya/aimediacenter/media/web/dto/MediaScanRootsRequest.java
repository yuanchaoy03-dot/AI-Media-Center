package com.shichaoya.aimediacenter.media.web.dto;

import com.shichaoya.aimediacenter.common.web.ApiException;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 整批替换只能声明选中的路径，不能指定归属、ID 或启用状态。 */
public record MediaScanRootsRequest(List<String> paths) {
    public static MediaScanRootsRequest parse(Map<String, Object> body) {
        if (body == null || !body.keySet().equals(Set.of("paths")) || !(body.get("paths") instanceof List<?> paths)
                || paths.size() > 32 || paths.stream().anyMatch(path -> !(path instanceof String))) {
            throw new ApiException(400, "VALIDATION_FAILED", "请检查输入内容。", Map.of("paths", "请提交最多 32 个目录路径。"));
        }
        return new MediaScanRootsRequest(paths.stream().map(String.class::cast).toList());
    }
}
