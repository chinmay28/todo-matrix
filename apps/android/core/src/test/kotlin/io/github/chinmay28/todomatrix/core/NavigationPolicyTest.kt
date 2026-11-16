package io.github.chinmay28.todomatrix.core

import org.junit.Assert.assertEquals
import org.junit.Test

class NavigationPolicyTest {
    private fun check(url: String, want: Navigation) = assertEquals(url, want, NavigationPolicy.decide(url))

    @Test
    fun theAppsOwnPagesStayInTheApp() {
        check("https://appassets.androidplatform.net/", Navigation.IN_APP)
        check("https://appassets.androidplatform.net/#add=do", Navigation.IN_APP)
        check("https://APPASSETS.androidplatform.net:443/assets/index.js", Navigation.IN_APP)
        check("blob:https://appassets.androidplatform.net/0b1c", Navigation.IN_APP)
        check("data:application/json;base64,AAAA", Navigation.IN_APP)
        check("about:blank", Navigation.IN_APP)
    }

    @Test
    fun otherSitesGoToThePhone() {
        check("https://github.com/chinmay28/todo-matrix", Navigation.EXTERNAL)
        // Same host, not the same origin.
        check("http://appassets.androidplatform.net/", Navigation.EXTERNAL)
        check("https://appassets.androidplatform.net:8443/", Navigation.EXTERNAL)
        check("https://evil@appassets.androidplatform.net/", Navigation.EXTERNAL)
        check("https://appassets.androidplatform.net.evil.example/", Navigation.EXTERNAL)
        check("mailto:someone@example.com", Navigation.EXTERNAL)
        check("market://details?id=x", Navigation.EXTERNAL)
    }

    @Test
    fun intentUrlsAreTheirOwnCase() {
        check("intent://x#Intent;scheme=https;package=com.example;end", Navigation.INTENT)
    }

    @Test
    fun dangerousSchemesAreBlocked() {
        check("javascript:alert(1)", Navigation.BLOCK)
        check("file:///data/data/io.github.chinmay28.todomatrix/app_webview", Navigation.BLOCK)
        check("content://com.android.contacts/contacts", Navigation.BLOCK)
        check("about:config", Navigation.BLOCK)
        check("weird", Navigation.BLOCK)
        check("", Navigation.BLOCK)
    }
}
