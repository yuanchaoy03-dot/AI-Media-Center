CREATE TABLE media_scan_root (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    path VARCHAR(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    path_hash BINARY(32) NOT NULL,
    enabled TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT pk_media_scan_root PRIMARY KEY (id),
    CONSTRAINT fk_media_scan_root_source FOREIGN KEY (source_id) REFERENCES media_source(id) ON DELETE RESTRICT,
    CONSTRAINT uq_media_scan_root_source_path_hash UNIQUE (source_id, path_hash),
    CONSTRAINT ck_media_scan_root_enabled CHECK (enabled IN (0, 1))
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
