package io.github.chinmay28.todomatrix.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.File

class QuadrantTest {
    @Test
    fun matchesTheWebApp() {
        // The ids are the contract with the page (the #add hash, the counts);
        // read them out of src/types.ts so a change there fails here too.
        val types = File("../../../src/types.ts").readText()
        val list = types.substringAfter("export const QUADRANTS").substringBefore("];")
        val ids = Regex("id: '([a-z]+)', name: '([A-Za-z]+)'").findAll(list).map { it.groupValues[1] to it.groupValues[2] }.toList()
        assertEquals(Quadrant.entries.map { it.id to it.label }, ids)
    }

    @Test
    fun lookup() {
        assertEquals(Quadrant.DELEGATE, Quadrant.of("delegate"))
        assertNull(Quadrant.of("Delegate"))
        assertNull(Quadrant.of(null))
    }
}
