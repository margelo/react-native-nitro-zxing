package com.margelo.nitro.throughput

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider

class ExampleThroughputPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? = null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider { HashMap() }

  companion object {
    init {
      ExampleThroughputOnLoad.initializeNative()
    }
  }
}
