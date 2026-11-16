package io.github.chinmay28.todomatrix.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppOriginTest {
    @Test
    fun startsAtTheMatrixOrTheAddSheet() {
        assertEquals("https://appassets.androidplatform.net/", AppOrigin.start())
        assertEquals("https://appassets.androidplatform.net/#add=do", AppOrigin.start(Launch(Quadrant.DO, "")))
        assertEquals("https://appassets.androidplatform.net/#add&title=Milk", AppOrigin.start(Launch(null, "Milk")))
    }

    @Test
    fun containsOnlyItsOwnOrigin() {
        assertTrue(AppOrigin.contains("https://appassets.androidplatform.net/index.html"))
        assertFalse(AppOrigin.contains("http://appassets.androidplatform.net/"))
        assertFalse(AppOrigin.contains("https://example.com/"))
        assertFalse(AppOrigin.contains("not a url at all \u0000"))
    }
}
