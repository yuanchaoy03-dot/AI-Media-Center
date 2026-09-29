package com.shichaoya.aimediacenter.media.infrastructure.persistence;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;

/**
 * 媒体来源的 infrastructure/persistence 入口。目前只按用户 ID 查询 media_source.id，
 * 尚未实现创建、编辑、删除、连接测试、目录浏览或扫描等 SQL 与对应业务能力。
 * 身份链是 JWT.sub → CurrentUser.id → Service → 本 Mapper 的 userId → WHERE user_id；
 * Controller 不让客户端指定 userId，这个筛选是避免用户 A 读到用户 B 来源的重要一环。
 */
@Mapper
public interface MediaSourceMapper {
    @Select("SELECT id FROM media_source WHERE user_id = #{userId}")
    List<String> findIdsByUser(String userId);
}
