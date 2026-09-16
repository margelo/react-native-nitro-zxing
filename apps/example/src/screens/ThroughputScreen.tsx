import { useIsFocused, useNavigation } from '@react-navigation/native'
import type {
  ThroughputReporter,
  ThroughputSnapshot,
} from 'example-throughput-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useIsActive } from '../hooks/useIsActive'
import { benchmark } from '../throughput/benchmark'
import { type Engine, ThroughputCamera } from '../throughput/ThroughputCamera'

const TARGET = 1000
const DEFAULT_SERVER = 'http://192.168.1.12:3000'
const EMPTY: ThroughputSnapshot = { state: 'stopped', count: 0, elapsedMs: 0 }

export function ThroughputScreen() {
  const navigation = useNavigation()
  const isActive = useIsActive()
  const isFocused = useIsFocused()
  const [server, setServer] = useState(DEFAULT_SERVER)
  const [engine, setEngine] = useState<Engine>('zxing')
  const [preparing, setPreparing] = useState(false)
  const [reporter, setReporter] = useState<ThroughputReporter>()
  const [snapshot, setSnapshot] = useState(EMPTY)
  const [error, setError] = useState('')
  const [cameraSettings, setCameraSettings] = useState('')
  const current = useRef<ThroughputReporter | undefined>(undefined)
  const generation = useRef(0)
  const starting = useRef(false)
  const mounted = useRef(true)
  const running = preparing || reporter != null

  const stop = useCallback(() => {
    generation.current += 1
    current.current?.stop()
    current.current = undefined
    setReporter(undefined)
    // Do not offer another Start until the canceled setup request has finished.
    setPreparing(starting.current)
  }, [])

  useEffect(() => {
    if (!isActive || !isFocused) stop()
  }, [isActive, isFocused, stop])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      generation.current += 1
      current.current?.stop()
    }
  }, [])

  const fail = useCallback(
    (message: string) => {
      setError(message)
      stop()
    },
    [stop],
  )
  const cameraError = useCallback(
    (message: string) => {
      // A queued error from a disposed worklet must not stop a later run.
      if (reporter != null && current.current === reporter) fail(message)
    },
    [reporter, fail],
  )

  useEffect(() => {
    if (reporter == null) return
    const poll = () => {
      if (current.current !== reporter) return
      const next = reporter.getSnapshot()
      setSnapshot(next)
      if (next.state !== 'running') {
        if (next.error != null) setError(next.error)
        stop()
      }
    }
    const interval = setInterval(poll, 100)
    return () => {
      clearInterval(interval)
    }
  }, [reporter, stop])

  const start = useCallback(async () => {
    if (starting.current || current.current != null) return
    starting.current = true
    const id = ++generation.current
    setPreparing(true)
    setError('')
    setCameraSettings('')
    setSnapshot(EMPTY)
    try {
      const next = await benchmark.createReporter({
        serverURL: server.trim(),
        target: TARGET,
      })
      if (id !== generation.current) {
        next.stop()
        return
      }
      current.current = next
      setReporter(next)
    } catch (error) {
      if (id === generation.current) setError(String(error))
    } finally {
      starting.current = false
      if (mounted.current) setPreparing(false)
    }
  }, [server])

  return (
    <View style={styles.flex}>
      {reporter != null && isActive && isFocused && (
        <ThroughputCamera
          reporter={reporter}
          engine={engine}
          onError={cameraError}
          onConfiguration={setCameraSettings}
        />
      )}
      <View style={styles.top}>
        <TextInput
          style={styles.input}
          value={server}
          onChangeText={setServer}
          editable={!running}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          testID="server-url"
        />
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
        {cameraSettings !== '' && (
          <Text style={styles.results}>{cameraSettings}</Text>
        )}
        <View style={styles.counter}>
          <Text style={styles.count} testID="throughput-count">
            {snapshot.count}
          </Text>
          <Text style={styles.text}>
            {(snapshot.elapsedMs / 1000).toFixed(3)}s
          </Text>
          <Text style={styles.text}>
            {preparing
              ? 'Resetting server and warming HTTP…'
              : running && snapshot.count === 0
                ? 'Waiting for the first accepted QR…'
                : snapshot.state === 'completed'
                  ? `${TARGET} confirmations / ${TARGET - 1} timed intervals`
                  : ''}
          </Text>
        </View>
        {error !== '' && <Text style={styles.error}>{error}</Text>}
        <View style={styles.row}>
          <Pressable
            style={[styles.button, styles.start]}
            onPress={running ? stop : start}
            testID="start-throughput"
          >
            <Text style={styles.startText}>
              {running ? 'Stop' : `Start ${TARGET} QRs (${engine})`}
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
