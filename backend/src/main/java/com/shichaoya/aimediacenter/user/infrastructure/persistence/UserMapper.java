package com.shichaoya.aimediacenter.user.infrastructure.persistence;

import org.apache.ibatis.annotations.*;

/**
 * infrastructure/persistence 的 MyBatis 数据库入口。AuthService 决定注册、登录与账号状态规则，
 * UserMapper 只执行 users 表的 SQL；Controller 不直接访问数据库。
 * #{...} 是 MyBatis 参数绑定占位符，值来自方法参数或 UserRow 属性，不是手工拼接 SQL 字符串。
 */
@Mapper
public interface UserMapper {
    @Select("SELECT id, username, password_hash AS passwordHash, role, status FROM users WHERE username = #{username}")
    UserRow byUsername(String username);
    @Select("SELECT id, username, password_hash AS passwordHash, role, status FROM users WHERE id = #{id}")
    UserRow byId(String id);
    // Java 中的新账号固定 USER / ACTIVE；INSERT 也固定这两个值，创建时间由数据库写入 UTC 毫秒时间。
    @Insert("INSERT INTO users (id,username,password_hash,role,status,created_at,updated_at) "
            + "VALUES (#{id},#{username},#{passwordHash},'USER','ACTIVE',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))")
    void insert(UserRow user);
}
