package com.margelo.nitro.throughput

import android.os.SystemClock
import okhttp3.Call
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class HybridThroughputReporter(
  options: ThroughputOptions,
) : HybridThroughputReporterSpec() {
  private val baseURL =
    options.serverURL.toHttpUrl().also {
      require(it.encodedPath == "/" && it.query == null && it.fragment == null) { "Enter a server origin without a path, query or fragment" }
    }
  private val target =
    options.target.toInt().also {
      require(options.target == it.toDouble() && it >= 2) { "target must be an integer >= 2" }
    }

  // A new pool per run. OkHttp reuses its connection for warm-up and every report.
  private val client =
    OkHttpClient
      .Builder()
      .connectTimeout(2, TimeUnit.SECONDS)
      .readTimeout(2, TimeUnit.SECONDS)
      .callTimeout(4, TimeUnit.SECONDS)
      // Retrying an accepted POST after losing its response would corrupt the count.
      .retryOnConnectionFailure(false)
      .followRedirects(false)
      .build()
  private val reports = Executors.newSingleThreadExecutor()
  private val lock = Any()
  private var state = ThroughputState.RUNNING
  private var count = 0
  private var startedAt: Long? = null
  private var elapsedMs = 0.0
  private var lastSubmitted: String? = null
  private var errorMessage: String? = null
  private var pendingCall: Call? = null

  fun prepare() {
    check(JSONObject(request("reset", "POST", "{}")).getBoolean("ok")) { "Server reset failed" }
    // GET /scan does not advance the QR server. Its response is fully consumed.
    request("scan", "GET")
  }

  override fun submit(value: String) {
    synchronized(lock) {
      if (state != ThroughputState.RUNNING || value == lastSubmitted) return
      lastSubmitted = value
      reports.execute {
        if (synchronized(lock) { state != ThroughputState.RUNNING }) return@execute
        try {
          val accepted = JSONObject(request("scan", "POST", JSONObject().put("value", value).toString())).getBoolean("ok")
          synchronized(lock) {
            if (!accepted || state != ThroughputState.RUNNING) return@execute
            val now = SystemClock.elapsedRealtimeNanos()
            if (startedAt == null) startedAt = now
            count += 1
            elapsedMs = (now - startedAt!!) / 1_000_000.0
            if (count == target) state = ThroughputState.COMPLETED
          }
          if (synchronized(lock) { state == ThroughputState.COMPLETED }) releaseTransport()
        } catch (error: Exception) {
          synchronized(lock) {
            if (state != ThroughputState.RUNNING) return@execute
            elapsedMs = currentElapsed()
            state = ThroughputState.FAILED
            errorMessage = error.message ?: error.toString()
          }
          releaseTransport()
        }
      }
    }
  }

  override fun getSnapshot(): ThroughputSnapshot =
    synchronized(lock) {
      ThroughputSnapshot(state, count.toDouble(), if (state == ThroughputState.RUNNING) currentElapsed() else elapsedMs, errorMessage)
    }

  override fun stop() {
    synchronized(lock) {
      if (state == ThroughputState.RUNNING) {
        elapsedMs = currentElapsed()
        state = ThroughputState.STOPPED
      }
      // Prevent submit() racing executor shutdown.
      reports.shutdown()
      // Cancel even a call created just before stop(), before execute() registers it.
      pendingCall?.cancel()
    }
    releaseTransport()
  }

  private fun currentElapsed(): Double = startedAt?.let { (SystemClock.elapsedRealtimeNanos() - it) / 1_000_000.0 } ?: 0.0

  private fun releaseTransport() {
    reports.shutdown()
    client.dispatcher.cancelAll()
    client.connectionPool.evictAll()
    client.dispatcher.executorService.shutdown()
  }

  private fun request(
    path: String,
    method: String,
    json: String? = null,
  ): String {
    val body = json?.toRequestBody("application/json".toMediaType())
    val request =
      Request
        .Builder()
        .url(baseURL.newBuilder().addPathSegment(path).build())
        .method(method, body)
        .build()
    val call =
      synchronized(lock) {
        check(state == ThroughputState.RUNNING) { "Run stopped" }
        client.newCall(request).also { pendingCall = it }
      }
    try {
      return call.execute().use { response ->
        if (!response.isSuccessful) throw IOException("HTTP ${response.code} from /$path")
        response.body?.string() ?: throw IOException("Empty response from /$path")
      }
    } finally {
      synchronized(lock) { pendingCall = null }
    }
  }
}
