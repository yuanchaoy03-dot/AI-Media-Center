package com.shichaoya.aimediacenter.media.web.controller;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.common.web.ApiResponses;
import com.shichaoya.aimediacenter.media.application.service.MediaScanService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import java.util.Set;

/** 只接收本人来源 ID；不能用请求体指定身份、连接或扫描路径。 */
@RestController
public class MediaScanController {
    private final MediaScanService scans;
    public MediaScanController(MediaScanService scans) { this.scans = scans; }

    @PostMapping("/api/media-sources/{sourceId}/scans") @ResponseStatus(HttpStatus.ACCEPTED)
    public Object start(@AuthenticationPrincipal CurrentUser user, @PathVariable String sourceId, HttpServletRequest request) {
        ApiResponses.noQuery(request);
        noBody(request);
        return ApiResponses.success(request, scans.start(user, sourceId));
    }
    @GetMapping("/api/media-sources/{sourceId}/scans")
    public Object list(@AuthenticationPrincipal CurrentUser user, @PathVariable String sourceId, HttpServletRequest request) {
        ApiResponses.noQuery(request);
        return ApiResponses.success(request, scans.list(user, sourceId));
    }
    @GetMapping("/api/media-sources/{sourceId}/resources")
    public Object resources(@AuthenticationPrincipal CurrentUser user, @PathVariable String sourceId, HttpServletRequest request) {
        noBody(request);
        var parameters = request.getParameterMap();
        if (!Set.of("page", "pageSize").containsAll(parameters.keySet())
                || parameters.values().stream().anyMatch(values -> values.length != 1)) throw ApiException.invalid();
        int page = integer(parameters.get("page"), 0), pageSize = integer(parameters.get("pageSize"), 50);
        if (page < 0 || pageSize < 1 || pageSize > 100) throw ApiException.invalid();
        return ApiResponses.success(request, scans.resources(user, sourceId, page, pageSize));
    }
    private static int integer(String[] values, int fallback) {
        if (values == null) return fallback;
        if (!values[0].matches("[0-9]+")) throw ApiException.invalid();
        try { return Integer.parseInt(values[0]); }
        catch (NumberFormatException error) { throw ApiException.invalid(); }
    }
    private static void noBody(HttpServletRequest request) {
        if (request.getContentLengthLong() > 0 || request.getHeader("Transfer-Encoding") != null) throw ApiException.invalid();
    }
}
