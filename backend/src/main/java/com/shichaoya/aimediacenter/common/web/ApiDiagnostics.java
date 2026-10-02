package com.shichaoya.aimediacenter.common.web;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.springframework.dao.DataAccessException;
import java.sql.SQLException;
import java.util.Collections;
import java.util.IdentityHashMap;

/** HTTP 系统故障的内部诊断投影：仅保留异常类型与代码位置，不序列化异常消息或请求载荷。 */
final class ApiDiagnostics {
    private static final int MAX_CAUSES = 8;
    private static final int MAX_FRAMES = 64;

    private ApiDiagnostics() { }

    static void unexpected(Logger logger, HttpServletRequest request, Throwable error) {
        var seen = Collections.newSetFromMap(new IdentityHashMap<Throwable, Boolean>());
        var trace = new StringBuilder();
        String category = "INTERNAL_ERROR";
        Throwable cause = error;
        for (int depth = 0; cause != null && depth < MAX_CAUSES && seen.add(cause); depth++) {
            if (cause instanceof DataAccessException || cause instanceof SQLException) category = "DATABASE_ERROR";
            trace.append("\nexception_class=").append(cause.getClass().getName());
            var frames = cause.getStackTrace();
            for (int index = 0; index < Math.min(frames.length, MAX_FRAMES); index++) {
                trace.append("\n\tat ").append(frames[index]);
            }
            if (frames.length > MAX_FRAMES) trace.append("\n[frames truncated]");
            cause = cause.getCause();
        }
        if (cause != null) trace.append("\n[cause chain truncated]");
        // 不把原 Throwable 交给 SLF4J：message/cause/suppressed 可能携带 SQL、密码、Token 或敏感 URL。
        logger.error("request_id={} error_category={} exception_class={} diagnostic_stack={}",
                request.getAttribute("requestId"), category, error.getClass().getName(), trace.toString());
    }
}
