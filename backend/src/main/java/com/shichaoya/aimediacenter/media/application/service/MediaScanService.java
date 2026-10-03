package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.id.BusinessIds;
import com.shichaoya.aimediacenter.common.security.CurrentUser;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.domain.SourceDirectoryPath;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaResourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanRootMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanRootRow;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanTaskMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanTaskRow;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceRow;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** 来源行锁仅用于任务创建；扫描范围在短事务内冻结，网络访问交给有界后台执行器。 */
@Service
public class MediaScanService {
    private final MediaSourceMapper sources;
    private final MediaScanRootMapper roots;
    private final MediaScanTaskMapper tasks;
    private final MediaResourceMapper resources;
    private final MediaScanRunner runner;
    private final ObjectMapper json;
    private final TransactionTemplate transaction;
    private final TransactionTemplate resourceQuery;

    public MediaScanService(MediaSourceMapper sources, MediaScanRootMapper roots, MediaScanTaskMapper tasks,
                            MediaResourceMapper resources, MediaScanRunner runner, ObjectMapper json,
                            PlatformTransactionManager transactions) {
        this.sources = sources; this.roots = roots; this.tasks = tasks; this.resources = resources;
        this.runner = runner; this.json = json; this.transaction = new TransactionTemplate(transactions);
        this.resourceQuery = new TransactionTemplate(transactions);
        this.resourceQuery.setReadOnly(true);
        this.resourceQuery.setIsolationLevel(TransactionDefinition.ISOLATION_REPEATABLE_READ);
    }

    public MediaScanTask start(CurrentUser user, String sourceId) {
        var created = transaction.execute(status -> {
            var source = sources.lockOwned(user.id(), sourceId);
            if (source == null) throw sourceNotFound();
            if (!source.enabled()) throw new ApiException(409, "SOURCE_DISABLED", "来源已停用，请启用后再扫描。");
            var active = tasks.findActive(sourceId);
            if (active != null) return new Creation(active, source, List.of(), false);
            var frozenRoots = validatedRoots(sourceId, roots.findBySource(sourceId));
            var task = new MediaScanTaskRow(BusinessIds.next(), sourceId, "PENDING", json.writeValueAsString(frozenRoots),
                    0, 0, 0, null, null, LocalDateTime.now(ZoneOffset.UTC), null, null);
            tasks.insert(task);
            return new Creation(task, source, frozenRoots, true);
        });
        if (created == null) throw ApiException.internal();
        if (created.isNew() && !runner.submit(created.task().id(), created.source(), created.rootPaths())) {
            tasks.finish(created.task().id(), "FAILED", 0, 0, 0, "SCAN_QUEUE_FULL", "扫描队列已满，请稍后重试。");
            throw new ApiException(503, "SCAN_QUEUE_FULL", "扫描队列已满，请稍后重试。");
        }
        return project(created.task());
    }

    public List<MediaScanTask> list(CurrentUser user, String sourceId) {
        requireOwned(user, sourceId);
        return tasks.findOwnedRecent(user.id(), sourceId).stream().map(this::project).toList();
    }

    public MediaResourcePage resources(CurrentUser user, String sourceId, int page, int pageSize) {
        requireOwned(user, sourceId);
        if (page < 0 || pageSize < 1 || pageSize > 100) throw ApiException.invalid();
        // 同一只读一致快照，扫描并发插入不能使 total 小于本页已返回的条目数。
        var result = resourceQuery.execute(status -> {
            long total = resources.countOwned(user.id(), sourceId);
            var items = resources.findOwnedPage(user.id(), sourceId, pageSize, (long) page * pageSize).stream()
                    .map(row -> new MediaResource(row.id(), row.sourceId(), row.path(), row.name(), row.size(),
                            instant(row.modifiedAt()), "unidentified")).toList();
            return new MediaResourcePage(items, total, page, pageSize);
        });
        if (result == null) throw ApiException.internal();
        return result;
    }

    private void requireOwned(CurrentUser user, String sourceId) {
        if (sources.findOwned(user.id(), sourceId) == null) throw sourceNotFound();
    }

    private static List<String> validatedRoots(String sourceId, List<MediaScanRootRow> rows) {
        if (rows == null || rows.size() > 32) throw invalidRoots();
        var allPaths = new ArrayList<String>();
        var enabledPaths = new ArrayList<String>();
        for (var root : rows) {
            final String path;
            try { path = SourceDirectoryPath.normalize(root.path()); }
            catch (RuntimeException error) { throw invalidRoots(); }
            if (!sourceId.equals(root.sourceId()) || !path.equals(root.path()) || !Arrays.equals(hash(path), root.pathHash())) {
                throw invalidRoots();
            }
            for (var existing : allPaths) {
                if (path.equals(existing) || descendant(path, existing) || descendant(existing, path)) throw invalidRoots();
            }
            allPaths.add(path);
            if (root.enabled()) enabledPaths.add(path);
        }
        if (enabledPaths.isEmpty()) throw new ApiException(409, "SCAN_ROOTS_REQUIRED", "请先选择至少一个已启用的扫描目录。");
        enabledPaths.sort(Comparator.naturalOrder());
        return List.copyOf(enabledPaths);
    }

    private MediaScanTask project(MediaScanTaskRow row) {
        var tree = json.readTree(row.rootPathsJson());
        if (!tree.isArray() || tree.isEmpty() || tree.size() > 32) throw ApiException.internal();
        var paths = new ArrayList<String>();
        for (var path : tree) {
            if (!path.isString()) throw ApiException.internal();
            paths.add(path.asString());
        }
        return new MediaScanTask(row.id(), row.sourceId(), row.status().toLowerCase(Locale.ROOT), paths,
                row.discoveredCount(), row.persistedCount(), row.directoryCount(), row.errorCode(), row.errorMessage(),
                instant(row.createdAt()), instant(row.startedAt()), instant(row.finishedAt()));
    }

    static byte[] hash(String path) {
        try { return MessageDigest.getInstance("SHA-256").digest(path.getBytes(StandardCharsets.UTF_8)); }
        catch (NoSuchAlgorithmException error) { throw new IllegalStateException("SHA-256 unavailable", error); }
    }
    static boolean descendant(String path, String ancestor) { return ancestor.equals("/") || path.startsWith(ancestor + "/"); }
    private static Instant instant(LocalDateTime value) { return value == null ? null : value.toInstant(ZoneOffset.UTC); }
    private static ApiException sourceNotFound() { return new ApiException(404, "SOURCE_NOT_FOUND", "未找到这个媒体来源。"); }
    private static ApiException invalidRoots() { return new ApiException(409, "SCAN_ROOTS_INVALID", "扫描范围无效，请重新选择目录后保存。"); }
    private record Creation(MediaScanTaskRow task, MediaSourceRow source, List<String> rootPaths, boolean isNew) {}
}
