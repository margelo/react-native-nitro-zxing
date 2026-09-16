package com.margelo.plugins.zxing_scanner

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.nativephp.mobile.bridge.BridgeFunction
import com.nativephp.mobile.bridge.BridgeResponse

object ZxingScannerFunctions {

    /**
     * Opens the live scanner over the current screen. `target` is the confirmed-scan count that
     * ends the run; with a `report_url` the scanner posts each code there itself and counts the
     * ones the server accepts, so no PHP request runs during the benchmark.
     */
    class Start(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.CAMERA), 0x2A16)
                return BridgeResponse.error("camera_permission", "Camera permission requested - start again once granted")
            }

            val target = (parameters["target"] as? Number)?.toInt() ?: 1000
            val reportUrl = (parameters["report_url"] as? String)?.takeIf { it.isNotBlank() }
            activity.runOnUiThread {
                ZxingScannerView.current?.close()
                ZxingScannerView(activity, target, reportUrl).show()
            }
            return BridgeResponse.success(mapOf("target" to target, "report_url" to (reportUrl ?: "")))
        }
    }

    /** The app calls this once its server accepted a scan, so the overlay counts real progress. */
    class Confirm(private val context: Context) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            ZxingScannerView.current?.let { view -> view.post { view.confirm() } }
            return BridgeResponse.success()
        }
    }

    class Stop(private val context: Context) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            ZxingScannerView.current?.let { view -> view.post { view.close() } }
            return BridgeResponse.success()
        }
    }
}
