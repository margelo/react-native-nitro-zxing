package com.margelo.plugins.zxing_scanner

import android.graphics.Color
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
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
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import android.util.Size
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.nativephp.mobile.ui.nativerender.NativeElementBridge
import java.util.concurrent.Executors
import org.json.JSONObject
import zxingcpp.BarcodeReader

/**
 * Full-screen camera overlay that decodes QR codes with zxing-cpp and reports each new value
 * to Laravel. It lives inside the host Activity rather than its own, so the WebView underneath
 * stays resumed - a backgrounded WebView drops the fetches that carry events to PHP.
 * Counting is driven by the app: it confirms scans back through the bridge, and the run ends
 * when the confirmed count reaches the target.
 */
class ZxingScannerView(private val activity: FragmentActivity, private val target: Int) : FrameLayout(activity) {
    companion object {
        private const val CODE_SCANNED = "Margelo\\ZxingScanner\\Events\\CodeScanned"
        private const val RUN_COMPLETED = "Margelo\\ZxingScanner\\Events\\RunCompleted"
        var current: ZxingScannerView? = null
    }

    private val decodeExecutor = Executors.newSingleThreadExecutor()
    private val reader = BarcodeReader().apply {
        options.formats = setOf(BarcodeReader.Format.QR_CODE)
        options.tryHarder = false
        options.tryRotate = false
        options.tryInvert = false
        options.tryDownscale = true
        options.maxNumberOfSymbols = 1
    }
    private var lastSent = ""

    private var startedAt = System.currentTimeMillis()
    private var confirmed = 0
    private var finished = false
    private val ticker = Handler(Looper.getMainLooper())
    private var cameraProvider: ProcessCameraProvider? = null

    private val previewView = PreviewView(activity)
    private val countLabel = TextView(activity)
    private val elapsedLabel = TextView(activity)
    private val statusLabel = TextView(activity)

    init {
        buildLayout()
    }

    fun show() {
        current = this
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        content.addView(this, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        startedAt = System.currentTimeMillis()
        ticker.post(tick)
        startCamera()
    }

    fun close() {
        ticker.removeCallbacks(tick)
        cameraProvider?.unbindAll()
        decodeExecutor.shutdown()
        (parent as? ViewGroup)?.removeView(this)
        if (current === this) current = null
    }

    // MARK: Camera

    private fun startCamera() {
        val future = ProcessCameraProvider.getInstance(activity)
        future.addListener({
            val provider = future.get()
            cameraProvider = provider
            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
            // Same frame size the React Native benchmark decodes, so the engines see equal input.
            val resolution = ResolutionSelector.Builder()
                .setResolutionStrategy(ResolutionStrategy(Size(1280, 720), ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
                .build()
            val analysis = ImageAnalysis.Builder()
                .setResolutionSelector(resolution)
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_YUV_420_888)
                .build()
            analysis.setAnalyzer(decodeExecutor) { image ->
                if (finished) {
                    image.close()
                    return@setAnalyzer
                }
                val value = image.use { reader.read(it).firstOrNull()?.text }
                if (value != null && value != lastSent) {
                    lastSent = value
                    NativeElementBridge.sendNativeEvent(CODE_SCANNED, JSONObject().put("data", value).toString())
                }
            }
            provider.unbindAll()
            provider.bindToLifecycle(activity, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
        }, ContextCompat.getMainExecutor(activity))
    }

    // MARK: Progress

    fun confirm() {
        if (finished) return
        confirmed += 1
        countLabel.text = confirmed.toString()
        if (confirmed >= target) finishRun()
    }

    private fun finishRun() {
        finished = true
        ticker.removeCallbacks(tick)
        val elapsedMs = (System.currentTimeMillis() - startedAt).toDouble()
        renderElapsed()
        statusLabel.text = "Done"
        NativeElementBridge.sendNativeEvent(
            RUN_COMPLETED,
            JSONObject().put("count", confirmed).put("elapsedMs", elapsedMs).toString(),
        )
    }

    private val tick = object : Runnable {
        override fun run() {
            renderElapsed()
            ticker.postDelayed(this, 100)
        }
    }

    private fun renderElapsed() {
        elapsedLabel.text = String.format("%.1fs", (System.currentTimeMillis() - startedAt) / 1000.0)
    }

    // MARK: Overlay

    private fun buildLayout() {
        setBackgroundColor(Color.BLACK)
        isClickable = true
        addView(previewView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

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
        statusLabel.apply {
            text = "Running…"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTypeface(Typeface.DEFAULT_BOLD)
            setTextColor(Color.BLACK)
            setBackgroundColor(Color.WHITE)
            gravity = Gravity.CENTER
        }
        val back = Button(activity).apply {
            text = "Back"
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.argb(51, 255, 255, 255))
            setOnClickListener { close() }
        }
        val buttons = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            addView(statusLabel, LinearLayout.LayoutParams(0, dp(48), 2f))
            addView(back, LinearLayout.LayoutParams(0, dp(48), 1f).apply { marginStart = dp(8) })
        }

        panel.addView(countLabel)
        panel.addView(elapsedLabel)
        panel.addView(buttons, LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10) })
        addView(panel, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
