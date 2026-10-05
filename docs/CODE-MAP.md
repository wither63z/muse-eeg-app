# Muse Open Monitor — Mapa de Archivos

Una referencia rápida de los archivos relevantes del proyecto. Para cada archivo: qué hace, qué recibe y qué produce, y qué otros módulos utiliza.

## Tipos y Constantes

| Archivo | Qué hace | Recibe | Produce | Usado por |
|---------|----------|--------|---------|-----------|
| `types/muse.ts` | Define todos los tipos compartidos: EegPacket, TimedSample, BandPowerFrame, Telemetry, MuseState, FitCheck, BandMap, ChannelMap, EEG_CHANNELS, BAND_NAMES, BANDS, SAMPLE_RATE_HZ, PPG_SAMPLE_RATE_HZ, etc. | Ninguno (define la API) | Interfaces y types TypeScript que todo el proyecto usa | Todo el proyecto (ble, dsp, store, components, recording) |
| `constants/muse.ts` | UUIDs de servicios/characterísticas BLE, configuración de bandas, escalas de conversión, frecuencias. | Ninguno | Valores constantes numéricos y strings para BLE y DSP | `ble/museClient.ts`, `ble/museDecoder.ts`, `dsp/dspEngine.ts`, `types/muse.ts` |

## BLE Layer

| Archivo | Qué hace | Recibe | Produce | Usado por |
|---------|----------|--------|---------|-----------|
| `ble/museClient.ts` | Cliente principal: escaneo, conexión, suscripciones nativas y web, manejador de simulador. Enrutador entre `react-native-ble-plx` y Web Bluetooth. | `useMuseStore`, `dspEngine`, `recorder`, `museDecoder`, `museSimulator`, `museWebBluetooth` | Estado de conexión, datos EEG/PPG/IMU fluyendo a `dspEngine` y `store` | `store/useMuseStore.ts`, `recording/recorder.ts`, `components/EegScope.tsx` |
| `ble/museDecoder.ts` | Decodificación pura de paquetes BLE: EEG (12 muestras/paquete), PPG (6 muestras), movimiento (acel/gyro), batería. No tiene imports de React. | `base64-js` (solo dependencia externa) | `EegPacket`, `PpgSample`, `MotionSample`, `BatteryReading` con unidades correctas | `ble/museClient.ts`, `__tests__/museDecoder.test.ts` |
| `ble/museCommands.ts` | Envío de comandos de inicio a la diadema: halt, preset (p50/p21), resume. | `encodeCommand()` | Paquete de bytes codificado para escritura GATT | `ble/museClient.ts` |
| `ble/bleManager.ts` | Wrapper para `react-native-ble-plx` manager (getBleManager). | `react-native-ble-plx` | Instance of `Device` de ble-plx | `ble/museClient.ts` |

## DSP

| Archivo | Qué hace | Recibe | Produce | Usado por |
|---------|----------|--------|---------|-----------|
| `dsp/dspEngine.ts` | Motor de procesamiento en tiempo real. `pushEeg()`, `pushPpg()`, `computeBands()`, `computeFitCheck()`, timers a 10Hz/2Hz/1Hz. Buffer reutilización pre-allocada (`xBuf`, `imBuf`, `psdBuf`, `fillBuf`). | `EegPacket`, `PpgSample` desde `museClient` | Publica `bands` (10Hz), `fit` (2Hz), `heartRate` al store; callbacks `rawSampleCallbacks`, `bandCallbacks` | `ble/museClient.ts`, `store/useMuseStore.ts`, `components/EegScope.tsx` |
| `dsp/fft.ts` | Transformada Rápida de Fourier: `forward(x, im)`, `hannWindow()`. Núcleo matemático puro. | `Float32Array` | `Float32Array` de espectro de potencia | `dsp/dspEngine.ts` |
| `dsp/ringBuffer.ts` | Buffer circular FIFO. `pushMany()`, `copyTo()`, `count`. Reutiliza `Float32Array` pre-allocado para evitar GC. | `Float32Array` | Acceso a datos históricos por canal | `dsp/dspEngine.ts` |
| `dsp/fitCheck.ts` | Algoritmo de fit check: compara la energía en bandas contra umbrales. Retorna `FitCheck {TP9, AF7, AF8, TP10}`. | `ChannelMap<Float32Array>` (ventanas FFT) | `FitCheck` para store | `dsp/dspEngine.ts` |
| `dsp/displaySignal.ts` | Filtrado high-pass para el osciloscopio. `highPassDisplayWindow(buf, n)`. | `Float32Array` buf, número de muestras | `Float32Array` filtrado | `dsp/dspEngine.ts` (usado en `computeBands` y renderizado) |
| `dsp/heartRate.ts` | Estimación de BPM desde la ventana de PPG. `estimateHeartRate(window)`. | `Float32Array` (ventana de PPG) | `number | null` (BPM o null si no hay datos suficientes) | `dsp/dspEngine.ts`, `components/QuietIndicator.tsx` |

