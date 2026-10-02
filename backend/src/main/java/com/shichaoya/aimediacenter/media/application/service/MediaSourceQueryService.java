package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.security.SourceConnectionEncryption;
import org.springframework.stereotype.Service;
import java.time.ZoneOffset;
import java.util.List;

/**
 * 媒体来源查询的 application 用例：Controller 传入当前用户，这里再调用 MediaSourceMapper 查询本人数据。
 * 非空列表仅解密本人连接以构造公开 DTO；凭据永不进入响应。
 */
@Service
public class MediaSourceQueryService {
    private final MediaSourceMapper sources;
    private final SourceConnectionEncryption encryption;
    public MediaSourceQueryService(MediaSourceMapper sources, SourceConnectionEncryption encryption) {
        this.sources = sources; this.encryption = encryption;
    }
    public List<MediaSourceSummary> list(CurrentUser user) {
        // 使用安全链建立的 user.id()，不是客户端声称的 ID；Mapper 的 WHERE user_id 将查询限定为本人。
        return sources.findByUser(user.id()).stream().map(this::summary).toList();
    }
    public MediaSourceSummary summary(MediaSourceRow row) {
        var connection = encryption.decrypt(row.connectionConfigCiphertext(), row.userId(), row.id());
        return new MediaSourceSummary(row.id(), row.name(), "WebDAV", connection.address(), row.enabled(),
                row.lastConnectionTestAt() == null ? null : row.lastConnectionTestAt().toInstant(ZoneOffset.UTC),
                row.createdAt().toInstant(ZoneOffset.UTC));
    }
}
