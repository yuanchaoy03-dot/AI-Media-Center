package com.shichaoya.aimediacenter.media.application.port;

import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import com.shichaoya.aimediacenter.media.domain.MediaDirectory;
import java.util.List;

/** 媒体来源协议边界。P0 只实现 WebDAV；测试只读，不创建扫描根或任务。 */
public interface MediaSourceAdapter {
    void testConnection(SourceConnection connection);
    MediaDirectory browseDirectory(SourceConnection connection, String path);
    /** 整批只读验证目录，必须共用有限的网络截止时间。 */
    void validateDirectories(SourceConnection connection, List<String> paths);
}
