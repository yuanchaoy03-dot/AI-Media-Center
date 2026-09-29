package com.shichaoya.aimediacenter.media.web.controller;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiResponses;
import com.shichaoya.aimediacenter.media.application.service.MediaSourceQueryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 媒体来源的 web 层。目前仅开放本人来源列表的空列表场景，不负责来源 CRUD。
 * CurrentUser 来自 JWT 经 Spring Security 验证、再查 users 后建立的可信身份；
 * 客户端不能通过传入 userId 选择要查询的用户。
 */
@RestController
public class MediaSourceController {
    private final MediaSourceQueryService sources;
    public MediaSourceController(MediaSourceQueryService sources) { this.sources = sources; }
    @GetMapping("/api/media-sources")
    public Object list(@AuthenticationPrincipal CurrentUser user, HttpServletRequest request) {
        ApiResponses.noQuery(request);
        return ApiResponses.success(request, sources.list(user));
    }
}
