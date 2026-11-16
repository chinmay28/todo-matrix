package io.github.chinmay28.todomatrix.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FileNamesTest {
    @Test
    fun sanitize() {
        assertEquals("todo-matrix-2026-11-16.json", FileNames.sanitize("todo-matrix-2026-11-16.json"))
        assertEquals("passwd", FileNames.sanitize("../../etc/passwd"))
        assertEquals("evil.txt", FileNames.sanitize("C:\\Users\\evil.txt"))
        assertEquals("bashrc", FileNames.sanitize(".bashrc"))
        assertEquals("ab.txt", FileNames.sanitize("a\u0000b\n.txt"))
        assertEquals("what.txt", FileNames.sanitize("what?.txt"))
        assertEquals("download", FileNames.sanitize("  "))
        assertEquals("download", FileNames.sanitize(null))
        assertEquals("backup.json", FileNames.sanitize("", "backup.json"))
    }

    @Test
    fun longNamesKeepTheirExtension() {
        val s = FileNames.sanitize("é".repeat(200) + ".json")
        assertTrue(s.endsWith(".json"))
        assertTrue(s.toByteArray().size <= 180)
    }
}
