package io.github.chinmay28.todomatrix

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import io.github.chinmay28.todomatrix.core.AppOrigin
import io.github.chinmay28.todomatrix.core.BridgeReply
import io.github.chinmay28.todomatrix.core.BridgeRequest
import io.github.chinmay28.todomatrix.core.TransferAction
import io.github.chinmay28.todomatrix.core.TransferException
import io.github.chinmay28.todomatrix.core.TransferMeta
import io.github.chinmay28.todomatrix.core.TransferSink
import io.github.chinmay28.todomatrix.core.Transfers
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
import java.util.concurrent.Executors

/**
 * What the app adds to its page: assets/todomatrix-bridge.js, run before the
 * page's own scripts, and the `TodoMatrixAndroid` object it talks through.
 *
 * Both are given to [AppOrigin] alone — the web view itself checks where each
 * page and each message comes from. The script is what makes the backup
 * export (a blob download) and navigator.share() work in a web view, and
 * what defines window.todomatrixApp for the page; see [BridgeRequest].
 */
class PageBridge(
    private val activity: AppCompatActivity,
    private val onOpenAbout: () -> Unit,
) : WebViewCompat.WebMessageListener {

    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    private val staged = HashMap<String, StagedFile>()

    private sealed class Delivered {
        data class Saved(val name: String) : Delivered()
        data class Staged(val file: StagedFile) : Delivered()
    }

    private val transfers = Transfers(maxBytes = MAX_BYTES) { meta -> sinkFor(meta) }

    /** Whether this web view can carry the bridge at all (WebView 82+). */
    val supported: Boolean
        get() = WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)

    private val needsLateInjection: Boolean
        get() = !WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)

    @SuppressLint("RequiresFeature")
    fun install(web: WebView) {
        if (!supported) return
        val rules = setOf(AppOrigin.ORIGIN)
        WebViewCompat.addWebMessageListener(web, OBJECT_NAME, rules, this)
        if (!needsLateInjection) WebViewCompat.addDocumentStartJavaScript(web, script(), rules)
    }

    /** For web views without document-start scripts: run it as the page starts. */
    fun onPageStarted(web: WebView, url: String) {
        if (supported && needsLateInjection && AppOrigin.contains(url)) web.evaluateJavascript(script(), null)
    }

    private fun script(): String {
        val js = activity.assets.open("todomatrix-bridge.js").bufferedReader().use { it.readText() }
        return js.replace("\"__TODOMATRIX_VERSION__\"", JSONObject.quote(BuildConfig.VERSION_NAME))
    }

    // Only ever called through the listener install() added, which it adds
    // only where the feature is present.
    @SuppressLint("RequiresFeature")
    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy,
    ) {
        if (!isMainFrame) return
        val text = message.data ?: return
        val reply: (String) -> Unit = { r -> main.post { runCatching { replyProxy.postMessage(r) } } }
        val request = BridgeRequest.parse(text).getOrElse {
            Log.w(TAG, "refused a message: ${it.message}")
            reply(BridgeReply.error(BridgeRequest.reOf(text), it.message ?: "bad message"))
            return
        }
        when (request) {
            is BridgeRequest.Hello -> reply(BridgeReply.ok(request.re, "platform" to "android", "version" to BuildConfig.VERSION_NAME))
            is BridgeRequest.OpenAbout -> main.post(onOpenAbout)
            is BridgeRequest.PostCounts -> io.execute { CountsWidget.update(activity.applicationContext, request.counts) }
            is BridgeRequest.Share -> share(request, reply)
            else -> io.execute { transfer(request, reply) }
        }
    }

    private fun transfer(request: BridgeRequest, reply: (String) -> Unit) {
        try {
            when (request) {
                is BridgeRequest.Begin -> {
                    val id = transfers.begin(TransferMeta(request.name, request.mime, request.size, request.action))
                    reply(BridgeReply.ok(request.re, "id" to id))
                }
                is BridgeRequest.Chunk -> {
                    transfers.chunk(request.id, request.seq, request.data)
                    reply(BridgeReply.ok(request.re))
                }
                is BridgeRequest.End -> {
                    when (val done = transfers.end(request.id).second) {
                        is Delivered.Saved -> {
                            Downloads.toast(activity, activity.getString(R.string.saved_to_downloads, done.name))
                            reply(BridgeReply.ok(request.re, "name" to done.name))
                        }
                        is Delivered.Staged -> {
                            synchronized(staged) { staged[request.id] = done.file }
                            reply(BridgeReply.ok(request.re, "id" to request.id))
                        }
                    }
                }
                is BridgeRequest.Abort -> transfers.abort(request.id)
                else -> Unit
            }
        } catch (e: TransferException) {
            Log.w(TAG, "transfer failed: ${e.message}")
            if (request is BridgeRequest.End) {
                Downloads.toast(activity, activity.getString(R.string.save_failed, "the file", e.message ?: "failed"))
            }
            reply(BridgeReply.error(request.re, e.message ?: "transfer failed"))
        }
    }

    private fun share(request: BridgeRequest.Share, reply: (String) -> Unit) {
        val files = synchronized(staged) { request.ids.mapNotNull { staged.remove(it) } }
        if (files.size != request.ids.size) {
            reply(BridgeReply.error(request.re, "a file to share went missing"))
            return
        }
        main.post {
            try {
                Sharing.open(activity, files, request.title, request.text, request.url)
                reply(BridgeReply.ok(request.re))
            } catch (e: Exception) {
                reply(BridgeReply.error(request.re, e.message ?: "could not open the share sheet"))
            }
        }
    }

    private fun sinkFor(meta: TransferMeta): TransferSink<Delivered> {
        val dir = File(activity.cacheDir, "incoming").apply { mkdirs() }
        val file = File.createTempFile("part", ".bin", dir)
        val out = FileOutputStream(file).buffered(256 * 1024)
        return object : TransferSink<Delivered> {
            override val output: OutputStream = out

            override fun commit(): Delivered = when (meta.action) {
                TransferAction.SAVE -> try {
                    Delivered.Saved(file.inputStream().use { Downloads.save(activity, it, meta.name, meta.mime) })
                } finally {
                    file.delete()
                }
                TransferAction.STAGE -> Delivered.Staged(Sharing.stage(activity, file, meta.name, meta.mime))
            }

            override fun discard() {
                file.delete()
            }
        }
    }

    fun close() {
        io.execute { transfers.abortAll() }
        io.shutdown()
    }

    companion object {
        private const val TAG = "TodoMatrixBridge"
        const val OBJECT_NAME = "TodoMatrixAndroid"

        // A backup is kilobytes; this only stops a runaway from filling the phone.
        private const val MAX_BYTES = 64L shl 20
    }
}
