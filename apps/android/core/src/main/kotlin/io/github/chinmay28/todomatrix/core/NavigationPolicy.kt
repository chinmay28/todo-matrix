package io.github.chinmay28.todomatrix.core

import java.util.Locale

/** What the web view does with a page it was asked to open. */
enum class Navigation {
    /** Open it in the app: the app's own pages. */
    IN_APP,

    /** Hand it to the phone: any other web address, mail, a store link. */
    EXTERNAL,

    /**
     * An intent: URL. Launched only after the app has stripped what a page
     * must not choose (an explicit component, a selector) and limited it to
     * apps that accept links from a browser.
     */
    INTENT,

    /** Refuse it: schemes a page has no business sending the app to. */
    BLOCK,
}

/**
 * Decides where each navigation goes, so the web view only ever shows the
 * app's own bundle ([AppOrigin]). The app has no network permission, so
 * anything else could not load in it anyway; it goes to the phone instead.
 */
object NavigationPolicy {

    /** Schemes that reach into the phone rather than out to an app. */
    private val refused = setOf("javascript", "file", "content", "android-app", "chrome", "about", "ws", "wss")

    fun decide(url: String): Navigation {
        val scheme = url.substringBefore(':', "").lowercase(Locale.ROOT)
        return when {
            scheme == "http" || scheme == "https" -> if (AppOrigin.contains(url)) Navigation.IN_APP else Navigation.EXTERNAL
            // A blob: or data: page the app made, and the blank page a window starts on.
            scheme == "blob" || scheme == "data" || url == "about:blank" -> Navigation.IN_APP
            scheme == "intent" -> Navigation.INTENT
            scheme.isEmpty() || scheme in refused || !Regex("[a-z][a-z0-9+.-]*").matches(scheme) -> Navigation.BLOCK
            // mailto:, tel:, market: and any other app's own scheme; the
            // phone offers it only to apps that take links from a browser.
            else -> Navigation.EXTERNAL
        }
    }
}
