package com.shichaoya.aimediacenter.common.id;

import java.security.SecureRandom;
import java.util.UUID;

/** RFC 9562 UUIDv7: Unix milliseconds and 74 cryptographically random bits. */
public final class BusinessIds {
    private static final SecureRandom RANDOM = new SecureRandom();
    private BusinessIds() {}
    public static String next() {
        long most = (System.currentTimeMillis() << 16) | 0x7000L | RANDOM.nextInt(4096);
        long least = (RANDOM.nextLong() & 0x3fffffffffffffffL) | 0x8000000000000000L;
        return new UUID(most, least).toString();
    }
}
