ALTER TABLE media_source
    ADD COLUMN last_connection_test_at DATETIME(3) NULL AFTER enabled;
