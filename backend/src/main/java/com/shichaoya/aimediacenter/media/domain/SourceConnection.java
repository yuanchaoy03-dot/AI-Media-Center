package com.shichaoya.aimediacenter.media.domain;

/** 完整连接只在 Spring 内部使用；不作为响应或日志数据。 */
public record SourceConnection(String address, String username, String password) {
    @Override public String toString() { return "SourceConnection[redacted]"; }
}
