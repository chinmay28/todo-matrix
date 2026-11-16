package io.github.chinmay28.todomatrix

import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.RenderEffect
import android.graphics.Shader
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.SystemClock
import android.provider.Settings
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import io.github.chinmay28.todomatrix.core.DevFlash

/**
 * The app's own screen: what it is, which build this is, where the tasks are
 * kept, and the developer badge — which, tapped, is thrown up full screen for
 * three seconds exactly as the web app (and SAND Vault) does it: the veil
 * fades in and out, the badge lands with a small overshoot. The timeline is
 * [DevFlash]'s; this only draws it.
 *
 * There is no server and so no setup screen; this is where the version and
 * the badge live. Reached from the page's ⋯ menu and the launcher shortcut.
 */
class AboutActivity : AppCompatActivity() {
    private lateinit var content: View
    private lateinit var flash: View
    private lateinit var lockup: View
    private var flashStart = 0L
    private var reduceMotion = false

    private val dismissFlash = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() = endFlash()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_about)
        content = findViewById(R.id.content)
        flash = findViewById(R.id.flash)
        lockup = findViewById(R.id.flash_lockup)
        ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        findViewById<TextView>(R.id.version).text = getString(R.string.about_version, BuildConfig.VERSION_NAME)
        findViewById<View>(R.id.source).setOnClickListener {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(getString(R.string.about_source_url))).addCategory(Intent.CATEGORY_BROWSABLE))
            } catch (_: ActivityNotFoundException) {
                Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
            }
        }
        findViewById<View>(R.id.devmark).setOnClickListener { startFlash() }
        // Nobody should be stuck waiting out an animation: a tap ends it, as
        // does Back.
        flash.setOnClickListener { endFlash() }
        onBackPressedDispatcher.addCallback(this, dismissFlash)
    }

    private fun startFlash() {
        val shortSide = minOf(resources.displayMetrics.widthPixels, resources.displayMetrics.heightPixels) / resources.displayMetrics.density
        val size = (DevFlash.badgeSize(shortSide) * resources.displayMetrics.density).toInt()
        findViewById<View>(R.id.flash_badge).layoutParams.apply {
            width = size
            height = size
        }
        // The system's "remove animations" setting: keep the cross-fade (it
        // isn't motion), drop the scale — as the page's reduced-motion rule.
        reduceMotion = Settings.Global.getFloat(contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
        flash.alpha = 0f
        flash.visibility = View.VISIBLE
        if (Build.VERSION.SDK_INT >= 31) content.setRenderEffect(RenderEffect.createBlurEffect(14f, 14f, Shader.TileMode.CLAMP))
        dismissFlash.isEnabled = true
        flashStart = SystemClock.uptimeMillis()
        flash.postOnAnimation(::frame)
    }

    // Driven by its own clock, not an Animator: the system's animation scale
    // must neither stretch it nor end it at once.
    private fun frame() {
        if (flash.visibility != View.VISIBLE) return
        val t = (SystemClock.uptimeMillis() - flashStart).toFloat() / DevFlash.DURATION_MS
        if (t >= 1f) {
            endFlash()
            return
        }
        flash.alpha = DevFlash.veilAlpha(t)
        val s = if (reduceMotion) 1f else DevFlash.badgeScale(t)
        lockup.scaleX = s
        lockup.scaleY = s
        flash.postOnAnimation(::frame)
    }

    private fun endFlash() {
        flash.visibility = View.GONE
        dismissFlash.isEnabled = false
        if (Build.VERSION.SDK_INT >= 31) content.setRenderEffect(null)
    }
}
