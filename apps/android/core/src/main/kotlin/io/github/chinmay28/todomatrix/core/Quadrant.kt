package io.github.chinmay28.todomatrix.core

/**
 * The four Eisenhower quadrants, by the ids the web app uses (src/types.ts) —
 * the ids are the contract: they go into the #add launch hash and come back
 * in the counts the page posts. QuadrantTest reads src/types.ts to keep the
 * two in step.
 */
enum class Quadrant(val id: String, val label: String) {
    DO("do", "Do"),
    SCHEDULE("schedule", "Schedule"),
    DELEGATE("delegate", "Delegate"),
    LATER("later", "Later");

    companion object {
        fun of(id: String?): Quadrant? = entries.firstOrNull { it.id == id }
    }
}
