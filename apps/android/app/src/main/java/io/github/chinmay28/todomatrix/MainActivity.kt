package io.github.chinmay28.todomatrix

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.MimeTypeMap
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import io.github.chinmay28.todomatrix.core.AcceptTypes
import io.github.chinmay28.todomatrix.core.AppOrigin
import io.github.chinmay28.todomatrix.core.Launch
import io.github.chinmay28.todomatrix.core.Launches
import io.github.chinmay28.todomatrix.core.Navigation
import io.github.chinmay28.todomatrix.core.NavigationPolicy
import org.json.JSONObject

/**
 * The app: To Do Matrix's own web app, from inside the APK, in a web view.
 *
 * Everything the matrix does in a browser it does here, because it is the
 * same page, built by `npm run build:android` and served from the APK's
 * assets on a fixed https origin ([AppOrigin]) so its localStorage — where
 * the tasks are — persists across launches and upgrades. No server, no
 * network. What the app adds is what a browser would have and a web view
 * does not (Downloads and the share sheet for the backup, a file picker for
 * its import), and what only an app can do: launcher shortcuts and text
 * shared from other apps open the add sheet pre-set, through the page's
 * #add hash ([Launch]), and the home-screen widget shows the counts.
 */
class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private lateinit var status: View
    private lateinit var assets: WebViewAssetLoader
    private var bridge: PageBridge? = null
    private var loaded = false
    private var pendingFiles: ValueCallback<Array<Uri>>? = null

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val cb = pendingFiles ?: return@registerForActivityResult
        pendingFiles = null
        val data = result.data
        val uris = if (result.resultCode != RESULT_OK || data == null) {
            null
        } else {
            val clip = data.clipData
            if (clip != null && clip.itemCount > 0) Array(clip.itemCount) { clip.getItemAt(it).uri } else data.data?.let { arrayOf(it) }
        }
        cb.onReceiveValue(uris)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        web = findViewById(R.id.web)
        status = findViewById(R.id.status)
        findViewById<View>(R.id.retry).setOnClickListener { open(null) }

        // The page lays itself out for the screen it is given; the bars and
        // the keyboard are kept out of it here.
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root)) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (loaded && web.canGoBack()) web.goBack() else finish()
            }
        })

        assets = AppAssets.loader(this)
        setUpWebView()
        // A launch that recreated the activity (a theme change) was already
        // taken; only a fresh start reads the intent.
        open(if (savedInstanceState == null) launchOf(intent) else null)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        launchOf(intent)?.let { open(it) }
    }

    override fun onDestroy() {
        bridge?.close()
        if (::web.isInitialized) web.destroy()
        super.onDestroy()
    }

    private fun launchOf(intent: Intent?): Launch? = intent?.let {
        Launches.from(
            it.action,
            it.type,
            it.getStringExtra(Launches.EXTRA_QUADRANT),
            it.getStringExtra(Intent.EXTRA_SUBJECT),
            it.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString(),
        )
    }

    /**
     * Shows the matrix, or the add sheet [launch] asks for. A page already
     * showing gets the new hash in place — the page hears `hashchange` and
     * keeps everything else as it was; otherwise the page loads with it.
     */
    private fun open(launch: Launch?) {
        status.visibility = View.GONE
        web.visibility = View.VISIBLE
        if (loaded && launch != null) {
            web.evaluateJavascript("location.hash = ${JSONObject.quote("#" + launch.fragment())}", null)
        } else if (!loaded) {
            web.loadUrl(AppOrigin.start(launch))
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setUpWebView() {
        web.settings.apply {
            javaScriptEnabled = true
            // localStorage: where every task is kept.
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            builtInZoomControls = false
            // The page is laid out for the phone (its viewport tag says
            // device-width); overview mode would zoom out to whatever is widest.
            loadWithOverviewMode = false
            useWideViewPort = true
        }
        web.settings.userAgentString = web.settings.userAgentString + " TodoMatrixApp/" + BuildConfig.VERSION_NAME

        bridge = PageBridge(this, ::openAbout).also { it.install(web) }

        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assets.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                route(request.url.toString())

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                bridge?.onPageStarted(view, url)
            }

            override fun onPageFinished(view: WebView, url: String) {
                if (AppOrigin.contains(url) && status.visibility != View.VISIBLE) loaded = true
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!request.isForMainFrame) return
                loaded = false
                findViewById<TextView>(R.id.status_detail).text = error.description
                status.visibility = View.VISIBLE
                web.visibility = View.INVISIBLE
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            // The backup import's <input type="file">.
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                pendingFiles?.onReceiveValue(null)
                pendingFiles = callback
                val types = AcceptTypes.mimeTypes(params.acceptTypes.orEmpty().toList()) {
                    MimeTypeMap.getSingleton().getMimeTypeFromExtension(it)
                }
                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = types.singleOrNull() ?: "*/*"
                    if (types.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, types.toTypedArray())
                    if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                return try {
                    pickFiles.launch(intent)
                    true
                } catch (_: ActivityNotFoundException) {
                    pendingFiles = null
                    false
                }
            }
        }

        // Reached only when the bridge is not there to take a blob: download
        // (a WebView too old for it): nothing outside the page can read one.
        web.setDownloadListener { url, _, _, _, _ ->
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                Toast.makeText(this, R.string.bridge_unavailable, Toast.LENGTH_LONG).show()
            } else if (!AppOrigin.contains(url)) {
                openExternally(url)
            }
        }
    }

    /** Where a navigation goes; true when the web view must not follow it. */
    private fun route(url: String): Boolean = when (NavigationPolicy.decide(url)) {
        Navigation.IN_APP -> false
        Navigation.EXTERNAL -> {
            openExternally(url)
            true
        }
        Navigation.INTENT -> {
            openIntent(url)
            true
        }
        Navigation.BLOCK -> true
    }

    private fun openExternally(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * An intent: link. The page names an app and a type, never a component:
     * only apps that take links from a browser can be reached this way,
     * exactly as from Chrome.
     */
    private fun openIntent(url: String) {
        val intent = try {
            Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
        } catch (_: Exception) {
            return
        }
        intent.component = null
        intent.selector = null
        intent.addCategory(Intent.CATEGORY_BROWSABLE)
        intent.flags = 0
        try {
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            Toast.makeText(this, R.string.no_app_for_link, Toast.LENGTH_SHORT).show()
        }
    }

    private fun openAbout() {
        startActivity(Intent(this, AboutActivity::class.java))
    }
}
