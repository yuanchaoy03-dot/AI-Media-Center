package com.shichaoya.aimediacenter.media.domain;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Pattern;

/** 来源无关的命名候选；不代表已确认的 Movie 身份或文件技术事实。 */
public final class MediaFileNameParser {
    private static final Pattern EXTENSION = Pattern.compile(
            "(?i)\\.(?:mkv|mp4|avi|mov|wmv|flv|m4v|webm|ts|m2ts|mts|mpg|mpeg|vob|ogv|3gp)$");
    private static final Pattern YEAR = Pattern.compile("(?<![\\p{L}\\p{N}])(?:18|19|20)\\d{2}(?![\\p{L}\\p{N}])");
    private static final Pattern TECHNICAL = Pattern.compile(
            "(?i)(?<![\\p{L}\\p{N}])(?:\\d{3,4}[pi]|[48]k|[xh][ -]?26[45]|hevc|avc|av1|"
                    + "blu[ -]?ray|bd[ -]?rip|br[ -]?rip|dvd[ -]?rip|web[ -]?(?:dl|rip)|hdtv|remux|uhd|proper|repack|"
                    + "hdr(?:10\\+?)?|dolby[ -]+vision|dv|sdr|dts(?:[ -]+hd)?(?:[257] ?[01])?|"
                    + "truehd(?:[257] ?[01])?|aac(?:[257] ?[01])?|e[ -]?ac[ -]?3|ac[ -]?3|"
                    + "ddp?(?:[257] ?[01])?|atmos|flac)(?![\\p{L}\\p{N}])");
    private static final Pattern LEADING_GROUP = Pattern.compile(
            "(?i)^\\s*\\[(?:[^\\]]*字幕组|YTS(?:[^\\]]*)|YIFY|RARBG)\\]\\s*");
    private static final Pattern GENERIC_NAME = Pattern.compile("(?i)(?:movie|video|main|feature|(?:disc|cd|part)[ -]?\\d+)");
    private static final List<Edition> EDITIONS = List.of(
            edition("Theatrical Cut", "theatrical[ -]+cut"),
            edition("Director's Cut", "director'?s[ -]+cut"),
            edition("Extended Cut", "extended[ -]+cut"),
            edition("Final Cut", "final[ -]+cut"),
            edition("IMAX", "imax"),
            edition("Special Edition", "special[ -]+edition"),
            edition("Unrated", "unrated"),
            edition("Uncut", "uncut"),
            edition("Anniversary Edition", "anniversary[ -]+edition"));

    private MediaFileNameParser() {}

    /** 只接收原文件名和最近父目录名；保留原标题数字，歧义年份/版本为空。 */
    public static NameCandidate parse(String fileName, String parentDirectoryName) {
        var file = parseName(text(EXTENSION.matcher(normalizeWhitespace(fileName)).replaceFirst("")));
        var directory = parseName(text(parentDirectoryName));
        var selected = file;
        // 父目录只有明确的片名+年份才能替代通用/无效文件名，不借用集合目录年份。
        if ((file.title() == null || GENERIC_NAME.matcher(file.title()).matches())
                && directory.title() != null && directory.year() != null) selected = directory;

        String editionLabel = file.editionLabel();
        if (!file.editionAmbiguous() && editionLabel == null) {
            if (selected == directory || compatible(file, directory)) editionLabel = directory.editionLabel();
            if (editionLabel == null && !directory.editionAmbiguous()) {
                String wholeLabel = wholeEdition(text(parentDirectoryName));
                // Final Cut 等也可能是片名，不能把与候选标题相同的目录名当版本。
                if (wholeLabel != null && selected.title() != null
                        && !wholeLabel.equals(wholeEdition(text(selected.title())))) editionLabel = wholeLabel;
            }
        }
        return new NameCandidate(selected.title(), selected.year(), editionLabel);
    }

