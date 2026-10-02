package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.id.BusinessIds;
import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.application.port.MediaSourceAdapter;
import com.shichaoya.aimediacenter.media.domain.SourceDirectoryPath;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanRootMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanRootRow;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.security.SourceConnectionEncryption;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/** 先完成归属、路径与上游验证，再用短事务替换配置；不启动扫描或修改连接测试时间。 */
@Service
public class MediaScanRootService {
    private final MediaSourceMapper sources;
    private final MediaScanRootMapper roots;
    private final SourceConnectionEncryption encryption;
    private final MediaSourceAdapter adapter;
    private final TransactionTemplate transaction;
    public MediaScanRootService(MediaSourceMapper sources, MediaScanRootMapper roots, SourceConnectionEncryption encryption,
                                MediaSourceAdapter adapter, PlatformTransactionManager transactions) {
        this.sources = sources; this.roots = roots; this.encryption = encryption; this.adapter = adapter;
        this.transaction = new TransactionTemplate(transactions);
    }
    public List<MediaScanRoot> list(CurrentUser user, String sourceId) {
        owned(user, sourceId);
        return project(roots.findBySource(sourceId));
    }
    public List<MediaScanRoot> replace(CurrentUser user, String sourceId, List<String> paths) {
        var source = owned(user, sourceId);
        List<String> normalized = normalize(paths);
        if (!normalized.isEmpty()) {
            var connection = encryption.decrypt(source.connectionConfigCiphertext(), source.userId(), source.id());
            adapter.validateDirectories(connection, normalized);
        }
        // 网络期间不持有数据库事务或行锁；失败保留完整旧配置。
        return transaction.execute(status -> {
            var locked = sources.lockOwned(user.id(), sourceId);
            if (locked == null) throw sourceNotFound();
            if (!Arrays.equals(source.connectionConfigCiphertext(), locked.connectionConfigCiphertext())) {
                throw new ApiException(409, "SOURCE_CONFIG_CHANGED", "来源连接已变更，请重新选择目录后保存。");
            }
            var existing = roots.findBySource(sourceId);
            Map<String, String> hashes = new HashMap<>();
            for (var root : existing) checkHash(hashes, root.path(), root.pathHash());
            for (String path : normalized) checkHash(hashes, path, hash(path));
            var wanted = new HashSet<>(normalized);
            var result = new ArrayList<MediaScanRootRow>();
            for (var root : existing) {
                if (wanted.remove(root.path())) result.add(root);
                else roots.delete(sourceId, root.id());
            }
            for (String path : wanted) {
                var root = new MediaScanRootRow(BusinessIds.next(), sourceId, path, hash(path), true);
                roots.insert(root); result.add(root);
            }
            return project(result);
        });
    }
    private MediaSourceRow owned(CurrentUser user, String sourceId) {
        var source = sources.findOwned(user.id(), sourceId);
        if (source == null) throw sourceNotFound();
        return source;
    }
    private static List<String> normalize(List<String> paths) {
        if (paths == null || paths.size() > 32) throw invalidPaths("请提交最多 32 个目录路径。");
        var normalized = new ArrayList<String>();
        for (String path : paths) {
            final String value;
            try { value = SourceDirectoryPath.normalize(path); }
            catch (ApiException error) { throw invalidPaths("请使用有效的来源内绝对目录路径。"); }
            for (String previous : normalized) {
                if (value.equals(previous) || descendant(value, previous) || descendant(previous, value)) {
                    throw invalidPaths("扫描目录不能重复或同时包含父目录和子目录。");
                }
            }
            normalized.add(value);
        }
        normalized.sort(Comparator.naturalOrder());
        return List.copyOf(normalized);
    }
    private static boolean descendant(String path, String ancestor) {
        return ancestor.equals("/") || path.startsWith(ancestor + "/");
    }
    private static byte[] hash(String path) {
        try { return MessageDigest.getInstance("SHA-256").digest(path.getBytes(StandardCharsets.UTF_8)); }
        catch (NoSuchAlgorithmException error) { throw new IllegalStateException("SHA-256 unavailable", error); }
    }
    private static void checkHash(Map<String, String> hashes, String path, byte[] hash) {
        String previous = hashes.putIfAbsent(HexFormat.of().formatHex(hash), path);
        // 唯一索引不截断 Unicode 长路径；散列相同但原文不同不能被当成同一个根。
        if (previous != null && !previous.equals(path)) throw ApiException.internal();
    }
    private static List<MediaScanRoot> project(List<MediaScanRootRow> rows) {
        return rows.stream().sorted(Comparator.comparing(MediaScanRootRow::path))
                .map(root -> new MediaScanRoot(root.id(), root.sourceId(), root.path(), root.enabled())).toList();
    }
    private static ApiException invalidPaths(String message) {
        return new ApiException(400, "VALIDATION_FAILED", "请检查输入内容。", Map.of("paths", message));
    }
    private static ApiException sourceNotFound() { return new ApiException(404, "SOURCE_NOT_FOUND", "未找到这个媒体来源。"); }
}
