package com.shichaoya.aimediacenter.common.id;

import java.security.SecureRandom;
import java.util.UUID;

/**
 * 统一生成业务 ID：当前注册用户调用 {@link #next()}，后端自行分配 ID，不能信任客户端传入的身份标识。
 * UUIDv7 按 RFC 9562 将毫秒时间放在前部，其余包含随机位；生成后使用标准小写 UUID 文本存入 CHAR(36)。
 * 相比完全随机的 UUID，它大致按生成时间排列，但同一毫秒内不保证严格递增。
 */
public final class BusinessIds {
    private static final SecureRandom RANDOM = new SecureRandom();
    private BusinessIds() {}
    public static String next() {
        long most = (System.currentTimeMillis() << 16) | 0x7000L | RANDOM.nextInt(4096);
        long least = (RANDOM.nextLong() & 0x3fffffffffffffffL) | 0x8000000000000000L;
        return new UUID(most, least).toString();
    }
}
