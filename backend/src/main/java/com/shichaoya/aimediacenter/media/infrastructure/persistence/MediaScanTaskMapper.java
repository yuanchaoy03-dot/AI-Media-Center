package com.shichaoya.aimediacenter.media.infrastructure.persistence;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import java.util.List;

@Mapper
public interface MediaScanTaskMapper {
    String COLUMNS = "t.id, t.source_id AS sourceId, t.status, CAST(t.root_paths_json AS CHAR) AS rootPathsJson, "
            + "t.discovered_count AS discoveredCount, t.persisted_count AS persistedCount, t.directory_count AS directoryCount, "
            + "t.error_code AS errorCode, t.error_message AS errorMessage, t.created_at AS createdAt, "
            + "t.started_at AS startedAt, t.finished_at AS finishedAt ";
    @Select("SELECT " + COLUMNS + "FROM scan_task t WHERE t.source_id = #{sourceId} AND t.status IN ('PENDING','RUNNING')")
    MediaScanTaskRow findActive(String sourceId);
    @Select("SELECT " + COLUMNS + "FROM scan_task t JOIN media_source s ON s.id = t.source_id "
            + "WHERE s.user_id = #{userId} AND t.source_id = #{sourceId} ORDER BY t.created_at DESC, t.id DESC LIMIT 20")
    List<MediaScanTaskRow> findOwnedRecent(String userId, String sourceId);
    @Insert("INSERT INTO scan_task (id,source_id,status,root_paths_json,created_at) "
            + "VALUES (#{id},#{sourceId},'PENDING',#{rootPathsJson},#{createdAt})")
    void insert(MediaScanTaskRow task);
    @Update("UPDATE scan_task SET status='RUNNING',started_at=UTC_TIMESTAMP(3) WHERE id=#{id} AND status='PENDING'")
    int start(String id);
    @Select("SELECT status FROM scan_task WHERE id=#{id} FOR UPDATE")
    String lockStatus(String id);
    @Update("UPDATE scan_task SET discovered_count=#{discovered},persisted_count=#{persisted},directory_count=#{directories} "
            + "WHERE id=#{id} AND status='RUNNING'")
    void progress(String id, int discovered, int persisted, int directories);
    @Update("UPDATE scan_task SET status=#{status},discovered_count=#{discovered},persisted_count=#{persisted},"
            + "directory_count=#{directories},error_code=#{errorCode},error_message=#{errorMessage},finished_at=UTC_TIMESTAMP(3) "
            + "WHERE id=#{id} AND status IN ('PENDING','RUNNING')")
    void finish(String id, String status, int discovered, int persisted, int directories, String errorCode, String errorMessage);
    @Update("UPDATE scan_task SET status='FAILED',error_code='SCAN_INTERRUPTED',"
            + "error_message='服务重启或关闭，扫描已中断，请重新发起。',finished_at=UTC_TIMESTAMP(3) "
            + "WHERE status IN ('PENDING','RUNNING')")
    int failInterrupted();
}
