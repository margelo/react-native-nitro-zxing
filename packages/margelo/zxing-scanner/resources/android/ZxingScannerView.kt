package com.margelo.plugins.zxing_scanner

import android.graphics.Color
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Size
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.nativephp.mobile.ui.nativerender.NativeElementBridge
import java.util.Locale
import java.util.concurrent.Executors
import org.json.JSONObject
import zxingcpp.BarcodeReader

/**
 * React Native's throughput screen with PHP in the position occupied by JavaScript.
 *
 * The native layer only captures and decodes frames, emits every result to PHP, and displays
 * PHP-owned progress. PHP performs the dedupe, POST /scan, acceptance check, counting and final
 * timing. Camera resolution and the live zxing-cpp decoder ladder match the RN benchmark.
 */
class ZxingScannerView(
    private val activity: FragmentActivity,
    private val target: Int,
) : FrameLayout(activity) {
    companion object {
        private const val CODE_SCANNED = "Margelo\\ZxingScanner\\Events\\CodeScanned"
        private const val START_REQUESTED = "Margelo\\ZxingScanner\\Events\\StartRequested"
        var current: ZxingScannerView? = null
    }

    private val decodeExecutor = Executors.newSingleThreadExecutor()
    private val plainReader = reader(tryRotate = false)
    private val rotateReader = reader(tryRotate = true)
    private var decoderCalls = 0L
    private var cameraProvider: ProcessCameraProvider? = null

    private val ticker = Handler(Looper.getMainLooper())
    private var count = 0
    private var elapsedMs = 0.0
    private var receivedAt = SystemClock.elapsedRealtime()
    private var phase = "ready"

    private val previewView = PreviewView(activity)
    private val countLabel = TextView(activity)
    private val elapsedLabel = TextView(activity)
    private val errorLabel = TextView(activity)
    private val startButton = Button(activity)

    init {
        buildLayout()
    }

    fun show() {
        current = this
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        content.addView(this, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        ticker.post(tick)
        startCamera()
    }

    fun update(count: Int, elapsedMs: Double, phase: String, error: String) {
        this.count = count
        this.elapsedMs = elapsedMs
        this.phase = phase
        this.receivedAt = SystemClock.elapsedRealtime()
        countLabel.text = count.toString()
        errorLabel.text = error
        errorLabel.visibility = if (error.isEmpty()) GONE else VISIBLE
        startButton.text = if (phase == "running" || phase == "starting") "Running…" else "Start $target QRs"
        startButton.isEnabled = phase != "running" && phase != "starting"
        renderElapsed()
    }

    fun close() {
        ticker.removeCallbacks(tick)
        cameraProvider?.unbindAll()
        decodeExecutor.shutdown()
        (parent as? ViewGroup)?.removeView(this)
        if (current === this) current = null
    }

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(activity)
        future.addListener({
            val provider = future.get()
            cameraProvider = provider
            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }

            // VisionCamera's throughput frame stream is 16:9 1280x720. Do not force an FPS range;
            // let CameraX negotiate the same device camera rate used by the RN run.
            val resolution = ResolutionSelector.Builder()
                .setAspectRatioStrategy(AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY)
                .setResolutionStrategy(
                    ResolutionStrategy(
                        Size(1280, 720),
                        ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                    ),
                )
                .build()
            val analysis = ImageAnalysis.Builder()
                .setResolutionSelector(resolution)
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                .build()
            analysis.setAnalyzer(decodeExecutor) { image ->
                val call = decoderCalls++
                val value = image.use {
                    val plain = plainReader.read(it)
                    val result = if (plain.isEmpty() && call % 4 == 0L) rotateReader.read(it) else plain
                    result.firstOrNull()?.text
                }
                value?.let {
                    NativeElementBridge.sendNativeEvent(
                        CODE_SCANNED,
                        JSONObject().put("data", it).toString(),
                    )
                }
            }
            provider.unbindAll()
            provider.bindToLifecycle(activity, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
        }, ContextCompat.getMainExecutor(activity))
    }

    private val tick = object : Runnable {
        override fun run() {
            renderElapsed()
            ticker.postDelayed(this, 100)
        }
    }

    private fun renderElapsed() {
        val displayed = if (phase == "running") {
            elapsedMs + SystemClock.elapsedRealtime() - receivedAt
        } else {
            elapsedMs
        }
        elapsedLabel.text = String.format(Locale.US, "%.1fs", displayed / 1000.0)
    }

    private fun buildLayout() {
        setBackgroundColor(Color.BLACK)
        isClickable = true
        addView(previewView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        val title = TextView(activity).apply {
            text = "SuperNative"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTypeface(Typeface.DEFAULT, Typeface.BOLD)
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(37, 99, 235))
            gravity = Gravity.CENTER
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        addView(
            title,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.TOP).apply {
                setMargins(dp(16), dp(60), dp(16), 0)
            },
        )

        val panel = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.argb(153, 0, 0, 0))
            setPadding(dp(16), dp(16), dp(16), dp(32))
        }
        countLabel.apply {
            text = "0"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 96f)
            setTypeface(Typeface.DEFAULT_BOLD)
            setTextColor(Color.rgb(74, 222, 128))
            gravity = Gravity.CENTER
            setShadowLayer(8f, 0f, 0f, Color.BLACK)
        }
        elapsedLabel.apply {
            text = "0.0s"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        errorLabel.apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setTextColor(Color.rgb(248, 113, 113))
            visibility = GONE
        }
        startButton.apply {
            text = "Start $target QRs"
            setTextColor(Color.BLACK)
            setBackgroundColor(Color.WHITE)
            setOnClickListener {
                phase = "starting"
                text = "Running…"
                isEnabled = false
                NativeElementBridge.sendNativeEvent(START_REQUESTED, "{}")
            }
        }
        val back = Button(activity).apply {
            text = "Back"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(51, 255, 255, 255))
            setOnClickListener { close() }
        }
        val buttons = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(startButton, LinearLayout.LayoutParams(0, dp(48), 2f))
            addView(back, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginStart = dp(8) })
        }
        panel.addView(countLabel)
        panel.addView(elapsedLabel)
        panel.addView(errorLabel)
        panel.addView(
            buttons,
            LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(10)
            },
        )
        addView(panel, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun reader(tryRotate: Boolean) = BarcodeReader().apply {
        options.formats = setOf(BarcodeReader.Format.QR_CODE)
        options.tryHarder = false
        options.tryRotate = tryRotate
        options.tryInvert = false
        options.tryDownscale = false
    }
}
