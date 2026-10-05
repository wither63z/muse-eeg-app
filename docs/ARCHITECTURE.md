# Muse Open Monitor — Arquitectura del Sistema

Diagrama general del recorrido de los datos desde la diadema hasta la interfaz de usuario.

## Recorrido completo de los datos

```
Muse 2 Diadema
       │
       ▼
Bluetooth (BLE)
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BLE Layer (ble/)                               │
│  ├─ museClient.ts          — Gestión de conexión, suscripciones     │
│  │  • scan(), connect(), disconnect()                            │
│  │  • native (react-native-ble-plx) o web (Web Bluetooth)          │
│  ├─ museDecoder.ts         — Decodificación de paquetes BLE         │
│  │  • decodeEegPacket(): 12 muestras EEG de 20 bytes              │
│  │  • decodePpg(): 6 muestras PPG de 20 bytes                     │
│  │  • decodeMotion(): Acelerómetro/Giroscopio                     │
│  │  • decodeBattery(): Lectura de batería                         │
│  │  • Pure modules (sin React) — testeables en Node                │
│  └─ museCommands.ts        — Comandos de inicio (halt, preset, resume)│
└─────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DSP Engine (dsp/)                              │
│  ├─ dspEngine.ts           — Motor principal, instancia única       │
│  │  • pushEeg(packet): Añade 12 muestras a buffers por canal       │
│  │  • pushPpg(packet): Actualiza PPG a ~64 Hz                     │
│  │  • computeBands(): FFT → bandas a 10 Hz                        │
│  │  • computeFitCheck(): Nivel de ajuste a 2 Hz                   │
│  │  • Buffer reutilización: xBuf, imBuf, psdBuf, fillBuf pre-alloc  │
│  │  • Señala: rawSampleCallbacks, bandCallbacks                 │
│  ├─ fft.ts                   — Transformada Rápida de Fourier        │
│  │  • forward(x, im): FFT in-place                                │
│  │  • hannWindow(): Ventana para reducción de espectro             │
│  ├─ ringBuffer.ts           — Buffer circular FIFO                 │
│  │  • pushMany(): Reutiliza Float32Array pre-allocado              │
│  │  • copyTo(): Copia a Float32Array destino                       │
│  ├─ fitCheck.ts              — Algoritmo de calidad de señal         │
│  │  • computeFit(): Retorna FitCheck {TP9, AF7, AF8, TP10}        │
│  ├─ displaySignal.ts         — Filtrado high-pass para osciloscopio │
│  └─ heartRate.ts             — Estimación de BPM desde PPG          │
└─────────────────────────────────────────────────────────────────────┘
       │
       │ (publica estados derivados ≤10 Hz)
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Zustand Store (store/)                          │
│  useMuseStore.ts           — Estado lento, persistencia              │
│  • status: ConnectionStatus          (~1 cambio/s)                    │
│  • device: MuseDeviceInfo | null     (al conectar/desconectar)      │
│  • telemetry: {battery, accel, gyro, ppg}  (lenta, ≤10 Hz)         │
│  • fit: FitCheck                     (2 Hz)                          │
│  • bands: BandPowerFrame | null      (10 Hz)                       │
│  • heartRate: number | null          (de PPG, ~1 Hz)               │
│  • stats: StreamStats                (1 Hz)                        │
│  • isRecording, isSimulating         (flags)                       │
│  • recordings: RecordingMeta[]       (historial, IndexedDB/web)    │
│  • Selectores obligatorios: useMuseStore(s => s.status)            │
│  • Prohibido almacenar buffers de 256 Hz aquí                    │
└─────────────────────────────────────────────────────────────────────┘
       │
       │ (seleccionadores finos en componentes)
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Componentes (components/)                       │
│  ├─ EegScope.tsx            — Osciloscopio en tiempo real           │
│  │  • Canvas 2D (web) o Skia (nativo)                             │
│  │  • Buffer circular de historial                                │
│  │  • path.reset() para evitar allocations en cada frame            │
│  ├─ BandBars.tsx            — Barras de banda de poder               │
│  ├─ RecordingRow.tsx        — Fila de lista de grabaciones          │
│  ├─ ConnectionCard.tsx      — Estado de conexión                   │
│  ├─ BatteryGauge.tsx        — Nivel de batería                    │
│  ├─ FitCheckHead.tsx        — Indicador de calidad de señal         │
│  └─ QuietIndicator.tsx      — QUIET / MOVEMENT (acel/gyro)          │
└─────────────────────────────────────────────────────────────────────┘
       │
       │ (eventos UI: pause, window change, markers)
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Grabación (recording/)                          │
│  recorder.ts               — Orquesta la grabación                   │
│  • start/stop: Controla timers y suscripciones                     │
│  • WebSink: Acumula en memoria / localStorage                      │
│  • SegmentedSink (nativo): part-NNNN.csv cada 60 s (~15,360 filas) │
│  • addMarker(): M1, M2, M3                                         │
│  • formatRow(): Formatea fila CSV completa                         │
│  recordingsRepo.*          — Manejo de almacenamiento                │
│  • localStorage (web): `muse_recordings` key                       │
│  • IndexedDB (web, nuevo): DB 'MuseDatabase', objectStore 'recordings'│
│  • exportCsv(id): Devuelve Blob URL                                │
│  • deleteRecording(id): Borra sesión                               │
│  • saveWebSession(id, meta, rows): Guarda sesión                   │
│  • list(): Devuelve lista de metadatos                             │
└─────────────────────────────────────────────────────────────────────┘
```