    private static ParsedName parseName(String name) {
        // 已知前置发行组的年份、版本和技术文本均不属于影片命名证据。
        name = LEADING_GROUP.matcher(name).replaceFirst("");
        var years = new ArrayList<YearToken>();
        var yearMatcher = YEAR.matcher(name);
        while (yearMatcher.find()) {
            int value = Integer.parseInt(yearMatcher.group());
            if (value >= 1888 && clean(name.substring(0, yearMatcher.start())) != null) {
                years.add(new YearToken(yearMatcher.start(), value));
            }
        }
        var labels = new LinkedHashSet<String>();
        var spans = new ArrayList<Span>();
        for (var edition : EDITIONS) {
            var matcher = edition.pattern().matcher(name);
            while (matcher.find()) {
                boolean afterYear = !years.isEmpty() && matcher.start() > years.getFirst().start();
                boolean bracketed = matcher.start() > 0 && matcher.end() < name.length()
                        && matchingBrackets(name.charAt(matcher.start() - 1), name.charAt(matcher.end()));
                boolean uncutBeforeYear = edition.label().equals("Uncut") && years.size() == 1
                        && matcher.end() < years.getFirst().start()
                        && name.substring(matcher.end(), years.getFirst().start()).matches("[\\s\\[\\](){}-]+")
                        && TECHNICAL.matcher(name).find(years.getFirst().start() + 4);
                String prefix = clean(name.substring(0, matcher.start()));
                // Uncut 在紧邻唯一年份且有技术后缀时可作为版本；首词/仅冠词前缀仍保留为标题。
                boolean titlePrefix = prefix != null;
                if (titlePrefix && (afterYear || bracketed || uncutBeforeYear && !prefix.matches("(?i)(?:the|a|an)"))) {
                    labels.add(edition.label());
                    spans.add(new Span(matcher.start(), matcher.end()));
                }
            }
        }

        int titleEnd = years.size() == 1 ? years.getFirst().start() : name.length();
        var technical = TECHNICAL.matcher(name);
        // 年份在技术后缀之前或之后都不能让噪声成为片名。
        if (technical.find()) {
            titleEnd = Math.min(titleEnd, technical.start());
        }
        var title = new StringBuilder(name.substring(0, titleEnd));
        // 提取并保留版本后才从搜索标题中去掉版本文本，按原始索引逆序移除。
        spans.stream().filter(span -> span.end() <= title.length())
                .sorted((left, right) -> Integer.compare(right.start(), left.start()))
                .forEach(span -> title.replace(span.start(), span.end(), " "));
        String candidateTitle = clean(title.toString());
        // 纯技术噪声没有片名证据，不把其版本标签或歧义带入目录兜底。
        if (candidateTitle == null) return new ParsedName(null, null, null, false);
        Integer candidateYear = years.size() == 1 ? years.getFirst().value() : null;
        return new ParsedName(candidateTitle, candidateYear, labels.size() == 1 ? labels.iterator().next() : null,
                labels.size() > 1);
    }

    private static String wholeEdition(String name) {
        for (var edition : EDITIONS) if (edition.pattern().matcher(name).matches()) return edition.label();
        return null;
    }

    private static boolean compatible(ParsedName file, ParsedName directory) {
        return file.title() != null && directory.title() != null && file.title().equalsIgnoreCase(directory.title())
                && (file.year() == null || directory.year() == null || file.year().equals(directory.year()));
    }

    private static Edition edition(String label, String expression) {
        return new Edition(label, Pattern.compile("(?i)(?<![\\p{L}\\p{N}])" + expression + "(?![\\p{L}\\p{N}])"));
    }

    private static String text(String value) {
        return normalizeWhitespace(value == null ? "" : value.replace('.', ' ').replace('_', ' ').replace('\u2019', '\''));
    }

    private static String normalizeWhitespace(String value) {
        return value == null ? "" : value.replaceAll("(?U)[\\s\\uFEFF]+", " ").strip();
    }

    private static String clean(String value) {
        String result = value.replaceAll("[\\[\\](){}（）]", " ").replaceAll("\\s+", " ").strip()
                .replaceAll("^[\\s-]+|[\\s-]+$", "");
        return result.codePoints().anyMatch(Character::isLetterOrDigit) ? result : null;
    }

    private static boolean matchingBrackets(char start, char end) {
        return start == '[' && end == ']' || start == '(' && end == ')' || start == '{' && end == '}';
    }

    public record NameCandidate(String title, Integer year, String editionLabel) {}
    private record Edition(String label, Pattern pattern) {}
    private record YearToken(int start, int value) {}
    private record Span(int start, int end) {}
    private record ParsedName(String title, Integer year, String editionLabel, boolean editionAmbiguous) {}
}
