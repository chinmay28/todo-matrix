package io.github.chinmay28.todomatrix.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AssetRouteTest {
    @Test
    fun thePageAndItsFiles() {
        assertEquals("web/index.html", AssetRoute.resolve(""))
        assertEquals("web/index.html", AssetRoute.resolve("/"))
        assertEquals("web/index.html", AssetRoute.resolve("index.html"))
        assertEquals("web/assets/index-Bo-EcJWv.js", AssetRoute.resolve("assets/index-Bo-EcJWv.js"))
        assertEquals("web/dev-badge.png", AssetRoute.resolve("dev-badge.png?v=1"))
        assertEquals("web/assets/index.html", AssetRoute.resolve("assets/"))
    }

    @Test
    fun nothingOutsideTheBundle() {
        for (bad in listOf("../todomatrix-bridge.js", "assets/../../x", "./index.html", "a//b", "a\\b", "a\u0000b")) {
            assertNull(bad, AssetRoute.resolve(bad))
        }
    }

    @Test
    fun typesTheBundleNeeds() {
        assertEquals("text/html", AssetRoute.mimeType("web/index.html"))
        assertEquals("text/javascript", AssetRoute.mimeType("web/assets/index.JS"))
        assertEquals("text/css", AssetRoute.mimeType("web/assets/index.css"))
        assertEquals("image/svg+xml", AssetRoute.mimeType("web/favicon.svg"))
        assertEquals("image/png", AssetRoute.mimeType("web/dev-badge.png"))
        assertEquals("application/octet-stream", AssetRoute.mimeType("web/LICENSE"))
        assertEquals("utf-8", AssetRoute.encoding("text/html"))
        assertEquals("utf-8", AssetRoute.encoding("image/svg+xml"))
        assertNull(AssetRoute.encoding("image/png"))
    }
}
