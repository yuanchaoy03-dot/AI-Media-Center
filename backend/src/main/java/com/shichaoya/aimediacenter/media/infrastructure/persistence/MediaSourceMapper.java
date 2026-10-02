package com.shichaoya.aimediacenter.media.infrastructure.persistence;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Insert;
import java.util.List;

/**
 * 媒体来源的 infrastructure/persistence 入口。只保存连接、查询本人连接，不建立扫描根或任务。
 * 身份链是 JWT.sub → CurrentUser.id → Service → 本 Mapper 的 userId → WHERE user_id；
 * Controller 不让客户端指定 userId，这个筛选是避免用户 A 读到用户 B 来源的重要一环。
 */
@Mapper
public interface MediaSourceMapper {
    @Select("SELECT id, user_id AS userId, name, source_type AS sourceType, "
            + "connection_config_ciphertext AS connectionConfigCiphertext, enabled, "
            + "last_connection_test_at AS lastConnectionTestAt, created_at AS createdAt "
            + "FROM media_source WHERE user_id = #{userId} ORDER BY created_at DESC, id DESC")
    List<MediaSourceRow> findByUser(String userId);
    @Select("SELECT id, user_id AS userId, name, source_type AS sourceType, "
            + "connection_config_ciphertext AS connectionConfigCiphertext, enabled, "
            + "last_connection_test_at AS lastConnectionTestAt, created_at AS createdAt "
            + "FROM media_source WHERE user_id = #{userId} AND id = #{sourceId}")
    MediaSourceRow findOwned(String userId, String sourceId);
    @Insert("INSERT INTO media_source (id,user_id,name,source_type,connection_config_ciphertext,enabled,"
            + "last_connection_test_at,created_at,updated_at) VALUES "
            + "(#{id},#{userId},#{name},'WEBDAV',#{connectionConfigCiphertext},1,#{lastConnectionTestAt},#{createdAt},#{createdAt})")
    void insert(MediaSourceRow source);
}
