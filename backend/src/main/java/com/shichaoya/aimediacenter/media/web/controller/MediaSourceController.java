package com.shichaoya.aimediacenter.media.web.controller;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiResponses;
import com.shichaoya.aimediacenter.media.application.service.MediaSourceQueryService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

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
