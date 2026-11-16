package io.github.chinmay28.todomatrix

import android.content.ContentValues
import android.content.Context
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.webkit.MimeTypeMap
import android.widget.Toast
import io.github.chinmay28.todomatrix.core.FileNames
import java.io.IOException
import java.io.InputStream

/** Putting files into the phone's Downloads, in a "To Do Matrix" folder. */
object Downloads {
    private const val FOLDER = "To Do Matrix"

    /**
     * Copies [source] into Downloads as [name] and returns the name it was
     * given there (Android adds " (1)" to a name already taken). Blocks.
     */
    fun save(context: Context, source: InputStream, name: String, mime: String?): String {
        val resolver = context.contentResolver
        val safe = FileNames.sanitize(name)
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, safe)
            put(MediaStore.Downloads.MIME_TYPE, mimeFor(safe, mime))
            put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/$FOLDER")
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: throw IOException("Downloads refused the file")
        try {
            (resolver.openOutputStream(uri) ?: throw IOException("cannot write to Downloads")).use { out ->
                source.copyTo(out, 256 * 1024)
            }
            resolver.update(uri, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            throw e
        }
        return resolver.query(uri, arrayOf(MediaStore.Downloads.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else null
        } ?: safe
    }

    private fun mimeFor(name: String, given: String?): String {
        val g = given?.substringBefore(';')?.trim()
        if (!g.isNullOrEmpty() && g != "application/octet-stream") return g
        val ext = name.substringAfterLast('.', "").lowercase()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
    }

    fun toast(context: Context, text: String) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(context.applicationContext, text, Toast.LENGTH_LONG).show()
        }
    }
}
