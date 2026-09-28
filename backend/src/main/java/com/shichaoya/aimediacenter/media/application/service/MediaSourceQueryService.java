package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class MediaSourceQueryService {
    private final MediaSourceMapper sources;
    public MediaSourceQueryService(MediaSourceMapper sources) { this.sources = sources; }
    public List<String> list(CurrentUser user) {
        var ids = sources.findIdsByUser(user.id());
        // Non-empty DTO is not yet agreed: never disguise existing sources as an empty library.
        if (!ids.isEmpty()) throw new ApiException(501, "SOURCE_LIST_NOT_READY", "来源列表暂未开放，请稍后再试。");
        return ids;
    }
}
