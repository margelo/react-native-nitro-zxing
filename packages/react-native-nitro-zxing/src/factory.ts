import type { Image } from 'react-native-nitro-image'
import { NitroModules } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'
import type { Barcode } from './specs/Barcode.nitro'
import type { BarcodeScanner } from './specs/BarcodeScanner.nitro'
import type {
  BarcodeScannerOptions,
  ZXingBarcodeScannerFactory,
} from './specs/BarcodeScannerFactory.nitro'

const factory = NitroModules.createHybridObject<ZXingBarcodeScannerFactory>(
  'ZXingBarcodeScannerFactory',
)

/**
 * Create a new {@linkcode BarcodeScanner}.
 *
 * The {@linkcode BarcodeScanner} can be used to
 * scan {@linkcode Barcode}s in a {@linkcode Frame} or
 * an existing {@linkcode Image}.
 */
export function createBarcodeScanner(
  options: BarcodeScannerOptions,
): BarcodeScanner {
  return factory.createBarcodeScanner(options)
}