## Store

| Archivo | Qué hace | Recibe | Produce | Usado por |
|---------|----------|--------|---------|-----------|
| `store/useMuseStore.ts` | Zustand store con persistencia (`localStorage` web). Estado lento ≤10 Hz. `INITIAL_STATE`, acciones (`setStatus`, `setBands`, `setFit`, `setHeartRate`, etc.). `persist` middleware con protección `QuotaExceededError`. | `dspEngine` (publicaciones), componentes UI | `MuseState` completo con status, device, telemetry, bands, fit, heartRate, stats, isRecording, isSimulating, recordings | `ble/museClient.ts`, `components/*`, `recording/recorder.ts` |

## Componentes UI

| Archivo | Qué hace | Recibe (props / store) | Produce | Usado por |
|---------|----------|------------------------|---------|-----------|
| `components/EegScope.tsx` | Osciloscopio en tiempo real. Canvas 2D (web) o Skia (nativo). `path.reset()` para reutilizar paths y evitar allocations. `windowSeconds`, `uvPerDiv`, `paused`, `displayHighPass`. | `dspEngine.getScopeWindow()`, store (status, headbandOn) | Renderizado visual: líneas por canal, etiquetas, grid, zero lines | `app/(tabs)/raw-eeg.tsx`, `app/(tabs)/_layout.tsx` |
| `components/BandBars.tsx` | Barras de potencia por banda (Delta, Theta, Alpha, Beta, Gamma) por canal. Tokens de tema. | `MuseStore(s => s.bands)` | Barras visuales + valores numéricos | `components/` |
| `components/RecordingRow.tsx` | Fila individual en la lista de grabaciones. Muestra metadatos (fecha, duración, filaCount). | `RecordingMeta` | Fila de lista tapeteable | `app/(tabs)/recordings.tsx` |
| `components/ConnectionCard.tsx` | Estado de conexión: conectado/desconectando/escaneando. | `MuseStore(s => s.status)`, `device` | Tarjeta visual de estado | `app/(tabs)/index.tsx` |
| `components/BatteryGauge.tsx` | Nivel de batería de la diadema. | `MuseStore(s => s.telemetry.battery)` | Indicador visual | `components/` |
| `components/FitCheckHead.tsx` | Indicador de calidad de señal (GOOD/FAIR/POOR) por canal. | `MuseStore(s => s.fit)` | Texto + color por canal | `components/` |
| `components/QuietIndicator.tsx` | QUIET / MOVEMENT basado en acelerómetro/giroscopio. `useMemo` con datos filtrados. | `MuseStore(s => s.telemetry.accel, s => s.telemetry.gyro)` | Tarjeta QUIET/MOVING | `app/(tabs)/raw-eeg.tsx` |
| `components/GlowButton.tsx` | Botón con efecto de glow/hover. Tokens de tema unificados. | Props de botón | Botón interactivo | `components/` |
| `components/BentoCard.tsx` | Tarjeta reutilizable con diseño Bento. Glow dinámico. | Props/estilo | Tarjeta con diseño consistente | `components/` |
| `components/HeartRateDisplay.tsx` | Display de BPM en tiempo real. | `MuseStore(s => s.heartRate)` | Texto BPM | `components/` |

