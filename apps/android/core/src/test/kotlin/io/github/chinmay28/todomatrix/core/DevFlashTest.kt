package io.github.chinmay28.todomatrix.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DevFlashTest {
    private fun near(want: Float, got: Float) = assertEquals(want, got, 0.002f)

    @Test
    fun theVeilFadesInHoldsAndFadesOut() {
        // @keyframes dev-veil: 0% 0, 7% 1, 82% 1, 100% 0.
        near(0f, DevFlash.veilAlpha(0f))
        near(1f, DevFlash.veilAlpha(0.07f))
        near(1f, DevFlash.veilAlpha(0.5f))
        near(1f, DevFlash.veilAlpha(0.82f))
        near(0f, DevFlash.veilAlpha(1f))
        // ease-in-out: halfway through the fade is half the opacity.
        near(0.5f, DevFlash.veilAlpha(0.035f))
        near(0.5f, DevFlash.veilAlpha(0.91f))
    }

    @Test
    fun theBadgeLandsWithAnOvershootAndDriftsOut() {
        // @keyframes dev-badge: 0% .82, 14% 1.02, 22% 1, 82% 1, 100% 1.06.
        near(0.82f, DevFlash.badgeScale(0f))
        near(1.02f, DevFlash.badgeScale(0.14f))
        near(1f, DevFlash.badgeScale(0.22f))
        near(1f, DevFlash.badgeScale(0.6f))
        near(1.06f, DevFlash.badgeScale(1f))
        // The landing curve is front-loaded: most of the way there early.
        assertTrue(DevFlash.badgeScale(0.03f) > 0.95f)
    }

    @Test
    fun outsideTheTimelineHoldsTheEnds() {
        near(0f, DevFlash.veilAlpha(-1f))
        near(0f, DevFlash.veilAlpha(2f))
        near(1.06f, DevFlash.badgeScale(5f))
    }

    @Test
    fun cubicBezier() {
        val linear = CubicBezier(0f, 0f, 1f, 1f)
        near(0.25f, linear(0.25f))
        val ease = CubicBezier(0.42f, 0f, 0.58f, 1f)
        near(0.5f, ease(0.5f))
        assertTrue(ease(0.1f) < 0.1f)
    }

    @Test
    fun badgeSizeIsCapped() {
        near(256f, DevFlash.badgeSize(400f))
        near(416f, DevFlash.badgeSize(1200f))
    }
}
