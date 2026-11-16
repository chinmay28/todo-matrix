package io.github.chinmay28.todomatrix.core

import org.json.JSONObject

/**
 * The open-task count of each quadrant — what the home-screen widget shows.
 *
 * The page posts them after every change (window.todomatrixApp.counts), so
 * the widget never reads the page's storage and never needs to know how the
 * tasks are kept: the store logic stays in one place, the web app.
 */
data class Counts(private val values: Map<Quadrant, Int>) {
    init {
        require(values.keys == Quadrant.entries.toSet()) { "counts for ${values.keys.map { it.id }}, want all four quadrants" }
        require(values.values.all { it >= 0 }) { "a negative count" }
    }

    operator fun get(q: Quadrant): Int = values.getValue(q)

    /** What a widget cell shows: the number, capped so it fits. */
    fun label(q: Quadrant): String = this[q].let { if (it > MAX_SHOWN) "$MAX_SHOWN+" else it.toString() }

    fun encode(): String = JSONObject().apply { for (q in Quadrant.entries) put(q.id, this@Counts[q]) }.toString()

    companion object {
        const val MAX_SHOWN = 999

        /** From the page's `{ do, schedule, delegate, later }`; all four must be whole numbers. */
        fun fromJson(o: JSONObject): Counts = Counts(
            Quadrant.entries.associateWith { q ->
                val v = o.opt(q.id)
                require(v is Number && v.toDouble() == Math.floor(v.toDouble()) && v.toDouble() <= Int.MAX_VALUE) { "count for ${q.id} is not a whole number" }
                v.toInt()
            },
        )

        /** What [encode] wrote, or null for nothing or anything unreadable. */
        fun decode(s: String?): Counts? = if (s.isNullOrBlank()) null else runCatching { fromJson(JSONObject(s)) }.getOrNull()
    }
}
