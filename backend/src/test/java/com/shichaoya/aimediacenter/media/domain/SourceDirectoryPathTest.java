package com.shichaoya.aimediacenter.media.domain;

import com.shichaoya.aimediacenter.common.web.ApiException;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class SourceDirectoryPathTest {
    @Test void normalizesBoundariesWithoutTrimmingOrDecodingFileNames() {
        assertEquals("/", SourceDirectoryPath.normalize("/"));
        assertEquals("/电影 库/100% #?+", SourceDirectoryPath.normalize("/电影 库//100% #?+/"));
        assertEquals("/电影 ", SourceDirectoryPath.normalize("/电影 /"));
        assertEquals("/literal%20name", SourceDirectoryPath.normalize("/literal%20name"));
    }
    @Test void rejectsUrlsTraversalEncodedBoundariesAndInvalidCharacters() {
        for (String path : new String[]{null, "", " ", "relative", "http://example.invalid/dav/", "//host/path",
                "/a/../b", "/./b", "/%2e%2e/b", "/a%2Fb", "/a%5cb", "/a%252fb", "/%25252e%25252e/", "/back\\slash", "/bad\nname", "/bad\ud800", "/" + "x".repeat(2048)}) {
            var error = assertThrows(ApiException.class, () -> SourceDirectoryPath.normalize(path));
            assertEquals(400, error.status()); assertEquals("VALIDATION_FAILED", error.code());
            assertEquals("path", error.fieldErrors().keySet().iterator().next());
        }
    }
}
