package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import org.springframework.stereotype.Service;
import java.util.List;

/**
 * 媒体来源查询的 application 用例：Controller 传入当前用户，这里再调用 MediaSourceMapper 查询本人数据。
 * 当前只实现空来源响应；尚无非空来源的正式读取 DTO。
 */
@Service
public class MediaSourceQueryService {
    private final MediaSourceMapper sources;
    public MediaSourceQueryService(MediaSourceMapper sources) { this.sources = sources; }
    public List<String> list(CurrentUser user) {
        // 使用安全链建立的 user.id()，不是客户端声称的 ID；Mapper 的 WHERE user_id 将查询限定为本人。
        var ids = sources.findIdsByUser(user.id());
        // 数据库里已有来源却返回 501 看似反直觉：当前只会查询 ID，尚不能构造正式的非空来源 DTO。
        // 返回 [] 会谎称“本人没有来源”，返回 ID 列表又会把内部临时结构当成正式接口，因此明确报未完成。
        if (!ids.isEmpty()) throw new ApiException(501, "SOURCE_LIST_NOT_READY", "来源列表暂未开放，请稍后再试。");
        return ids;
    }
}
