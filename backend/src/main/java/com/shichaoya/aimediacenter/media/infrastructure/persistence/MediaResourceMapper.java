package com.shichaoya.aimediacenter.media.infrastructure.persistence;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import java.util.List;

@Mapper
public interface MediaResourceMapper {
    String COLUMNS = "r.id,r.source_id AS sourceId,r.path,r.path_hash AS pathHash,r.name,r.size,"
            + "r.modified_at AS modifiedAt,r.recognition_status AS recognitionStatus ";
    @Select("SELECT " + COLUMNS + "FROM media_resource r WHERE r.source_id=#{sourceId} AND r.path_hash=#{pathHash} FOR UPDATE")
    MediaResourceRow lockByPathHash(String sourceId, byte[] pathHash);
    @Insert("INSERT INTO media_resource (id,source_id,path,path_hash,name,size,modified_at,recognition_status,created_at,updated_at) "
            + "VALUES (#{id},#{sourceId},#{path},#{pathHash},#{name},#{size},#{modifiedAt},'UNIDENTIFIED',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))")
    void insert(MediaResourceRow resource);
    @Update("UPDATE media_resource SET name=#{name},size=#{size},modified_at=#{modifiedAt},updated_at=UTC_TIMESTAMP(3) "
            + "WHERE id=#{id} AND source_id=#{sourceId} AND path_hash=#{pathHash} AND BINARY path=BINARY #{path}")
    int updateFacts(MediaResourceRow resource);
    @Select("SELECT " + COLUMNS + "FROM media_resource r JOIN media_source s ON s.id=r.source_id "
            + "WHERE s.user_id=#{userId} AND r.source_id=#{sourceId} ORDER BY r.created_at DESC,r.id DESC LIMIT #{limit} OFFSET #{offset}")
    List<MediaResourceRow> findOwnedPage(String userId, String sourceId, int limit, long offset);
    @Select("SELECT COUNT(*) FROM media_resource r JOIN media_source s ON s.id=r.source_id "
            + "WHERE s.user_id=#{userId} AND r.source_id=#{sourceId}")
    long countOwned(String userId, String sourceId);
}
