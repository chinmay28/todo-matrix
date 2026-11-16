package io.github.chinmay28.todomatrix.core

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CountsTest {
    private fun counts(d: Int, s: Int, g: Int, l: Int) =
        Counts(mapOf(Quadrant.DO to d, Quadrant.SCHEDULE to s, Quadrant.DELEGATE to g, Quadrant.LATER to l))

    @Test
    fun roundTripsThroughStorage() {
        val c = counts(1, 2, 3, 4)
        assertEquals(c, Counts.decode(c.encode()))
    }

    @Test
    fun readsWhatThePagePosts() {
        // JSON.stringify(openCounts(state)) — src/store.ts.
        val c = Counts.fromJson(JSONObject("""{"do":3,"schedule":0,"delegate":1,"later":12}"""))
        assertEquals(3, c[Quadrant.DO])
        assertEquals(12, c[Quadrant.LATER])
    }

    @Test
    fun nothingStoredOrJunkIsUnknown() {
        assertNull(Counts.decode(null))
        assertNull(Counts.decode(""))
        assertNull(Counts.decode("{"))
        assertNull(Counts.decode("""{"do":1}"""))
        assertNull(Counts.decode("""{"do":1.5,"schedule":0,"delegate":0,"later":0}"""))
        assertNull(Counts.decode("""{"do":"1","schedule":0,"delegate":0,"later":0}"""))
    }

    @Test
    fun labelsAreCapped() {
        val c = counts(0, 999, 1000, 7)
        assertEquals("0", c.label(Quadrant.DO))
        assertEquals("999", c.label(Quadrant.SCHEDULE))
        assertEquals("999+", c.label(Quadrant.DELEGATE))
    }
}
