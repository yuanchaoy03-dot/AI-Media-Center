package com.shichaoya.aimediacenter.media.infrastructure.security;

import com.shichaoya.aimediacenter.common.web.ApiException;
import com.shichaoya.aimediacenter.media.domain.SourceConnection;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;

/** v1 | 12 字节随机 nonce | AES-256-GCM 密文及 128 位 tag；AAD 绑定用户与来源 ID。 */
@Component
public class SourceConnectionEncryption {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final SecretKey key;
    private final ObjectMapper mapper;
    public SourceConnectionEncryption(@Value("${app.media-source.encryption-key:}") String encodedKey, ObjectMapper mapper) {
        this.mapper = mapper;
        SecretKey parsed = null;
        try {
            byte[] raw = Base64.getDecoder().decode(encodedKey);
            if (raw.length == 32) parsed = new SecretKeySpec(raw, "AES");
        } catch (IllegalArgumentException ignored) { /* 延迟到需要密钥的用例；认证与空来源仍可启动。 */ }
        this.key = parsed;
    }
    public void requireConfigured() {
        if (key == null) throw new ApiException(503, "SOURCE_CONFIG_UNAVAILABLE", "来源加密密钥尚未正确配置，请联系部署维护者。");
    }
    public byte[] encrypt(SourceConnection connection, String userId, String sourceId) {
        requireConfigured();
        try {
            byte[] nonce = new byte[12];
            RANDOM.nextBytes(nonce);
            var cipher = cipher(Cipher.ENCRYPT_MODE, nonce, userId, sourceId);
            byte[] content = mapper.writeValueAsBytes(Map.of("address", connection.address(),
                    "username", connection.username(), "password", connection.password()));
            byte[] encrypted = cipher.doFinal(content);
            return ByteBuffer.allocate(1 + nonce.length + encrypted.length).put((byte) 1).put(nonce).put(encrypted).array();
        } catch (GeneralSecurityException error) { throw ApiException.internal(); }
    }
    public SourceConnection decrypt(byte[] encrypted, String userId, String sourceId) {
        requireConfigured();
        try {
            if (encrypted == null || encrypted.length < 29 || encrypted[0] != 1) throw new IllegalArgumentException();
            ByteBuffer data = ByteBuffer.wrap(encrypted);
            data.get();
            byte[] nonce = new byte[12];
            data.get(nonce);
            byte[] payload = new byte[data.remaining()];
            data.get(payload);
            byte[] content = cipher(Cipher.DECRYPT_MODE, nonce, userId, sourceId).doFinal(payload);
            var json = mapper.readTree(content);
            if (!json.path("address").isString() || !json.path("username").isString() || !json.path("password").isString()) {
                throw new IllegalArgumentException();
            }
            return new SourceConnection(json.get("address").asString(), json.get("username").asString(), json.get("password").asString());
        } catch (GeneralSecurityException | RuntimeException error) {
            throw new ApiException(500, "SOURCE_CONFIG_INVALID", "来源配置无法读取，请联系部署维护者。");
        }
    }
    private Cipher cipher(int mode, byte[] nonce, String userId, String sourceId) throws GeneralSecurityException {
        var cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, key, new GCMParameterSpec(128, nonce));
        cipher.updateAAD(("media-source:v1:" + userId + ":" + sourceId).getBytes(StandardCharsets.UTF_8));
        return cipher;
    }
}
