package com.shichaoya.aimediacenter.media.application.service;

import com.shichaoya.aimediacenter.common.id.BusinessIds;
import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.application.port.MediaSourceAdapter;
import com.shichaoya.aimediacenter.media.domain.MediaFileDirectory;
import com.shichaoya.aimediacenter.media.domain.SourceDirectoryPath;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaResourceMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaResourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaScanTaskMapper;
import com.shichaoya.aimediacenter.media.infrastructure.persistence.MediaSourceRow;
import com.shichaoya.aimediacenter.media.infrastructure.security.SourceConnectionEncryption;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDateTime;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/** 单实例后台扫描。每次 Depth:1，文件事实逐项短事务保存；失败不删除任何历史资源。 */
@Component
@DependsOnDatabaseInitialization
public class MediaScanRunner {
    private static final Logger LOG = LoggerFactory.getLogger(MediaScanRunner.class);
    private static final Set<String> VIDEO_EXTENSIONS = Set.of("mkv", "mp4", "avi", "mov", "wmv", "flv", "m4v", "webm",
            "ts", "m2ts", "mts", "mpg", "mpeg", "vob", "ogv", "3gp");
    private static final Map<String, String> SAFE_ERRORS = Map.ofEntries(
            Map.entry("SOURCE_AUTH_FAILED", "来源认证失败或无权访问目录，请检查账号和密码。"),
            Map.entry("SOURCE_CONNECTION_FAILED", "无法连接来源目录，请检查地址及服务状态。"),
            Map.entry("SOURCE_CONNECTION_TIMEOUT", "来源连接超时，请检查网络后重试。"),
            Map.entry("SOURCE_REDIRECT_UNSUPPORTED", "来源发生重定向，请填写最终 WebDAV 目录地址。"),
            Map.entry("SOURCE_NOT_WEBDAV", "来源未返回有效的 WebDAV 目录。"),
            Map.entry("SOURCE_DIRECTORY_INVALID", "来源未返回有效、完整的目录，扫描已停止。"),
            Map.entry("SOURCE_DIRECTORY_NOT_FOUND", "扫描目录不存在，请重新选择范围。"),
            Map.entry("SOURCE_CONFIG_INVALID", "来源配置无法读取，请联系部署维护者。"),
            Map.entry("SOURCE_CONFIG_UNAVAILABLE", "来源加密密钥尚未正确配置。"),
            Map.entry("SCAN_LIMIT_EXCEEDED", "扫描超出遍历上限，请缩小范围后重试。"),
            Map.entry("SCAN_TIMEOUT", "扫描超过整体时间上限，请缩小范围后重试。"),
            Map.entry("SCAN_INTERRUPTED", "服务重启或关闭，扫描已中断，请重新发起。"),
            Map.entry("SCAN_PATH_COLLISION", "资源路径校验失败，扫描已停止。"));
    private final MediaScanTaskMapper tasks;
    private final MediaResourceMapper resources;
    private final SourceConnectionEncryption encryption;
    private final MediaSourceAdapter adapter;
    private final MediaScanLimits limits;
    private final TransactionTemplate transaction;
    private final ThreadPoolExecutor executor;

    public MediaScanRunner(MediaScanTaskMapper tasks, MediaResourceMapper resources, SourceConnectionEncryption encryption,
                           MediaSourceAdapter adapter, MediaScanLimits limits, PlatformTransactionManager transactions) {
        this.tasks = tasks; this.resources = resources; this.encryption = encryption; this.adapter = adapter; this.limits = limits;
        this.transaction = new TransactionTemplate(transactions);
        var sequence = new AtomicInteger();
        this.executor = new ThreadPoolExecutor(limits.workers(), limits.workers(), 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(limits.queueCapacity()), runnable -> {
                    var thread = new Thread(runnable, "media-scan-" + sequence.incrementAndGet());
                    thread.setDaemon(true);
                    return thread;
                }, new ThreadPoolExecutor.AbortPolicy());
    }

    @PostConstruct public void recoverInterrupted() { tasks.failInterrupted(); }

    public boolean submit(String taskId, MediaSourceRow source, List<String> rootPaths) {
        var frozenRoots = List.copyOf(rootPaths);
        try { executor.execute(() -> scan(taskId, source, frozenRoots)); return true; }
        catch (RejectedExecutionException error) { return false; }
    }

