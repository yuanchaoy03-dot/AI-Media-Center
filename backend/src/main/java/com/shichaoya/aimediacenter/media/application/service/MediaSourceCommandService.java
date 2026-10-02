package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.id.BusinessIds;
import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.media.application.port.MediaSourceAdapter;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.security.SourceConnectionEncryption;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/** 测试和新增连接用例。外部测试先完成，再单行 INSERT，不持有数据库事务访问 WebDAV。 */
@Service
public class MediaSourceCommandService {
    private final MediaSourceAdapter adapter;
    private final MediaSourceMapper sources;
    private final SourceConnectionEncryption encryption;
    private final MediaSourceQueryService queries;
    public MediaSourceCommandService(MediaSourceAdapter adapter, MediaSourceMapper sources,
                                     SourceConnectionEncryption encryption, MediaSourceQueryService queries) {
        this.adapter = adapter; this.sources = sources; this.encryption = encryption; this.queries = queries;
    }
    public record ConnectionTestResult(Instant testedAt) {}
    public ConnectionTestResult testConnection(SourceConnection connection) {
        adapter.testConnection(connection);
        return new ConnectionTestResult(Instant.now().truncatedTo(ChronoUnit.MILLIS));
    }
    public MediaSourceSummary create(CurrentUser user, String name, SourceConnection connection) {
        encryption.requireConfigured();
        // 新增永远重测当前输入，不接受客户端提供的旧成功状态或时间。
        var tested = testConnection(connection);
        var created = Instant.now().truncatedTo(ChronoUnit.MILLIS);
        String id = BusinessIds.next();
        var row = new MediaSourceRow(id, user.id(), name, "WEBDAV", encryption.encrypt(connection, user.id(), id), true,
                LocalDateTime.ofInstant(tested.testedAt(), ZoneOffset.UTC), LocalDateTime.ofInstant(created, ZoneOffset.UTC));
        sources.insert(row);
        return queries.summary(row);
    }
}
