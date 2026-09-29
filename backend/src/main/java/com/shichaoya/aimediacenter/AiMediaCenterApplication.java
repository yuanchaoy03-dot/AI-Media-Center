package com.shichaoya.aimediacenter;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 后端启动入口。Spring Boot 从此类所在包向下扫描组件，装配 web、application 和 infrastructure 中的实现。
 * 启动时还会依据配置连接数据库，并由 Flyway 检查/执行数据库迁移。
 */
@SpringBootApplication
public class AiMediaCenterApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiMediaCenterApplication.class, args);
    }

}
