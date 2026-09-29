-- V2 建立来源归属表：users : media_source = 1 : N；一个用户可有多个来源，每个来源只属一个用户。
-- 表结构允许保存 WEBDAV 类型，不代表连接、保存接口、目录浏览或扫描能力已实现。
CREATE TABLE media_source (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    -- NOT NULL + 外键要求每条来源都指向已存在的用户；归属不能留空或指向不存在的 users.id。
    user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    name VARCHAR(80) NOT NULL,
    -- 类型约束目前只允许 WEBDAV；connection_config_ciphertext 为后续加密配置留字段，当前尚无写入用例。
    source_type VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'WEBDAV',
    connection_config_ciphertext BLOB NOT NULL,
    enabled TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT pk_media_source PRIMARY KEY (id),
    -- 有来源仍归属该用户时限制删除用户，避免留下失去归属的来源。
    CONSTRAINT fk_media_source_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    -- 加速按当前用户筛选来源；这是非唯一索引，因为同一用户可以有多条来源。
    INDEX idx_media_source_user_id (user_id),
    -- 数据库约束保护关系和字段取值；Java 安全链建立 CurrentUser、Mapper 使用 WHERE user_id 才负责读取时的本人范围。
    CONSTRAINT ck_media_source_type CHECK (source_type IN ('WEBDAV')),
    CONSTRAINT ck_media_source_enabled CHECK (enabled IN (0, 1))
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
