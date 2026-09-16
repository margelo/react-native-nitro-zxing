import { useIsFocused, useNavigation } from '@react-navigation/native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useBarcodeScanner as useZXingBarcodeScanner } from 'react-native-nitro-zxing'
import type { Frame } from 'react-native-vision-camera'
import {
  Camera,
  useCameraDevice,
  useFrameOutput,
} from 'react-native-vision-camera'
import { useBarcodeScanner as useMLKitBarcodeScanner } from 'react-native-vision-camera-barcode-scanner'
import { scheduleOnRN } from 'react-native-worklets'
import { useIsActive } from '../hooks/useIsActive'

type Engine = 'zxing' | 'mlkit'
const TARGET = 1000
// LAN address of the machine running `bun example qr-server`.
const DEFAULT_SERVER = 'http://192.168.1.12:3000'

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

export function ThroughputScreen() {
  const navigation = useNavigation()
  const device = useCameraDevice('back')
  const isAppActive = useIsActive()
  const isFocused = useIsFocused()
  const isActive = isAppActive && isFocused
  const zxing = useZXingBarcodeScanner({ barcodeFormats: ['qr-code'] })
  const mlkit = useMLKitBarcodeScanner({ barcodeFormats: ['qr-code'] })

  const [server, setServer] = useState(DEFAULT_SERVER)
  const [engine, setEngine] = useState<Engine>('zxing')
  const [running, setRunning] = useState(false)
  const [count, setCount] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [results, setResults] = useState<Partial<Record<Engine, number>>>({})
  const [error, setError] = useState('')
  const run = useRef({ active: false, lastSent: '', count: 0 })

  useEffect(
    () => () => {
      run.current.active = false
    },
    [],
  )

  const onCode = useCallback(
    (value: string) => {
      const r = run.current
      if (!r.active || value === r.lastSent) return
      r.lastSent = value
      fetch(`${server}/scan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ value }),
      })
        .then((res) => res.json() as Promise<{ ok: boolean }>)
        .then(({ ok }) => {
          if (ok && r.active) {
            r.count += 1
            setCount(r.count)
          }
        })
        .catch((e) => setError(String(e)))
    },
    [server],
  )

  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet'
      const scanner = engine === 'zxing' ? zxing : mlkit
      const codes = scanner.scanCodes(frame)
      frame.dispose()
      const value = codes[0]?.displayValue ?? codes[0]?.rawValue
      if (value != null) scheduleOnRN(onCode, value)
    },
    [engine, zxing, mlkit, onCode],
  )

  const frameOutput = useFrameOutput({ pixelFormat: 'yuv', onFrame })

  const start = useCallback(async () => {
    if (running) return
    setRunning(true)
    setError('')
    try {
      await fetch(`${server}/reset`, { method: 'POST' })
      run.current = { active: true, lastSent: '', count: 0 }
      setCount(0)
      const startedAt = Date.now()
      setElapsed(0)
      while (run.current.count < TARGET) {
        setElapsed((Date.now() - startedAt) / 1000)
        await delay(100)
      }
      setElapsed((Date.now() - startedAt) / 1000)
      setResults((prev) => ({ ...prev, [engine]: Date.now() - startedAt }))
    } catch (e) {
      setError(String(e))
    } finally {
      run.current.active = false
      setRunning(false)
    }
  }, [running, server, engine])

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>No Camera device!</Text>
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      <Camera
        style={styles.flex}
        device={device}
        isActive={isActive}
        outputs={[frameOutput]}
      />

      <View style={styles.top}>
        {/* <TextInput
          style={styles.input}
          value={server}
          onChangeText={setServer}
          editable={!running}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          testID="server-url"
        /> */}
        <View style={styles.row}>
          {(['zxing', 'mlkit'] as const).map((e) => (
            <Pressable
              key={e}
              style={[styles.toggle, engine === e && styles.toggleActive]}
              onPress={() => setEngine(e)}
              disabled={running}
              testID={`engine-${e}`}
            >
              <Text style={styles.toggleText}>
                {e === 'zxing' ? 'ZXing' : 'ML Kit'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.counter}>
          <Text style={styles.count} testID="throughput-count">
            {count}
          </Text>
          <Text style={styles.text}>
            {`${elapsed.toFixed(1)}s `}
          </Text>
        </View>
        {error !== '' && <Text style={styles.error}>{error}</Text>}
        <View style={styles.row}>
          <Pressable
            style={[styles.button, styles.start, running && styles.disabled]}
            onPress={start}
            disabled={running}
            testID="start-throughput"
          >
            <Text style={styles.startText}>
              {running ? 'Running…' : `Start ${TARGET} QRs (${engine})`}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.secondary]}
            onPress={() => navigation.goBack()}
            testID="throughput-back"
          >
            <Text style={styles.text}>Back</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  top: { position: 'absolute', top: 60, left: 16, right: 16, gap: 8 },
  input: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    color: 'white',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 8 },
  toggle: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  toggleActive: { backgroundColor: '#2563eb' },
  toggleText: { color: 'white', fontWeight: '600' },
  counter: { alignItems: 'center' },
  count: {
    color: '#4ade80',
    fontSize: 96,
    fontWeight: '800',
    textShadowColor: 'black',
    textShadowRadius: 8,
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 32,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  results: { color: '#93c5fd', fontSize: 13 },
  error: { color: '#f87171', fontSize: 13 },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  start: { flex: 2, backgroundColor: 'white' },
  disabled: { opacity: 0.6 },
  startText: { color: 'black', fontSize: 16, fontWeight: '600' },
  secondary: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  text: { color: 'white', fontSize: 15 },
})
