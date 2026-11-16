package io.github.chinmay28.todomatrix

import android.content.Context
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import io.github.chinmay28.todomatrix.core.AppOrigin
import io.github.chinmay28.todomatrix.core.AssetRoute
import java.io.FileNotFoundException

/**
 * Serves the web bundle packaged in the APK (assets/web/, built by `npm run
 * build:android`) on [AppOrigin] — the app's whole "server". Which file
 * answers which address is [AssetRoute]'s decision; this only opens it.
 */
object AppAssets {
    fun loader(context: Context): WebViewAssetLoader {
        val assets = context.applicationContext.assets
        return WebViewAssetLoader.Builder()
            .setDomain(AppOrigin.HOST)
            .addPathHandler("/") { path ->
                val asset = AssetRoute.resolve(path) ?: return@addPathHandler null
                val stream = try {
                    assets.open(asset)
                } catch (_: FileNotFoundException) {
                    return@addPathHandler null
                }
                val mime = AssetRoute.mimeType(asset)
                WebResourceResponse(mime, AssetRoute.encoding(mime), stream)
            }
            .build()
    }
}
