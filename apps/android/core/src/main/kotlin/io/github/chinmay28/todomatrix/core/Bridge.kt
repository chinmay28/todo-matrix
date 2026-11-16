package io.github.chinmay28.todomatrix.core

import org.json.JSONArray
import org.json.JSONObject

/**
 * The messages the app's page and the app send each other.
 *
 * The page cannot hand the phone a file by itself: a web view has no
 * Downloads, no share sheet, and cannot read a blob: address from outside the
 * page. So a script the app puts into the page (assets/todomatrix-bridge.js)
 * turns "save this blob" (the backup export) and navigator.share() into these
 * messages, carrying the bytes across in base64 chunks, each answered before
 * the next is sent. It also carries the two things the page tells the app on
 * its own: open the About screen, and the open counts for the widget.
 *
 * Every request carries `re`, a number the page picked; the answer carries
 * the same one. Messages arrive only from [AppOrigin] — the web view enforces
 * that, not this code.
 */
sealed class BridgeRequest {
    abstract val re: Int

    /** The page asking what it is running in. */
    data class Hello(override val re: Int) : BridgeRequest()

    /** Open the app's own About screen. */
    data class OpenAbout(override val re: Int) : BridgeRequest()

    /** The open-task counts, posted after every change. */
    data class PostCounts(override val re: Int, val counts: Counts) : BridgeRequest()

    /** A file is coming: [size] bytes, to be saved to Downloads or staged for sharing. */
    data class Begin(
        override val re: Int,
        val name: String,
        val mime: String,
        val size: Long,
        val action: TransferAction,
    ) : BridgeRequest()

    data class Chunk(override val re: Int, val id: String, val seq: Int, val data: String) : BridgeRequest()

    data class End(override val re: Int, val id: String) : BridgeRequest()

    data class Abort(override val re: Int, val id: String) : BridgeRequest()

    /** Open the share sheet with staged files and/or text. */
    data class Share(
        override val re: Int,
        val ids: List<String>,
        val title: String,
        val text: String,
        val url: String,
    ) : BridgeRequest()

    companion object {
        fun parse(message: String): Result<BridgeRequest> = runCatching {
            val m = JSONObject(message)
            val re = m.optInt("re", 0)
            when (val t = m.optString("t")) {
                "hello" -> Hello(re)
                "about" -> OpenAbout(re)
                "counts" -> PostCounts(re, Counts.fromJson(m.getJSONObject("counts")))
                "begin" -> Begin(
                    re,
                    name = m.optString("name"),
                    mime = m.optString("mime").ifBlank { "application/octet-stream" },
                    size = m.optLong("size", -1).also { require(it >= 0) { "begin without a size" } },
                    action = TransferAction.of(m.optString("action")),
                )
                "chunk" -> Chunk(re, m.getString("id"), m.getInt("seq"), m.getString("data"))
                "end" -> End(re, m.getString("id"))
                "abort" -> Abort(re, m.getString("id"))
                "share" -> Share(
                    re,
                    ids = m.optJSONArray("ids")?.let { a -> List(a.length()) { a.getString(it) } } ?: emptyList(),
                    title = m.optString("title"),
                    text = m.optString("text"),
                    url = m.optString("url"),
                )
                else -> throw IllegalArgumentException("unknown message ${if (t.isEmpty()) "(no type)" else t}")
            }
        }

        /** The `re` of a message that may not parse, so even a refusal can be answered. */
        fun reOf(message: String): Int = runCatching { JSONObject(message).optInt("re", 0) }.getOrDefault(0)
    }
}

enum class TransferAction {
    /** Straight into Downloads: the page saved a file. */
    SAVE,

    /** Held for a [BridgeRequest.Share] that follows: the page shared a file. */
    STAGE;

    companion object {
        fun of(s: String): TransferAction = when (s) {
            "save" -> SAVE
            "stage" -> STAGE
            else -> throw IllegalArgumentException("unknown action \"$s\"")
        }
    }
}

/** An answer to a [BridgeRequest]. */
object BridgeReply {
    fun ok(re: Int, vararg extra: Pair<String, Any?>): String {
        val o = JSONObject().put("re", re).put("ok", true)
        for ((k, v) in extra) o.put(k, if (v is List<*>) JSONArray(v) else v)
        return o.toString()
    }

    /** [cancelled] says the person backed out, which the page does not report as a failure. */
    fun error(re: Int, message: String, cancelled: Boolean = false): String =
        JSONObject().put("re", re).put("ok", false).put("error", message).put("cancelled", cancelled).toString()
}
