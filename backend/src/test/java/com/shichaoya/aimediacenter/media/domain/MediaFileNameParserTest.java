package com.shichaoya.aimediacenter.media.domain;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class MediaFileNameParserTest {
    @Test void extractsChineseAndEnglishTitlesWithoutChangingOriginalNames() {
        assertCandidate("流浪地球.2019.2160p.WEB-DL.H265.DDP5.1-GROUP.mkv", null, "流浪地球", 2019, null);
        assertCandidate("Blade.Runner.1982.Final.Cut.1080p.BluRay.x264.DTS-GROUP.MKV", null,
                "Blade Runner", 1982, "Final Cut");
        assertCandidate("Spider-Man_2002_1080p_Remux.m2ts", null, "Spider-Man", 2002, null);
    }

    @Test void preservesNumericMovieTitlesAndDoesNotInventMissingYears() {
        assertCandidate("1917.2019.1080p.mkv", null, "1917", 2019, null);
        assertCandidate("[YTS] 1917.2019.1080p.mkv", null, "1917", 2019, null);
        assertCandidate("2001.A.Space.Odyssey.1968.Remux.mkv", null, "2001 A Space Odyssey", 1968, null);
        assertCandidate("2012.2009.mp4", null, "2012", 2009, null);
        assertCandidate("1917.mkv", null, "1917", null, null);
        assertCandidate("Up.mkv", null, "Up", null, null);
    }

    @Test void multiplePossibleYearsStayUnresolved() {
        assertCandidate("Movie.1999.2020.1080p.mkv", null, "Movie 1999 2020", null, null);
        assertCandidate("Movie.2020.(2021).mp4", null, "Movie 2020 2021", null, null);
        assertCandidate("Movie.1870.mkv", null, "Movie 1870", null, null);
    }

    @Test void removesKnownTechnicalAndReleaseSuffixesWithoutReturningTechnicalFacts() {
        for (var suffix : List.of("720p", "1080p", "2160p", "4K", "8k", "BDRip", "WEB-DL", "WEBRip",
                "Remux", "x264", "H.265", "HDR10+", "Dolby.Vision", "AAC", "DTS-HD.MA", "TrueHD", "DDP5.1")) {
            assertCandidate("Some.Movie." + suffix + ".GROUP.mp4", null, "Some Movie", null, null);
        }
        assertCandidate("[字幕组] 某部电影 (2020) 1080p.mkv", null, "某部电影", 2020, null);
        assertCandidate("The.Web.2024.mkv", null, "The Web", 2024, null);
        assertCandidate("Raw.2016.mkv", null, "Raw", 2016, null);
    }

    @Test void extractsAllSupportedEditionLabelsBeforeCleaningSearchTitles() {
        for (var edition : List.of("Theatrical Cut", "Director's Cut", "Extended Cut", "Final Cut", "IMAX",
                "Special Edition", "Unrated", "Uncut", "Anniversary Edition")) {
            assertCandidate("Film.2020." + edition.replace(' ', '.') + ".2160p.mkv", null, "Film", 2020, edition);
        }
        assertCandidate("Film_[director’s_cut]_2020_WEB-DL.mkv", null, "Film", 2020, "Director's Cut");
        assertCandidate("Film.(Extended Cut).1080p.mp4", null, "Film", null, "Extended Cut");
    }

    @Test void editionWordsCanBeMovieTitlesAndRequireClearVersionContext() {
        assertCandidate("Final.Cut.2022.mkv", "Final Cut", "Final Cut", 2022, null);
        assertCandidate("The.Final.Cut.2004.mkv", null, "The Final Cut", 2004, null);
        assertCandidate("Unrated.2016.mkv", null, "Unrated", 2016, null);
        assertCandidate("IMAX.mkv", null, "IMAX", null, null);
        assertCandidate("Film.Extended.Cut.mkv", null, "Film Extended Cut", null, null);
    }

    @Test void filenameVersionWinsAndAmbiguousLocalLabelsStayEmpty() {
        assertCandidate("Film.2020.Final.Cut.mkv", "Film.2020.Extended.Cut", "Film", 2020, "Final Cut");
        assertCandidate("Film.2020.IMAX.Extended.Cut.mkv", "Final Cut", "Film", 2020, null);
        assertCandidate("Film.2020.mkv", "Extended Cut", "Film", 2020, "Extended Cut");
    }

    @Test void parentDirectoryOnlySuppliesACompleteCandidateForGenericOrEmptyFilenames() {
        assertCandidate("video.mkv", "银翼杀手.1982.Final.Cut", "银翼杀手", 1982, "Final Cut");
        assertCandidate("1080p.x265.mkv", "Film (2020)", "Film", 2020, null);
        assertCandidate("Actual.Film.mkv", "Other.Film.2024", "Actual Film", null, null);
        assertCandidate("Actual.Film.2020.mkv", "Other.Film.2024.Extended.Cut", "Actual Film", 2020, null);
        assertCandidate("Actual.Film.2020.mkv", "Actual.Film.2024.Extended.Cut", "Actual Film", 2020, null);
        assertCandidate("Actual.Film.2020.mkv", "Actual.Film.2020.Extended.Cut", "Actual Film", 2020, "Extended Cut");
        assertCandidate("Actual.Film.mkv", "2024", "Actual Film", null, null);
        assertCandidate("1080p.x265.mkv", "Movies", null, null, null);
    }

    @Test void nullBlankAndNoiseOnlyNamesReturnEmptyCandidates() {
        assertCandidate(null, null, null, null, null);
        assertCandidate(" .mkv ", "", null, null, null);
        assertCandidate("1080p.x265.AAC.mkv", null, null, null, null);
    }

    @Test void separatesPreYearUncutInAnonymizedRealReleaseNames() {
        assertCandidate("Example.Saga.Sequel.Uncut.2004.2160p.BluRay.REMUX.DV.HDR.HEVC.TrueHD.7.1.Atmos-GROUP.mkv",
                "某系列2", "Example Saga Sequel", 2004, "Uncut");
        assertCandidate("Example Saga Sequel uncut (2004) - 2160p UHD BluRay HEVC DTS-HD MA 7.1 2Audio.mkv",
                null, "Example Saga Sequel", 2004, "Uncut");
        assertCandidate("[YTS] Example.Saga.Sequel.Uncut.2004.2160p.mkv", null, "Example Saga Sequel", 2004, "Uncut");
    }

    @Test void keepsUncutTitleWordsWithoutClearReleaseContext() {
        assertCandidate("Uncut.2004.2160p.mkv", null, "Uncut", 2004, null);
        assertCandidate("[YTS] Uncut.2004.2160p.mkv", null, "Uncut", 2004, null);
        assertCandidate("Uncut.Gems.2019.2160p.mkv", null, "Uncut Gems", 2019, null);
        assertCandidate("The.Uncut.2016.2160p.mkv", null, "The Uncut", 2016, null);
        assertCandidate("Film.Uncut.2004.mkv", null, "Film Uncut", 2004, null);
        assertCandidate("Film.Uncut.1999.2020.2160p.mkv", null, "Film Uncut 1999 2020", null, null);
    }

    @Test void doesNotConflateUncutAndUnratedOrResolveConflictingVersions() {
        assertCandidate("Film.Uncut.2004.2160p.Unrated.mkv", null, "Film", 2004, null);
        assertCandidate("Film.Uncut.2004.2160p.mkv", "Film.2004.Unrated", "Film", 2004, "Uncut");
        assertCandidate("Film.2004.mkv", "Uncut", "Film", 2004, "Uncut");
    }

    @Test void parsesAnonymizedStructuresObservedInDevelopmentLibrary() {
        // 保留真实分隔符、年份位置和发行后缀，仅替换影片/组名，不复制私人文件名或路径。
        assertCandidate("Example Saga Awakening (2011) - 2160p UHD BluRay HEVC DTS-HD MA 5.1 2Audio.mkv",
                "某系列 (2011)", "Example Saga Awakening", 2011, null);
        assertCandidate("Example： The Journey (2015) - 2160p UHD HEVC DTS-HD MA 7.1.mkv",
                null, "Example： The Journey", 2015, null);
        assertCandidate("Example.Saga.The.Final.Chapter.2016.2160p.BluRay.REMUX.DV.HDR.HEVC.TrueHD.7.1.Atmos-GROUP.mkv",
                null, "Example Saga The Final Chapter", 2016, null);
        assertCandidate("The Example.2012.2160p.UHD.BluRay.REMUX.DV.HDR.DTS-HD.TrueHD7.1Atmos.mkv",
                null, "The Example", 2012, null);
        assertCandidate("Example： Second Journey.2015.PROPER.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.7.1.TrueHD.7.1.Atmos.mkv",
                null, "Example： Second Journey", 2015, null);
        assertCandidate("The Example's Journey (2021) - 2160p UHD BluRay HEVC Atmos TrueHD 7.1.mkv",
                null, "The Example's Journey", 2021, null);
    }

    private void assertCandidate(String fileName, String directoryName, String title, Integer year, String edition) {
        assertEquals(new MediaFileNameParser.NameCandidate(title, year, edition),
                MediaFileNameParser.parse(fileName, directoryName), fileName + " / " + directoryName);
    }
}
