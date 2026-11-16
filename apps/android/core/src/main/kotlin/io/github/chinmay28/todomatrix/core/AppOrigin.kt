package io.github.chinmay28.todomatrix.core

import java.net.URI

/**
 * Where the app's own pages live: the web bundle inside the APK, served by
 * WebViewAssetLoader on its reserved https host.
 *
 * One fixed https origin, not file:// — localStorage (where every task is
 * kept) is per origin, and this one is the same on every launch and every
 * upgrade, so the tasks survive both. The host is reserved by the WebView for
 * exactly this, so no request to it ever leaves the phone.
 */
object AppOrigin {
    const val HOST = "appassets.androidplatform.net"
    const val ORIGIN = "https://$HOST"

    /** The page to open: the matrix, or the add sheet a [launch] asks for. */
    fun start(launch: Launch? = null): String = "$ORIGIN/" + (launch?.let { "#" + it.fragment() } ?: "")

    /** Whether [url] is one of the app's own pages. */
    fun contains(url: String): Boolean {
        val u = try {
            URI(url)
        } catch (_: Exception) {
            return false
        }
        return u.scheme.equals("https", ignoreCase = true) &&
            u.host.equals(HOST, ignoreCase = true) &&
            (u.port == -1 || u.port == 443) &&
            u.rawUserInfo == null
    }
}
