package com.shichaoya.aimediacenter.media.infrastructure.persistence;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;

/** 仅在应用层核实本人来源后访问。写入由来源行锁与短事务串行化。 */
@Mapper
public interface MediaScanRootMapper {
    @Select("SELECT id, source_id AS sourceId, path, path_hash AS pathHash, enabled FROM media_scan_root WHERE source_id = #{sourceId}")
    List<MediaScanRootRow> findBySource(String sourceId);
    @Insert("INSERT INTO media_scan_root (id,source_id,path,path_hash,enabled,created_at,updated_at) VALUES "
            + "(#{id},#{sourceId},#{path},#{pathHash},#{enabled},UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))")
    void insert(MediaScanRootRow root);
    @Delete("DELETE FROM media_scan_root WHERE source_id = #{sourceId} AND id = #{id}")
    void delete(String sourceId, String id);
}
