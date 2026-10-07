package com.shichaoya.aimediacenter.media.domain;

import java.util.regex.Pattern;

/** 只为 TMDB 搜索生成片名与可选年份，不确认 Movie 身份或媒体技术事实。 */
public final class MediaFileNameParser {
    private static final Pattern EXTENSION = Pattern.compile(
            "(?i)\\.(?:mkv|mp4|avi|mov|wmv|flv|m4v|webm|ts|m2ts|mts|mpg|mpeg|vob|ogv|3gp)$");
    private static final Pattern YEAR = Pattern.compile("(?<![\\p{L}\\p{N}])(?:18|19|20)\\d{2}(?![\\p{L}\\p{N}])");
    private static final Pattern TECHNICAL = Pattern.compile(
            "(?i)(?<![\\p{L}\\p{N}])(?:720p|1080p|2160p|blu[ -]?ray|web[ -]?(?:dl|rip)|"
                    + "remux|hdr|dv|hevc|[xh][ -]?26[45])(?![\\p{L}\\p{N}])");
    private static final Pattern GENERIC_NAME = Pattern.compile("(?i)(?:movie|video|main|feature|(?:disc|cd|part)[ -]?\\d+)");

    private MediaFileNameParser() {}

    /** 文件名优先；仅无有效标题或通用文件名时尝试最近父目录的完整片名 + 年份。 */
    public static NameCandidate parse(String fileName, String parentDirectoryName) {
        var file = parseName(EXTENSION.matcher(normalizeWhitespace(fileName)).replaceFirst(""));
        if (file.title() != null && !GENERIC_NAME.matcher(file.title()).matches()) return file;

        var directory = parseName(normalizeWhitespace(parentDirectoryName));
        return directory.title() != null && directory.year() != null ? directory : file;
    }

    private static NameCandidate parseName(String value) {
        String name = normalizeWhitespace(value.replace('.', ' ').replace('_', ' ')
                .replaceAll("[\\[\\](){}（）]", " "));
        // 技术词只确定标题截止位置；之后的数字不再作为年份证据。
        var technical = TECHNICAL.matcher(name);
        int titleEnd = technical.find() ? technical.start() : name.length();
        String titleText = name.substring(0, titleEnd);

        Integer year = null;
        int yearStart = titleEnd;
        var years = YEAR.matcher(titleText);
        while (years.find()) {
            int valueYear = Integer.parseInt(years.group());
            // 起首的 1917 / 2001 等保留为片名；年份必须有有效标题前缀。
            if (valueYear >= 1888 && clean(titleText.substring(0, years.start())) != null) {
                // 多个候选年份不猜测，保留标题中的数字。
                if (year != null) return new NameCandidate(clean(titleText), null);
                year = valueYear;
                yearStart = years.start();
            }
        }
        return new NameCandidate(clean(titleText.substring(0, yearStart)), year);
    }

    private static String normalizeWhitespace(String value) {
        return value == null ? "" : value.replaceAll("(?U)[\\s\\uFEFF]+", " ").strip();
    }

    private static String clean(String value) {
        String title = value.strip().replaceAll("^[ -]+|[ -]+$", "");
        return title.codePoints().anyMatch(Character::isLetterOrDigit) ? title : null;
    }

    public record NameCandidate(String title, Integer year) {}
}
