package io.github.chinmay28.todomatrix.core

/**
 * The developer badge thrown up full screen for a beat — the same timeline as
 * the web app's (src/devmark.tsx, the dev-veil / dev-badge keyframes in
 * src/styles.css) and SAND Vault's: the veil fades in, holds and fades out
 * (ease-in-out per step); the badge lands with a small overshoot and drifts
 * out (cubic-bezier(0.22, 1, 0.36, 1) per step); three seconds in all.
 *
 * Kept here as numbers rather than an Android animator so the shape is tested
 * and runs on its own clock — the system's animation scale must not make it
 * vanish instantly or linger.
 */
object DevFlash {
    const val DURATION_MS = 3_000L

    /** The badge's size: 64% of the screen's short side, at most 26rem (416dp). */
    fun badgeSize(shortSideDp: Float): Float = minOf(0.64f * shortSideDp, 416f)

    private class Key(val at: Float, val value: Float)

    private val veil = listOf(Key(0f, 0f), Key(0.07f, 1f), Key(0.82f, 1f), Key(1f, 0f))
    private val badge = listOf(Key(0f, 0.82f), Key(0.14f, 1.02f), Key(0.22f, 1f), Key(0.82f, 1f), Key(1f, 1.06f))

    private val easeInOut = CubicBezier(0.42f, 0f, 0.58f, 1f)
    private val landing = CubicBezier(0.22f, 1f, 0.36f, 1f)

    /** The veil's opacity at [t] (0..1 of the duration). */
    fun veilAlpha(t: Float): Float = sample(veil, t, easeInOut)

    /** The badge's scale at [t] (0..1 of the duration). */
    fun badgeScale(t: Float): Float = sample(badge, t, landing)

    private fun sample(keys: List<Key>, t: Float, ease: CubicBezier): Float {
        val x = t.coerceIn(0f, 1f)
        val i = keys.indexOfLast { it.at <= x }.coerceAtMost(keys.size - 2)
        val a = keys[i]
        val b = keys[i + 1]
        val local = (x - a.at) / (b.at - a.at)
        return a.value + (b.value - a.value) * ease(local)
    }
}

/** A CSS cubic-bezier() timing function: progress → eased progress. */
class CubicBezier(private val x1: Float, private val y1: Float, private val x2: Float, private val y2: Float) {
    operator fun invoke(x: Float): Float {
        if (x <= 0f) return 0f
        if (x >= 1f) return 1f
        // Find the curve parameter whose x is [x] by bisection — x(s) is
        // monotonic for the control points CSS allows — then read its y.
        var lo = 0f
        var hi = 1f
        repeat(40) {
            val mid = (lo + hi) / 2
            if (coord(mid, x1, x2) < x) lo = mid else hi = mid
        }
        return coord((lo + hi) / 2, y1, y2)
    }

    private fun coord(s: Float, p1: Float, p2: Float): Float {
        val u = 1 - s
        return 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s
    }
}
