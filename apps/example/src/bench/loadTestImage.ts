import { Image as RNImage } from 'react-native'
import { type Image, loadImage } from 'react-native-nitro-image'

/**
 * Loads a bundled PNG as a Nitro Image. In debug builds Metro serves assets over HTTP,
 * so the bytes are fetched and decoded from memory (no web-image dependency needed).
 */
export async function loadTestImage(source: number): Promise<Image> {
  const resolved = RNImage.resolveAssetSource(source)
  if (!resolved.uri.startsWith('http')) {
    return await loadImage(source)
  }
  const response = await fetch(resolved.uri)
  const buffer = await response.arrayBuffer()
  return await loadImage({
    encodedImageData: {
      buffer,
      width: resolved.width,
      height: resolved.height,
      imageFormat: 'png',
    },
  })
}
