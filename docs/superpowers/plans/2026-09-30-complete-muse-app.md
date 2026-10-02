# Muse EEG App Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Muse EEG application with full mobile/PC parity, high-performance visualizations, and CSV recording.

**Architecture:** Use a Singleton DSP engine for 256Hz processing. Implement a dual-mode connection layer: BLE for mobile and a Synthetic Simulator for PC/Web. Visualizations use React Native Skia with RequestAnimationFrame loops.

**Tech Stack:** Expo SDK 57, React Native Skia, Zustand, react-native-ble-plx.

**Spec:** Follows AGENTS.md and constants/muse.ts.

## Global Constraints
- SDK 57 requirements (package.json versions).
- 256 Hz data stays out of React/Zustand state.
- Pure modules for DSP/Logic (no RN/Expo imports).
- Absolute paths using @/* (root-relative).

---

### Task 1: Muse Data Simulator (PC/Web Support)

**Files:**
- Create: `ble/museSimulator.ts`
- Modify: `ble/museClient.ts`

**Interfaces:**
- Consumes: `dspEngine.pushEeg`, `useMuseStore`
- Produces: `museClient.connectSimulator()`

- [ ] **Step 1: Create MuseSimulator class**
Implement a class that mimics Muse data packets (EEG, Battery, Accelerometer) using synthetic sine waves and noise.
- [ ] **Step 2: Add Simulator toggle in Connection Logic**
Modify `museClient.ts` to use the simulator when running on Web or when requested.
- [ ] **Step 3: Test on Web**
Run `npx expo start --web` and verify the app receives "fake" brainwaves.

### Task 2: High-Performance EegScope (Skia Integration)

**Files:**
- Modify: `components/EegScope.tsx`
- Consumes: `dspEngine.getScopeWindow`

- [ ] **Step 1: Implement useRafLoop in EegScope**
Use the provided `useRafLoop` to drive the Skia Canvas.
- [ ] **Step 2: Read directly from dspEngine**
In the loop, call `dspEngine.getScopeWindow` to fill a `Float32Array` and update Skia paths without triggering React re-renders.
- [ ] **Step 3: Add Zero-lines and Labels**
Ensure each of the 4 channels has its baseline and name rendered.

### Task 4: Complete Recorder & CSV Export

**Files:**
- Modify: `recording/recorder.ts`
- Modify: `recording/recordingsRepo.ts`

- [ ] **Step 1: Link DSP raw samples to Recorder**
In `recorder.ts`, subscribe to `dspEngine.onRawSample` and buffer samples in memory.
- [ ] **Step 2: Implement Save-to-Disk**
Use `expo-file-system` to write the CSV in Mind Monitor format.
- [ ] **Step 3: Implement Sharing**
Use `expo-sharing` to allow exporting the file from the UI.

### Task 5: Final Polishing & Type Safety

- [ ] **Step 1: Run type-check**
Run `npx tsc --noEmit` and fix any strict violations.
- [ ] **Step 2: Verify AGENTS.md rules**
Check that no 256Hz data is entering Zustand.
- [ ] **Step 3: Battery & Fit Check visual sync**
Ensure `BatteryGauge` and `FitCheckHead` update correctly from Zustand (slow state).
