package com.shichaoya.aimediacenter.media.web.dto;

import com.shichaoya.aimediacenter.common.web.ApiException;
import org.junit.jupiter.api.Test;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import static org.junit.jupiter.api.Assertions.*;

class MediaScanRootsRequestTest {
    @Test void acceptsEmptyOrAtMostThirtyTwoStringPathsWithoutClientControlledMetadata() {
        assertEquals(List.of(), MediaScanRootsRequest.parse(Map.of("paths", List.of())).paths());
        var maximum = IntStream.range(0, 32).mapToObj(i -> "/" + i).toList();
        assertEquals(maximum, MediaScanRootsRequest.parse(Map.of("paths", maximum)).paths());
        for (Map<String, Object> input : List.<Map<String, Object>>of(Map.of(), Map.of("paths", "/a"), Map.of("paths", List.of(1)),
                Map.of("paths", Arrays.asList("/a", null)), Map.of("paths", List.of(), "userId", "other"),
                Map.of("paths", IntStream.range(0, 33).mapToObj(i -> "/" + i).toList()))) {
            var error = assertThrows(ApiException.class, () -> MediaScanRootsRequest.parse(input));
            assertEquals("VALIDATION_FAILED", error.code()); assertEquals(400, error.status()); assertTrue(error.fieldErrors().containsKey("paths"));
        }
    }
}
