package com.shichaoya.aimediacenter.media.domain;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import java.util.stream.Stream;
import static org.junit.jupiter.api.Assertions.assertEquals;

class MediaFileNameParserTest {
    @ParameterizedTest
    @MethodSource("fileNames")
    void generatesSearchKeywords(String fileName, String title, Integer year) {
        assertEquals(new MediaFileNameParser.NameCandidate(title, year),
                MediaFileNameParser.parse(fileName, null));
    }

    static Stream<Arguments> fileNames() {
        return Stream.of(
                Arguments.of("Interstellar.2014.2160p.BluRay.REMUX.mkv", "Interstellar", 2014),
                Arguments.of("Dune.Part.Two.2024.WEB-DL.mkv", "Dune Part Two", 2024),
                Arguments.of("Interstellar.mkv", "Interstellar", null),
                Arguments.of("流浪地球.2019.2160p.WEB-DL.H265.mkv", "流浪地球", 2019),
                Arguments.of("千与千寻 (2001).mp4", "千与千寻", 2001),
                Arguments.of("Spider-Man_2002_1080p_Remux.m2ts", "Spider-Man", 2002),
                Arguments.of("  某部电影\u3000（2020）.MKV  ", "某部电影", 2020),
                Arguments.of("The Example's Journey (2021) - 2160p BluRay HEVC.mkv",
                        "The Example's Journey", 2021),
                Arguments.of("2001.A.Space.Odyssey.1968.Remux.mkv", "2001 A Space Odyssey", 1968),
                Arguments.of("1917.2019.1080p.mkv", "1917", 2019),
                Arguments.of("1917.mkv", "1917", null),
                Arguments.of("2012.2009.mp4", "2012", 2009),
                Arguments.of("The.Web.2024.mkv", "The Web", 2024),
                Arguments.of("Movie.1999.2020.1080p.mkv", "Movie 1999 2020", null),
                Arguments.of("Movie.1870.mkv", "Movie 1870", null),
                Arguments.of("Film.1080p.2020.mkv", "Film", null),
                Arguments.of("Film.Unknown.Release.mkv", "Film Unknown Release", null),
                Arguments.of("Film.srt", "Film srt", null),
                Arguments.of("1080p.x265.mkv", null, null),
                Arguments.of(" .mkv ", null, null),
                Arguments.of(null, null, null));
    }

    @ParameterizedTest
    @MethodSource("technicalSuffixes")
    void cutsCommonTechnicalSuffixesWithoutProducingMediaFacts(String suffix) {
        assertEquals(new MediaFileNameParser.NameCandidate("Some Movie", null),
                MediaFileNameParser.parse("Some.Movie." + suffix + ".GROUP.mp4", null));
    }

    static Stream<String> technicalSuffixes() {
        return Stream.of("720p", "1080p", "2160p", "BluRay", "WEB-DL", "WEBRip", "REMUX",
                "HDR", "DV", "HEVC", "x265", "x264", "H264", "H265");
    }

    @ParameterizedTest
    @MethodSource("directoryFallbacks")
    void usesOnlyACompleteParentCandidateWhenFilenameHasNoUsefulTitle(
            String fileName, String directory, String title, Integer year) {
        assertEquals(new MediaFileNameParser.NameCandidate(title, year),
                MediaFileNameParser.parse(fileName, directory));
    }

    static Stream<Arguments> directoryFallbacks() {
        return Stream.of(
                Arguments.of("movie.mkv", "Interstellar (2014)", "Interstellar", 2014),
                Arguments.of("1080p.x265.mkv", "Film (2020)", "Film", 2020),
                Arguments.of("Actual.Film.mkv", "Other Film (2024)", "Actual Film", null),
                Arguments.of("movie.mkv", "Movies", "movie", null),
                Arguments.of("1080p.x265.mkv", "Movies", null, null));
    }
}
