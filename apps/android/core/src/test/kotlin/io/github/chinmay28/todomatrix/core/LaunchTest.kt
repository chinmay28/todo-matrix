package io.github.chinmay28.todomatrix.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LaunchTest {
    private val send = "android.intent.action.SEND"

    @Test
    fun fragmentsTheWebAppReads() {
        // The same forms src/launch.test.ts pins for launchHash().
        assertEquals("add", Launch(null, "").fragment())
        assertEquals("add=do", Launch(Quadrant.DO, "").fragment())
        assertEquals("add&title=a+b", Launch(null, "a b").fragment())
        assertEquals("add=later&title=1%2B1%3D2+%26+%C3%A9", Launch(Quadrant.LATER, "1+1=2 & é").fragment())
    }

    @Test
    fun aShortcutAddsToItsQuadrant() {
        for (q in Quadrant.entries) {
            assertEquals(Launch(q, ""), Launches.from(Launches.ACTION_ADD, null, q.id, null, null))
        }
        // An unknown quadrant still opens the sheet, at its default.
        assertEquals(Launch(null, ""), Launches.from(Launches.ACTION_ADD, null, "someday", null, null))
    }

    @Test
    fun sharedTextBecomesTheTitle() {
        assertEquals(Launch(null, "Buy milk"), Launches.from(send, "text/plain", null, null, "  Buy\nmilk "))
        assertNull(Launches.from(send, "text/plain", null, null, "   "))
        assertNull(Launches.from(send, "image/png", null, null, "a"))
        assertNull(Launches.from(send, null, null, null, "a"))
    }

    @Test
    fun theLauncherIconOpensTheMatrix() {
        assertNull(Launches.from("android.intent.action.MAIN", null, null, null, null))
        assertNull(Launches.from(null, null, null, null, null))
    }

    @Test
    fun aSharedPageIsItsTitleAndAddress() {
        assertEquals("A page — https://example.com/a", ShareText.title("A page", "https://example.com/a"))
        assertEquals("A page https://example.com/a", ShareText.title("A page", "A page https://example.com/a"))
        assertEquals("Only a subject", ShareText.title(" Only a subject ", null))
        assertEquals(ShareText.MAX_TITLE, ShareText.title(null, "x".repeat(800)).length)
    }
}
