package com.shichaoya.aimediacenter.media.infrastructure.persistence;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface MediaSourceMapper {
    @Select("SELECT id FROM media_source WHERE user_id = #{userId}")
    List<String> findIdsByUser(String userId);
}