## Grabación

| Archivo | Qué hace | Recibe | Produce | Usado por |
|---------|----------|--------|---------|-----------|
| `recording/recorder.ts` | Clase `Recorder`: start/stop, añade filas, marcadores M1/M2/M3, timers de flush (60s), captura de estado a 10Hz. | `dspEngine` (onRawSample, onBands), `useMuseStore` | `RecordingMeta`, filas CSV acumuladas, `uri` de sesión | `ble/museClient.ts`, `app/(tabs)/raw-eeg.tsx` |
| `recording/csvFormat.ts` | Formatea una fila CSV completa (`formatRow`). Cabecera `MM_CSV_HEADER`. Mapeo `Fit Level → HSI`. `makeFileName`. | `RowState` (timestamp, rawUv, bands, accel, gyro, headbandOn, fit, battery, marker) | `string` (fila CSV lista para concatenar) | `recorder.ts`, `__tests__/csvFormat.test.ts` |
| `recording/recordingsRepo.web.ts` | Repositorio web: `localStorage` con `QuotaExceededError` fallback (solo metadatos). `saveWebSession`, `list`, `deleteRecording`, `exportCsv`, `share`. | `localStorage` | `sessionRecordings` (objeto en memoria) | `recorder.ts`, `store/useMuseStore.ts` (persist) |
| `recording/recordingsRepo.indexeddb.ts` | Nuevo repositorio: IndexedDB nativa. `DB_NAME='MuseDatabase'`, `STORE_NAME='recordings'`. `saveWebSession`, `list`, `deleteRecording`, `exportCsv`, `share`. | `indexedDB` API | Sesiones persistentes, capacidad habitualmente mayor que localStorage; sigue sujeta a cuota y errores | `recordingsRepo.web.ts` y `WebSink` (integración y migración pendientes) |

## Pruebas

| Archivo | Qué testa | Requisitos |
|---------|-----------|------------|
| `__tests__/museDecoder.test.ts` | Decodificación de paquetes EEG, PPG, batería, movimiento. | Node (sin React) |
| `__tests__/fft.test.ts` | Transformada Fourier y ventana Hann. | Node |
| `__tests__/fitCheck.test.ts` | Algoritmo de fit check. | Node |
| `__tests__/ringBuffer.test.ts` | Operaciones de buffer circular. | Node |
| `__tests__/csvFormat.test.ts` | Formateo de filas y cabecera CSV. | Node |
| `__tests__/heartRate.test.ts` | Estimación de BPM desde ventana PPG. | Node |
| `__tests__/recorder.test.ts` | `recorder.start()` existe (validación básica). | Jest/Expo |
| `__tests__/recordingsRepo.web.test.ts` | Listar, borrar, exportar sesiones en web. | Navegador / Node con fakeStorage |

## Archivos nuevos (no conectados aún)

| Archivo | Estado |
|---------|--------|
| `recording/recordingsRepo.indexeddb.ts` | Implementado pero aún no conectado en `useMuseStore.ts` (pendiente migración). |
| `components/BatteryGaugeCompact.tsx` | Componente nuevo, existe en filesystem pero aún no integrado en navegación. |
| `components/HeartRateCompact.tsx` | Componente nuevo, similar. |

## Componentes/webBluetooth aún no totalmente integrados

| Archivo | Qué falta |
|---------|-----------|
| `ble/museWebBluetooth.ts` | Lógica Web Bluetooth complementar a `museClient.ts`. |
| `web-bluetooth.d.ts` | Definiciones TypeScript para la API Web. |

## Flujo de datos completo (resumido)

`Muse 2`
       │
       ▼ (BLE)
`museClient` ──► `museDecoder` ──► `dspEngine`
       │                     │
       │                     ▼
       │               `pushEeg`/`pushPpg`
       │                     │
       ▼                     ▼
`store` <── `dspEngine` ──► `components` (selectores finos)
       │
       ▼
`recorder` ──► `recordingsRepo.*` ──► `localStorage` / `IndexedDB`