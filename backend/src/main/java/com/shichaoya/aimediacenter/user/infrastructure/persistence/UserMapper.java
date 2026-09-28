package com.shichaoya.aimediacenter.user.infrastructure.persistence;

import org.apache.ibatis.annotations.*;

@Mapper
public interface UserMapper {
    @Select("SELECT id, username, password_hash AS passwordHash, role, status FROM users WHERE username = #{username}")
    UserRow byUsername(String username);
    @Select("SELECT id, username, password_hash AS passwordHash, role, status FROM users WHERE id = #{id}")
    UserRow byId(String id);
    @Insert("INSERT INTO users (id,username,password_hash,role,status,created_at,updated_at) "
            + "VALUES (#{id},#{username},#{passwordHash},'USER','ACTIVE',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))")
    void insert(UserRow user);
}
