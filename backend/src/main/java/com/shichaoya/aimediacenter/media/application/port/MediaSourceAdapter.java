package com.shichaoya.aimediacenter.media.application.port;

import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.shichaoya.aimediacenter.media.domain.MediaDirectory;

/** 媒体来源协议边界。P0 只实现 WebDAV；测试只读，不创建扫描根或任务。 */
public interface MediaSourceAdapter {
    void testConnection(SourceConnection connection);
    MediaDirectory browseDirectory(SourceConnection connection, String path);
}