    void scan(String taskId, MediaSourceRow source, List<String> rootPaths) {
        var counts = new Counts();
        try {
            if (tasks.start(taskId) != 1) return;
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(limits.maxSeconds());
            var connection = encryption.decrypt(source.connectionConfigCiphertext(), source.userId(), source.id());
            var pending = new ArrayDeque<Directory>();
            var seenDirectories = new HashSet<String>();
            for (String root : rootPaths) addDirectory(pending, seenDirectories, root, 0);
            while (!pending.isEmpty()) {
                checkDeadline(deadline);
                var directory = pending.removeFirst();
                var result = adapter.scanDirectory(connection, directory.path(), deadline);
                checkDeadline(deadline);
                if (result == null || result.entries() == null || !directory.path().equals(result.path())) throw invalidDirectory();
                counts.directories++;
                var seenEntries = new HashSet<String>();
                for (var entry : result.entries()) {
                    checkDeadline(deadline);
                    if (++counts.entries > limits.maxEntries()) throw limit();
                    validateEntry(directory.path(), entry, seenEntries);
                    if (entry.kind().equals("directory")) {
                        addDirectory(pending, seenDirectories, entry.path(), directory.depth() + 1);
                    } else if (isVideo(entry.name())) {
                        if (counts.discovered == limits.maxResources()) throw limit();
                        counts.discovered++;
                        persist(taskId, source.id(), entry, counts);
                        counts.persisted++;
                    }
                }
                tasks.progress(taskId, counts.discovered, counts.persisted, counts.directories);
            }
            checkDeadline(deadline);
            tasks.finish(taskId, "COMPLETED", counts.discovered, counts.persisted, counts.directories, null, null);
        } catch (RuntimeException error) {
            String code = error instanceof ApiException known && SAFE_ERRORS.containsKey(known.code())
                    ? known.code() : "SCAN_FAILED";
            if (Thread.currentThread().isInterrupted()) code = "SCAN_INTERRUPTED";
            try {
                tasks.finish(taskId, "FAILED", counts.discovered, counts.persisted, counts.directories, code,
                        SAFE_ERRORS.getOrDefault(code, "扫描失败，请稍后重试。"));
            } catch (RuntimeException persistenceFailure) {
                // 不记录远程正文、底层异常、连接或凭据；数据库恢复并重启后会将未终结任务标为中断。
                LOG.warn("Could not save scan failure for task {}", taskId);
            }
        }
    }

    private void persist(String taskId, String sourceId, MediaFileDirectory.Entry entry, Counts counts) {
        transaction.executeWithoutResult(status -> {
            // 同一短事务先锁任务，终结后的旧 worker 不能继续落文件事实。
            if (!"RUNNING".equals(tasks.lockStatus(taskId))) {
                throw new ApiException(503, "SCAN_INTERRUPTED", "扫描已中断。");
            }
            var hash = MediaScanService.hash(entry.path());
            var existing = resources.lockByPathHash(sourceId, hash);
            if (existing != null && !existing.path().equals(entry.path())) {
                throw new ApiException(500, "SCAN_PATH_COLLISION", "资源路径校验失败，扫描已停止。");
            }
            var row = new MediaResourceRow(existing == null ? BusinessIds.next() : existing.id(), sourceId, entry.path(),
                    hash, entry.name(), entry.size(), utcModifiedAt(entry.modifiedAt()),
                    existing == null ? "UNIDENTIFIED" : existing.recognitionStatus());
            if (existing == null) resources.insert(row);
            else resources.updateFacts(row);
            // 文件事实与计数同一事务提交，硬中断恢复后的历史计数不会落后于已入库事实。
            tasks.progress(taskId, counts.discovered, counts.persisted + 1, counts.directories);
        });
    }

    private void addDirectory(ArrayDeque<Directory> pending, Set<String> seen, String path, int depth) {
        if (depth > limits.maxDepth() || seen.size() == limits.maxDirectories()) throw limit();
        if (!seen.add(path)) throw invalidDirectory();
        pending.addLast(new Directory(path, depth));
    }

    private static void validateEntry(String directory, MediaFileDirectory.Entry entry, Set<String> seen) {
        if (entry == null) throw invalidDirectory();
        final String normalized;
        try { normalized = SourceDirectoryPath.normalize(entry.path()); }
        catch (RuntimeException error) { throw invalidDirectory(); }
        int slash = normalized.lastIndexOf('/');
        String parent = slash <= 0 ? "/" : normalized.substring(0, slash);
        String name = normalized.substring(slash + 1);
        if (!normalized.equals(entry.path()) || !parent.equals(directory) || !name.equals(entry.name())
                || name.isEmpty() || !seen.add(normalized) || entry.kind() == null || !Set.of("file", "directory").contains(entry.kind())
                || entry.size() != null && entry.size() < 0) throw invalidDirectory();
    }

    private static boolean isVideo(String name) {
        int dot = name.lastIndexOf('.');
        return dot >= 0 && VIDEO_EXTENSIONS.contains(name.substring(dot + 1).toLowerCase(Locale.ROOT));
    }
    private static LocalDateTime utcModifiedAt(Instant value) {
        if (value == null) return null;
        try {
            var utc = LocalDateTime.ofInstant(value, ZoneOffset.UTC);
            return utc.getYear() < 1000 || utc.getYear() > 9999 ? null : utc;
        } catch (DateTimeException error) { return null; }
    }
    private static void checkDeadline(long deadline) {
        if (Thread.currentThread().isInterrupted()) throw new ApiException(503, "SCAN_INTERRUPTED", "扫描已中断。");
        if (System.nanoTime() >= deadline) throw new ApiException(504, "SCAN_TIMEOUT", "扫描超过整体时间上限。");
    }
    private static ApiException limit() { return new ApiException(422, "SCAN_LIMIT_EXCEEDED", "扫描超出遍历上限。"); }
    private static ApiException invalidDirectory() { return new ApiException(422, "SOURCE_DIRECTORY_INVALID", "来源目录无效。"); }

    @PreDestroy public void close() {
        executor.shutdownNow();
        try {
            executor.awaitTermination(5, TimeUnit.SECONDS);
            tasks.failInterrupted();
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        }
    }
    private record Directory(String path, int depth) {}
    private static class Counts { int discovered; int persisted; int directories; int entries; }
}
