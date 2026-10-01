package com.shichaoya.aimediacenter.user.infrastructure.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.util.Base64;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class PasswordEncoderTest {
    final PasswordEncoder passwords = new TokenConfiguration().passwordEncoder();

    @Test void argon2idUsesConfiguredParametersAndRandomSalt() {
        String raw = "完整 password input 😀";
        String first = passwords.encode(raw);
        String second = passwords.encode(raw);
        assertInstanceOf(DelegatingPasswordEncoder.class, passwords);
        assertTrue(first.startsWith("{argon2id}$argon2id$"));
        assertTrue(second.startsWith("{argon2id}$argon2id$"));
        assertNotEquals(raw, first);
        assertNotEquals(first, second);
        assertTrue(passwords.matches(raw, first));
        assertTrue(passwords.matches(raw, second));
        assertTrue(first.length() <= 255);
        assertTrue(second.length() <= 255);
        String[] firstPhc = first.substring("{argon2id}".length()).split("\\$");
        String[] secondPhc = second.substring("{argon2id}".length()).split("\\$");
        assertEquals("v=19", firstPhc[2]);
        assertEquals("m=65536,t=3,p=4", firstPhc[3]);
        assertEquals(32, Base64.getDecoder().decode(firstPhc[5]).length);
        assertTrue(Base64.getDecoder().decode(firstPhc[4]).length >= 16);
        assertNotEquals(firstPhc[4], secondPhc[4]);
    }

    @Test void fullLongPasswordsAndUnicodeAreNotTruncated() {
        for (String raw : List.of(" 中文密码 full input 😀 " + "z".repeat(90), "😀".repeat(128))) {
            String hash = passwords.encode(raw);
            assertTrue(passwords.matches(raw, hash));
            assertFalse(passwords.matches(raw.substring(0, 72), hash));
            // 按码点替换最后一个字符，验证最大长度的非 BMP 输入也完整参与散列。
            int last = raw.offsetByCodePoints(raw.length(), -1);
            assertFalse(passwords.matches(raw.substring(0, last) + "😁", hash));
        }
    }
}
