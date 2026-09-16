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
    class Start(private val activity: FragmentActivity) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.CAMERA), 0x2A16)
                return BridgeResponse.error("camera_permission", "Camera permission requested - start again once granted")
            }

            val target = (parameters["target"] as? Number)?.toInt() ?: 1000
            activity.runOnUiThread {
                ZxingScannerView.current?.close()
                ZxingScannerView(activity, target).show()
            }
            return BridgeResponse.success(mapOf("target" to target))
        }
    }

    class Update(private val context: Context) : BridgeFunction {
        override fun execute(parameters: Map<String, Any>): Map<String, Any> {
            ZxingScannerView.current?.let { view ->
                view.post {
                    view.update(
                        count = (parameters["count"] as? Number)?.toInt() ?: 0,
                        elapsedMs = (parameters["elapsed_ms"] as? Number)?.toDouble() ?: 0.0,
                        phase = parameters["phase"] as? String ?: "ready",
                        error = parameters["error"] as? String ?: "",
                    )
                }
            }
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
