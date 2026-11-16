package io.github.chinmay28.todomatrix.core

import java.util.Locale

/**
 * Which file in the APK answers a request for one of the app's pages.
 *
 * The web bundle (`npm run build:android`) is packaged under assets/web/.
 * The asset loader hands the handler the address's path with the leading
 * slash removed: "" for the page itself, "assets/index-abc.js" for the rest.
 * Anything that would climb out of web/ is refused; there is nothing else in
 * the APK's assets a page should read.
 */
object AssetRoute {
    const val ROOT = "web"

    /** The asset path for [path], or null for an address that has none. */
    fun resolve(path: String): String? {
        val p = path.substringBefore('?').substringBefore('#').trimStart('/')
        // A folder (the page itself, or a path ending in '/') is its index.html.
        val file = if (p.isEmpty() || p.endsWith('/')) p + "index.html" else p
        val bad = file.split('/').any { it.isEmpty() || it == "." || it == ".." || '\\' in it || it.any(Char::isISOControl) }
        return if (bad) null else "$ROOT/$file"
    }

    /** The Content-Type the bundle's files are served with. */
    fun mimeType(asset: String): String = when (asset.substringAfterLast('.', "").lowercase(Locale.ROOT)) {
        "html" -> "text/html"
        "js", "mjs" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "webmanifest" -> "application/manifest+json"
        "svg" -> "image/svg+xml"
        "png" -> "image/png"
        "ico" -> "image/x-icon"
        "webp" -> "image/webp"
        "woff2" -> "font/woff2"
        "txt" -> "text/plain"
        else -> "application/octet-stream"
    }

    /** Text the page reads is UTF-8, as Vite writes it; images have no charset. */
    fun encoding(mime: String): String? = if (mime.startsWith("text/") || mime.endsWith("json") || mime == "image/svg+xml") "utf-8" else null
}
