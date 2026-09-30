# AGENTS.md — muse-eeg-app

Muse EEG headband monitor built with Expo SDK 57 (React Native 0.86.3, React 19.2.3). The app connects to a Muse 2 headband over BLE, decodes EEG/IMU telemetry, runs DSP (FFT, band power, fit check), and renders real-time oscilloscope + band-power visualizations with Skia.

## Expo SDK 57 — do not trust training data

SDK 57 is newer than most training corpora. Before writing code that touches any Expo, EAS, or React Native API:

1. Read the `expo` version in `package.json` (currently `~57.0.26`).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v57.0.0/`
3. For anything else, fetch `https://docs.expo.dev/llms.txt` — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links; never answer from memory.

## Commands

```bash
npx expo install <package>   # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start               # start the dev server
npx tsc --noEmit             # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix       # fix incompatible package versions
```

Run typecheck before declaring any task done.

## Path alias

`@/*` maps to `./*` (project root), **not** `src/*`. The tsconfig `paths` config is:
```json
"paths": { "@/*": ["./*"] }
```

## Architecture

```
types/muse.ts          # All shared TypeScript types
constants/muse.ts      # UUIDs, bands, scales, thresholds
ble/                   # BLE layer: permissions, manager, commands, decoder, client
dsp/                   # DSP: ring buffer, FFT, engine, fit check
store/useMuseStore.ts  # Zustand store (slow state only — ≤10 Hz)
recording/             # CSV format, recorder, recordings repo
hooks/                 # useRafLoop
components/            # ConnectionCard, BatteryGauge, FitCheckHead, EegScope, BandBars, RecordingRow
```

### Critical performance rule

**256 Hz EEG samples never enter React state or Zustand.** They live in `Float32Array` buffers inside `dspEngine`. Zustand holds only slow state: bands (10 Hz), fit (2 Hz), battery (~0.1 Hz), accel/gyro (throttled to 10 Hz), stats (1 Hz). Components use fine-grained selectors (`useMuseStore(s => s.status)`) and `useShallow` for objects. Never call `useMuseStore()` without a selector.

### Pure modules (no React/RN/Expo imports)

`dsp/*`, `ble/museDecoder.ts`, `ble/museCommands.ts`, and `recording/csvFormat.ts` must remain pure — no React, React Native, or Expo imports (except `base64-js`). This allows Jest testing in Node.

## Development build required

This app uses `react-native-ble-plx` and `@shopify/react-native-skia` — both have native code. **Expo Go will not work.** You must use a development build:

```bash
npx expo prebuild --clean          # generate ios/ and android/ (first time or after app.json changes)
npx expo run:android               # or run:ios
# or
eas build --profile development    # cloud build
```

Never create or edit `ios/` or `android/` directories by hand — they are generated via Continuous Native Generation. Configure native behavior in `app.json` and config plugins.

## Rules

- `tsconfig.json` has `"strict": true`. No `any` or `@ts-ignore`. Use `unknown` + narrowing.
- No memory allocations in hot paths: `RingBuffer.push`, `Fft.forward`, oscilloscope loop, and BLE callbacks reuse pre-allocated buffers.
- Do not use `muse-js` at runtime (it depends on Web Bluetooth, which does not exist in React Native). It is only a protocol reference.
- After editing `app.json`, run `npx expo prebuild --clean` before building.
- Prefer recommended Expo modules over third-party libraries. Docs: https://docs.expo.dev/versions/latest/index.md
