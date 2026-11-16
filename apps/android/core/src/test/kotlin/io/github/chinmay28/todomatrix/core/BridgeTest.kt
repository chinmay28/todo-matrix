package io.github.chinmay28.todomatrix.core

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeTest {
    @Test
    fun parsesEachMessage() {
        assertEquals(BridgeRequest.Hello(1), BridgeRequest.parse("""{"t":"hello","re":1}""").getOrThrow())
        assertEquals(BridgeRequest.OpenAbout(0), BridgeRequest.parse("""{"t":"about"}""").getOrThrow())
        val counts = BridgeRequest.parse("""{"t":"counts","re":8,"counts":{"do":1,"schedule":2,"delegate":0,"later":5}}""").getOrThrow()
        assertEquals(8, counts.re)
        assertEquals(5, (counts as BridgeRequest.PostCounts).counts[Quadrant.LATER])
        assertEquals(
            BridgeRequest.Begin(2, "a.json", "application/json", 10, TransferAction.SAVE),
            BridgeRequest.parse("""{"t":"begin","re":2,"name":"a.json","mime":"application/json","size":10,"action":"save"}""").getOrThrow(),
        )
        assertEquals(
            BridgeRequest.Begin(2, "", "application/octet-stream", 0, TransferAction.STAGE),
            BridgeRequest.parse("""{"t":"begin","re":2,"size":0,"action":"stage"}""").getOrThrow(),
        )
        assertEquals(BridgeRequest.Chunk(3, "t1", 0, "AAAA"), BridgeRequest.parse("""{"t":"chunk","re":3,"id":"t1","seq":0,"data":"AAAA"}""").getOrThrow())
        assertEquals(BridgeRequest.End(4, "t1"), BridgeRequest.parse("""{"t":"end","re":4,"id":"t1"}""").getOrThrow())
        assertEquals(BridgeRequest.Abort(5, "t1"), BridgeRequest.parse("""{"t":"abort","re":5,"id":"t1"}""").getOrThrow())
        assertEquals(
            BridgeRequest.Share(6, listOf("t1", "t2"), "a", "", ""),
            BridgeRequest.parse("""{"t":"share","re":6,"ids":["t1","t2"],"title":"a"}""").getOrThrow(),
        )
    }

    @Test
    fun refusesWhatItCannotRead() {
        for (bad in listOf("", "nope", """{"t":"explode"}""", """{"re":1}""", """{"t":"begin","action":"save"}""",
            """{"t":"begin","size":1,"action":"burn"}""", """{"t":"chunk","id":"t1"}""",
            // SAND Vault's server download has no place here: there is no server.
            """{"t":"fetch","url":"https://appassets.androidplatform.net/x","name":"x"}""",
            """{"t":"counts"}""", """{"t":"counts","counts":{"do":1}}""", """{"t":"counts","counts":{"do":-1,"schedule":0,"delegate":0,"later":0}}""")) {
            assertTrue("accepted $bad", BridgeRequest.parse(bad).isFailure)
        }
        assertEquals(9, BridgeRequest.reOf("""{"t":"explode","re":9}"""))
        assertEquals(0, BridgeRequest.reOf("garbage"))
    }

    @Test
    fun replies() {
        val ok = JSONObject(BridgeReply.ok(3, "id" to "t1", "ids" to listOf("a")))
        assertEquals(3, ok.getInt("re"))
        assertTrue(ok.getBoolean("ok"))
        assertEquals("t1", ok.getString("id"))
        assertEquals("a", ok.getJSONArray("ids").getString(0))
        val err = JSONObject(BridgeReply.error(4, "no", cancelled = true))
        assertEquals(false, err.getBoolean("ok"))
        assertEquals("no", err.getString("error"))
        assertEquals(true, err.getBoolean("cancelled"))
    }
}
