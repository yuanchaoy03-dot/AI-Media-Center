package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.application.port.MediaSourceAdapter;
import com.shichaoya.aimediacenter.media.domain.MediaDirectory;
import com.shichaoya.aimediacenter.media.domain.SourceDirectoryPath;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.security.SourceConnectionEncryption;
import org.springframework.stereotype.Service;

/** 本人来源的只读浏览。先核实归属，再解密及访问 WebDAV；不写业务表或触发扫描。 */
@Service
public class MediaSourceDirectoryService {
    private final MediaSourceMapper sources;
    private final SourceConnectionEncryption encryption;
    private final MediaSourceAdapter adapter;
    public MediaSourceDirectoryService(MediaSourceMapper sources, SourceConnectionEncryption encryption,
                                       MediaSourceAdapter adapter) {
        this.sources = sources; this.encryption = encryption; this.adapter = adapter;
    }
    public MediaDirectory browse(CurrentUser user, String sourceId, String path) {
        var source = sources.findOwned(user.id(), sourceId);
        if (source == null) throw new ApiException(404, "SOURCE_NOT_FOUND", "未找到这个媒体来源。");
        String normalized = SourceDirectoryPath.normalize(path);
        var connection = encryption.decrypt(source.connectionConfigCiphertext(), source.userId(), source.id());
        // enabled 控制后续扫描，不阻止只读浏览，也不将历史连接测试结果当作当前在线状态。
        return adapter.browseDirectory(connection, normalized);
    }
}
