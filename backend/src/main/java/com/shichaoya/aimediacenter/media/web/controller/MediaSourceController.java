package com.shichaoya.aimediacenter.media.web.controller;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiResponses;
import com.shichaoya.aimediacenter.media.application.service.MediaSourceQueryService;
import com.shichaoya.aimediacenter.media.application.service.MediaSourceCommandService;
import com.shichaoya.aimediacenter.media.application.service.MediaSourceDirectoryService;
import com.shichaoya.aimediacenter.media.web.dto.MediaSourceRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.Set;
import com.shichaoya.aimediacenter.common.web.ApiException;

/**
 * 媒体来源的 web 层：只读测试、新增完整连接、查询本人最小列表。
 * CurrentUser 来自 JWT 经 Spring Security 验证、再查 users 后建立的可信身份；
 * 客户端不能通过传入 userId 选择要查询的用户。
 */
@RestController
public class MediaSourceController {
    private final MediaSourceQueryService sources;
    private final MediaSourceCommandService commands;
    private final MediaSourceDirectoryService directories;
    public MediaSourceController(MediaSourceQueryService sources, MediaSourceCommandService commands,
                                 MediaSourceDirectoryService directories) {
        this.sources = sources; this.commands = commands; this.directories = directories;
    }
    @GetMapping("/api/media-sources")
    public Object list(@AuthenticationPrincipal CurrentUser user, HttpServletRequest request) {
        ApiResponses.noQuery(request);
        return ApiResponses.success(request, sources.list(user));
    }
    @PostMapping("/api/media-sources/test-connection")
    public Object test(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        ApiResponses.noQuery(request);
        var input = MediaSourceRequest.parse(body);
        return ApiResponses.success(request, commands.testConnection(input.connection()));
    }
    @PostMapping("/api/media-sources") @ResponseStatus(HttpStatus.CREATED)
    public Object create(@AuthenticationPrincipal CurrentUser user, @RequestBody Map<String, Object> body,
                         HttpServletRequest request) {
        ApiResponses.noQuery(request);
        var input = MediaSourceRequest.parse(body);
        return ApiResponses.success(request, commands.create(user, input.name(), input.connection()));
    }
    @GetMapping("/api/media-sources/{sourceId}/directory")
    public Object directory(@AuthenticationPrincipal CurrentUser user, @PathVariable String sourceId,
                            HttpServletRequest request) {
        var parameters = request.getParameterMap();
        if (!parameters.keySet().equals(Set.of("path")) || parameters.get("path").length != 1
                || request.getContentLengthLong() > 0 || request.getHeader("Transfer-Encoding") != null) {
            throw ApiException.invalid();
        }
        return ApiResponses.success(request, directories.browse(user, sourceId, parameters.get("path")[0]));
    }
}