## Responsabilidades de cada carpeta

| Carpeta | Descripción | Módulos clave |
|---------|-------------|---------------|
| `types/muse.ts` | Todos los tipos TypeScript compartidos | EegPacket, TimedSample, BandPowerFrame, Telemetry, MuseState, FitCheck, etc. |
| `constants/muse.ts` | UUIDs, configuración, constantes físicas | MUSE_SERVICE_UUID, EEG_CHANNELS, BANDS, SAMPLE_RATE_HZ, PPG_SAMPLE_RATE_HZ, EEG_UV_PER_LSB, etc. |
| `ble/` | Capa de bajo nivel: BLE, decodificación, comandos | museClient, museDecoder, museCommands, bleManager |
| `dsp/` | Procesamiento de señales: DSP puro (sin React) | dspEngine, fft, ringBuffer, fitCheck, displaySignal, heartRate |
| `store/useMuseStore.ts` | Zustand store, estado lento ≤10 Hz, persistencia | INITIAL_STATE, acciones, persist middleware |
| `recording/` | CSV, recorder, repositorio de sesiones | recorder, csvFormat, recordingsRepo.web, recordingsRepo.indexeddb |
| `hooks/` | Ganchos personalizados | useRafLoop |
| `components/` | UI React Native / Expo | EegScope, BandBars, RecordingRow, ConnectionCard, BatteryGauge, FitCheckHead, QuietIndicator, etc. |
| `app/(tabs)/` | Navegación con expo-router | index (Conexión), raw-eeg (EEG), brainwaves (Ondas), recordings (Grabaciones) |

## Dependencias entre módulos

- **BLE → DSP:** `museClient.pushEeg()` y `pushPpg()` llaman a `dspEngine.pushEeg()` / `pushPpg()`.
- **DSP → Store:** `dspEngine` publica `bands` (10 Hz) y `fit` (2 Hz) directamente al store mediante `useMuseStore.getState().setBands()` / `setFit()`.
- **Store → Componentes:** Componentes usan selectores finos: `useMuseStore(s => s.bands)`, `useMuseStore(s => s.status)`, etc.
- **Componentes → Recorder:** `EegScope` y controles llaman a `recorder.start()/stop()`, `recorder.addMarker()`.
- **Recorder → Repo:** `recorder.close()` llama a `recordingsRepo.saveWebSession()` (web) o `SegmentedSink` (nativo).
- **Pure modules constraint:** `dsp/*`, `ble/museDecoder.ts`, `ble/museCommands.ts`, `recording/csvFormat.ts` **no** pueden importar React, React Native ni Expo (solo `base64-js`). Esto permite testearlos en Node.

## Frecuencias de actualización

| Dato | Frecuencia | Almacenamiento |
|------|------------|----------------|
| EEG samples (256 Hz) | **256 Hz** | `Float32Array` buffers dentro de `dspEngine` — **nunca entran a React/Zustand** |
| Bandas de poder | 10 Hz | Zustand store (`bands`) |
| Fit check | 2 Hz | Zustand store (`fit`) |
| Batería | ~0.1 Hz | Zustand store (`telemetry.battery`) |
| Acelerómetro / Giroscopio | ~10 Hz (throttled) | Zustand store (`telemetry.accel`, `telemetry.gyro`) |
| PPG / BPM | ~1 Hz (estimado) | Zustand store (`heartRate`) |
| Stats (paquetes recibidos/dropped) | 1 Hz | Zustand store (`stats`) |

## Diferencias entre plataformas

| Aspecto | Web (navegador) | Nativo (Android/iOS) | Simulador |
|---------|-----------------|----------------------|-----------|
| **Bluetooth** | Web Bluetooth API (diálogo de selección usuario) | react-native-ble-plx (acceso directo) | Datos generados localmente |
| **Renderizado** | Canvas 2D nativo (`ctx.fillStyle`, `ctx.strokeStyle`) | @shopify/react-native-skia (Path, Canvas) | Igual que nativo |
| **Grabación** | `localStorage` + migración IndexedDB | `expo-file-system`, archivos segmentados | En memoria, sin persistir |
| **PPG** | Web Bluetooth (experimental) | react-native-ble-plx (característica GATT) | Datos sintéticos |
| **Compilación** | `npx expo start --web` | `npx expo run:android` / `run:ios` | Funciona en ambos |

## ¿Por qué las muestras de 256 Hz no deben entrar en React o Zustand?

El rendimiento crítico depende de mantener la línea de tiempo de 256 Hz estable. Si cada muestra EEG desencadenara una actualización de React state o una acción Zustand:

1. **GC churn:** Crear nuevos objetos `TimedSample` por cada uno de los 4 canales × 256 muestras/seg = ~1024 objetos/segaría. Esto provocaría collections de garbage collection unpredictables.
2. **Latencia de renderizado:** El componente `EegScope` se actualiza por `useRafLoop` (~60 fps máximo), no por cada muestra individual.
3. **Pérdida de tiempo real:** Las muestras deben acumularse en buffers `RingBuffer` pre-allocados (`Float32Array`) y el engine publica **solo** las derivaciones a bajo ritmo (bandas a 10 Hz, fit a 2 Hz).

Por esto el buffer vive en `dspEngine` y el store mantiene solo estado lento. Los componentes leen de los buffers compartidos mediante selectores, no de state reactivo por muestra.