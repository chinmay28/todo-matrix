package io.github.chinmay28.todomatrix

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import io.github.chinmay28.todomatrix.core.Counts
import io.github.chinmay28.todomatrix.core.Launches
import io.github.chinmay28.todomatrix.core.Quadrant

/**
 * The matrix on the home screen: each quadrant's open count; tap one to add
 * a task to it.
 *
 * The widget never reads the tasks. The page posts its counts after every
 * change (window.todomatrixApp.counts → PageBridge), they are kept here in
 * preferences, and the widget draws them — so the store logic stays in one
 * place, the web app. Until the app has been opened once it shows dashes.
 */
class CountsWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        draw(context, manager, ids, stored(context))
    }

    companion object {
        private const val PREFS = "widget"
        private const val KEY_COUNTS = "counts"

        private val cells = mapOf(
            Quadrant.DO to (R.id.cell_do to R.id.count_do),
            Quadrant.SCHEDULE to (R.id.cell_schedule to R.id.count_schedule),
            Quadrant.DELEGATE to (R.id.cell_delegate to R.id.count_delegate),
            Quadrant.LATER to (R.id.cell_later to R.id.count_later),
        )

        private fun stored(context: Context): Counts? =
            Counts.decode(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_COUNTS, null))

        /** New counts from the page: keep them, and redraw if they changed. */
        fun update(context: Context, counts: Counts) {
            if (counts == stored(context)) return
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_COUNTS, counts.encode()).apply()
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, CountsWidget::class.java))
            if (ids.isNotEmpty()) draw(context, manager, ids, counts)
        }

        private fun draw(context: Context, manager: AppWidgetManager, ids: IntArray, counts: Counts?) {
            val views = RemoteViews(context.packageName, R.layout.widget_counts)
            for ((q, ids2) in cells) {
                val (cell, count) = ids2
                views.setTextViewText(count, counts?.label(q) ?: context.getString(R.string.widget_unknown))
                val add = Intent(context, MainActivity::class.java)
                    .setAction(Launches.ACTION_ADD)
                    .putExtra(Launches.EXTRA_QUADRANT, q.id)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                views.setOnClickPendingIntent(
                    cell,
                    PendingIntent.getActivity(context, q.ordinal, add, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
                )
            }
            manager.updateAppWidget(ids, views)
        }
    }
}
