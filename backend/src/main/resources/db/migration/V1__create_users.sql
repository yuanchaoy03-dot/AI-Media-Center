-- V1 建立账号表；当前认证用例由 UserMapper 读写它，不在表中保存明文密码或 JWT。
CREATE TABLE users (
    -- 后端生成的 UUIDv7 使用 36 位标准文本表示；ascii_bin 让 ID 按字面值精确比较。
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- 应用层先规范化为小写；唯一约束再兜住并发注册时的同名冲突。
    username VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- 只存 PasswordEncoder 生成的单向散列，不存用户原始密码。
    password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- 当前注册固定写入 USER / ACTIVE；CHECK 防止表中出现约定外的角色或状态。
    role VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'USER',
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'ACTIVE',
    -- DATETIME(3) 保留毫秒但本身不携带时区；当前 INSERT 使用 UTC_TIMESTAMP(3)，统一按 UTC 理解。
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT ck_users_username_format CHECK (
        CHAR_LENGTH(username) BETWEEN 3 AND 32
        AND NOT REGEXP_LIKE(username, '[^a-z0-9_]', 'c')
    ),
    CONSTRAINT ck_users_role CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'DISABLED'))
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
