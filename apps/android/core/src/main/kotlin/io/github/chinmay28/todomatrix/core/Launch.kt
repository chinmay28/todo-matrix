package io.github.chinmay28.todomatrix.core

import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * "Open the add sheet": pre-set to a [quadrant] (null: the sheet's own
 * default) and with a [title] already typed ('' for none).
 *
 * It reaches the page as the hash the web app reads (src/launch.ts):
 * `#add`, `#add=do`, `#add=do&title=Buy+milk`.
 */
data class Launch(val quadrant: Quadrant?, val title: String) {
    /** The hash, without its '#'. */
    fun fragment(): String {
        val add = quadrant?.let { "add=${it.id}" } ?: "add"
        // URLEncoder writes a space as '+', which URLSearchParams reads back
        // as a space, and a literal '+' as %2B.
        return if (title.isEmpty()) add else "$add&title=" + URLEncoder.encode(title, StandardCharsets.UTF_8)
    }
}

/** Which intents open the add sheet, and how. */
object Launches {
    /** A launcher shortcut or widget cell: add to [EXTRA_QUADRANT]. */
    const val ACTION_ADD = "io.github.chinmay28.todomatrix.ADD"
    const val EXTRA_QUADRANT = "quadrant"

    private const val ACTION_SEND = "android.intent.action.SEND"

    /**
     * The launch an intent asks for, or null when it asks for none (the
     * launcher icon, or a share with nothing usable in it).
     */
    fun from(action: String?, type: String?, quadrant: String?, subject: String?, text: String?): Launch? = when (action) {
        ACTION_ADD -> Launch(Quadrant.of(quadrant), "")
        ACTION_SEND -> if (type?.startsWith("text/") == true) {
            ShareText.title(subject, text).takeIf { it.isNotEmpty() }?.let { Launch(null, it) }
        } else {
            null
        }
        else -> null
    }
}

/** A task's title from text another app shared. */
object ShareText {
    /** The same cap as the page's (src/launch.ts MAX_TITLE). */
    const val MAX_TITLE = 500

    /**
     * One line, from [text] and the share's [subject]. A browser shares a
     * page as subject = its title, text = its address, and "Title — address"
     * is the task; a subject the text already contains is not repeated.
     */
    fun title(subject: String?, text: String?): String {
        val s = oneLine(subject)
        val t = oneLine(text)
        val joined = when {
            s.isEmpty() -> t
            t.isEmpty() -> s
            t.contains(s) -> t
            else -> "$s — $t"
        }
        return joined.take(MAX_TITLE).trim()
    }

    private fun oneLine(s: String?): String = (s ?: "").replace(Regex("\\s+"), " ").trim()
}
