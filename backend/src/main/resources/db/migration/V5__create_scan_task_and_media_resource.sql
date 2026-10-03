CREATE TABLE scan_task (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    root_paths_json JSON NOT NULL,
    discovered_count INT NOT NULL DEFAULT 0,
    persisted_count INT NOT NULL DEFAULT 0,
    directory_count INT NOT NULL DEFAULT 0,
    error_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    error_message VARCHAR(256) NULL,
    created_at DATETIME(3) NOT NULL,
    started_at DATETIME(3) NULL,
    finished_at DATETIME(3) NULL,
    active_source_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin
        GENERATED ALWAYS AS (CASE WHEN status IN ('PENDING', 'RUNNING') THEN source_id ELSE NULL END) STORED,
    CONSTRAINT pk_scan_task PRIMARY KEY (id),
    CONSTRAINT fk_scan_task_source FOREIGN KEY (source_id) REFERENCES media_source(id) ON DELETE RESTRICT,
    CONSTRAINT uq_scan_task_active_source UNIQUE (active_source_id),
    INDEX ix_scan_task_source_created (source_id, created_at DESC, id DESC),
    CONSTRAINT ck_scan_task_status CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    CONSTRAINT ck_scan_task_counts CHECK (discovered_count >= 0 AND persisted_count >= 0
        AND persisted_count <= discovered_count AND directory_count >= 0),
    CONSTRAINT ck_scan_task_roots CHECK (JSON_TYPE(root_paths_json) = 'ARRAY' AND JSON_LENGTH(root_paths_json) BETWEEN 1 AND 32)
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE media_resource (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    path VARCHAR(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    path_hash BINARY(32) NOT NULL,
    name VARCHAR(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    size BIGINT NULL,
    modified_at DATETIME(3) NULL,
    recognition_status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'UNIDENTIFIED',
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    CONSTRAINT pk_media_resource PRIMARY KEY (id),
    CONSTRAINT fk_media_resource_source FOREIGN KEY (source_id) REFERENCES media_source(id) ON DELETE RESTRICT,
    CONSTRAINT uq_media_resource_source_path_hash UNIQUE (source_id, path_hash),
    INDEX ix_media_resource_source_created (source_id, created_at DESC, id DESC),
    CONSTRAINT ck_media_resource_size CHECK (size IS NULL OR size >= 0),
    CONSTRAINT ck_media_resource_recognition CHECK (recognition_status = 'UNIDENTIFIED')
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
