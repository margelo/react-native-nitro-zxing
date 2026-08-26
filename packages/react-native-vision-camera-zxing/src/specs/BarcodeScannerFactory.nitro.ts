import type { HybridObject } from 'react-native-nitro-modules'
import type { TargetBarcodeFormat } from './BarcodeFormat'
import type { BarcodeScanner } from './BarcodeScanner.nitro'

export interface BarcodeScannerOptions {
  /**
   * Specifies the formats to be used for Barcode
   * scanning.
   *
   * If you want to detect all kinds of barcodes,
   * use {@linkcode TargetBarcodeFormat | ['all-formats']}
   */
  barcodeFormats: TargetBarcodeFormat[]
}

export interface ZXingBarcodeScannerFactory
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  /**
   * Create a new {@linkcode BarcodeScanner}.
   */
  createBarcodeScanner(options: BarcodeScannerOptions): BarcodeScanner
}

/**
 * Alias of {@linkcode ZXingBarcodeScannerFactory}.
 */
export type BarcodeScannerFactory = ZXingBarcodeScannerFactory
