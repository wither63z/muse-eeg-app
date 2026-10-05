# Muse Open Monitor — Guía para Desarrolladores

Cómo preparar el entorno, ejecutar el proyecto, añadir nuevas funcionalidades y contribuir.

## Preparar el entorno

### Prerrequisitos

- **Node.js:** Versión compatible con Expo SDK 57 (consultar `package.json` `"engines"` o `npx expo doctor`).
- **npm / yarn / pnpm:** `npx expo install` es el comando recomendado (nunca `npm install` o `yarn add` directo).
- **Expo CLI:** `npx expo` está disponible globalmente cuando se ejecuta desde el directorio del proyecto.
- **Git:** Para control de versiones y ramas.

### Comandos iniciales

```bash
# 1. Clonar o asegurar tener el proyecto
git clone <url-del-repo>
cd muse-eeg-app

# 2. Instalar dependencias (usa npx expo install)
npx expo install

# 3. Verificar tipos TypeScript
npx tsc --noEmit

# 4. Ejecutar pruebas automáticas
npm test   # o: npx jest

# 5. Diagnosticar problemas de dependencia y configuración
npx expo-doctor

# 6. Arreglar versiones incompatibles automáticamente
npx expo install --fix
```

## Ejecutar el proyecto

### Modos de ejecución

| Comando | Plataforma | Qué hace |
|---------|------------|----------|
| `npx expo start` | Todos | Inicia el servidor de desarrollo Metro. Se abre el terminal UI de Expo. |
| `npx expo start --web` | Web (navegador) | Inicia la versión web. Se abre http://localhost:19006 en el navegador. |
| `npx expo run:android` | Android (device/emulator) | Requiere `development build` (ver below). |
| `npx expo run:ios` | iOS (device/simulator) | Requiere `development build`. |
| `eas build --profile development` | Nube | Compila un build de desarrollo en la nube EAS. |

### Builds de desarrollo (necesarias para Bluetooth y Skia)

Esta aplicación usa dependencias con código nativo:

- **react-native-ble-plx** → acceso Bluetooth Android/iOS.
- **@shopify/react-native-skia** → renderizado gráfico avanzado.

**Expo Go no funcionará** por estas dependencias. Debes crear un development build:

```bash
# Primera vez o después de cambios en app.json:
npx expo prebuild --clean   # genera ios/ y android/ (Native Generation)

# Compilar para Android:
npx expo run:android        # o: eas build --profile development --platform android

# Compilar para iOS:
npx expo run:ios            # o: eas build --profile development --platform ios
```

Después del `prebuild`, los directorios `ios/` y `android/` son gestionados por Expo y **no se editan a mano**. Configurar comportamiento nativo en `app.json` y mediante config plugins.

## Dónde empezar a leer el código

| Área | Archivo inicial | Qué contiene |
|------|----------------|--------------|
| **Conexión BLE** | `ble/museClient.ts` | Escaneo, conexión nativa/web, suscripciones, simulador. |
| **Procesamiento de señales** | `dsp/dspEngine.ts` | Núcleo en tiempo real, buffers, FFT, bandas, fit check. |
| **Tipos y configuración** | `types/muse.ts`, `constants/muse.ts` | Todas las interfaces, UUIDs, rangos de bandas, factores de conversión. |
| **Estado (Zustand)** | `store/useMuseStore.ts` | Store global, persistencia, acciones, `INITIAL_STATE`. |
| **Formato CSV** | `recording/csvFormat.ts` | Cabecera, `formatRow`, `makeFileName`. |
| **Osciloscopio** | `components/EegScope.tsx` | Renderizado canvas 2D (web) o Skia (nativo). |
| **Grabaciones** | `recording/recorder.ts`, `recording/recordingsRepo.web.ts` | `start/stop`, marcadores, sinks, IndexedDB nuevo. |

## Cómo añadir una pantalla nueva

1. **Definir la ruta** en `app/(tabs)/_layout.tsx` (agregar un nuevo `Tabs.Screen`).
2. **Crear el componente** en `components/` siguiendo los patrones existentes (tokens de tema, selectores finos, sin allocations en hot paths).
3. **Conectar el store** usando selectores finos: `useMuseStore(s => s.status)` o `useMuseStore(s => s.bands)`.
4. **Exportar** como default y añadir al `TabLayout`.
5. **Actualizar `tsc --noEmit`** para verificar que no hay errores de tipo.

### Ejemplo mínimo

```typescript
// En app/(tabs)/_layout.tsx
<Tabs.Screen
  name "new-screen"
  options={{ title: 'Nueva Pantalla' }}
/>

// Después, crear components/NewScreen.tsx
export default function NewScreen() {
  return <View><Text>Contenido</Text></View>;
}
```

## Cómo añadir un nuevo dato (ej. nuevo sensor)

1. **Definir el tipo** en `types/muse.ts` (ej. nueva interfaz en `Telemetry` o `MuseState`).
2. **Añadir la constante** en `constants/muse.ts` si es un UUID, escala o umbral.
3. **Implementar la decodificación** en `ble/museDecoder.ts` (siempre puro, sin React).
4. **Suscribir en el cliente BLE** `ble/museClient.ts` (native o web).
5. **Publicar al store** en la acción correspondiente (`setBattery`, `setMotion`, etc.).
6. **Usar en componentes** con selectores: `useMuseStore(s => s.telemetry.accel)`.
7. **Ejecutar `npx tsc --noEmit`** para verificar.

## Reglas de rendimiento

### Regla de oro: 256 Hz never enter React state or Zustand

- Las muestras EEG a 256 Hz viven en `Float32Array` buffers dentro de `dspEngine`.
- **Nunca** hagas `useMuseStore()` sin un selector que extraiga solo el dato que necesitas.
- **Nunca** hagas operaciones que alojen objetos nuevos en los callbacks de `onRawSample` o `onBands`.
- **Reutilizar buffers:** `RingBuffer.pushMany`, `Fft.forward`, y el bucle del osciloscopio reutilizan `xBuf`, `imBuf`, `psdBuf`, `fillBuf` pre-allocados.

### Memory allocations en hot paths que deben evitarse

| Ubicación | Qué evitar | Alternativa |
|-----------|------------|-------------|
| `dspEngine.pushEeg()` | `new Float32Array(gap)` dentro del loop | Pre-allocar `fillBuf` y rellenar con `.fill(lastSample)` |
| `dspEngine.computeBands()` | `new Float32Array(FFT_SIZE)` por canal | Reutilizar `xBuf`, `imBuf`, `psdBuf` del engine |
| `EegScope draw loop` | `Skia.Path.Make()` por frame | Usar `path.reset()` y reutilizar los `SharedValue` paths (como se hizo recientemente) |
| `ble/museDecoder.ts` | Cualquier `new Array()` o string concatenación | Usar `base64-js` y `Uint8Array` |

### Type checking obligatorio

Siempre ejecuta `npx tsc --noEmit` antes de declarar una tarea como "terminada". El `tsconfig.json` tiene `"strict": true`, así que no hay `any` ni `@ts-ignore`.

### Pure modules constraint

Estos archivos **no deben importar React, React Native ni Expo** (solo `base64-js` está permitido):

- `dsp/*` (fft.ts, ringBuffer.ts, fitCheck.ts, displaySignal.ts, heartRate.ts)
- `ble/museDecoder.ts`
- `ble/museCommands.ts`
- `recording/csvFormat.ts`

Esto permite testearlos con Jest en Node: `npm test` ejecutará los tests en `__tests__/`.

## Cómo probar con simulador y con hardware

### Con el simulador (sin diadema)

1. Asegúrate de que la app compila: `npx expo start --web` o `npx expo run:android`.
2. El simulador se activa desde la pantalla de Conexión: botón "Simulador" o el toggle en la UI.
3. El simulador genera datos sintéticos EEG + PPG + movimiento a frecuencias realistas.
4. Verifica que el osciloscopio, las bandas y el BPM se actualizan.

### Con hardware real (Muse 2 + teléfono/máquina)

1. **Compilar build de desarrollo:**
   ```bash
   npx expo prebuild --clean
   npx expo run:android    # o run:ios
   ```
2. **Conectar la diadema:** Tener la Muse 2 encendida y en modo de emparejamiento.
3. **En la app:** Usar la pantalla Conexión → Escanear → Conectar.
4. **Validar señales:**
   - Osciloscopio debe mostrar 4 canales con actividad.
   - Fit Check debe cambiar según presión de la diadema.
   - Batería debe leerse.
   - PPG/BPM pueden aparecer (depende del firmware y navegador).
5. **Grabar y exportar:** Iniciar grabación, agregar marcadores M1/M2, detener, exportar CSV.

## Configuración personal y no copiar

### Archivos generados/locale que NO deben subirse al repo

- `ios/` y `android/` (generados por `expo prebuild`).
- `node_modules/` (gestionado por `npx expo install`).
- `package-lock.json` (auto-generado, no editar a mano).
- Cualquier `.env` o credenciales reales.
- Grabaciones reales (`recordings/` generadas por el usuario).

### Configuración personal (ej. rutas locales)

Si modificas `app.json` para rutas nativas, recuerda correr `npx expo prebuild --clean` después. No commits estos cambios sin antes verificar que la compilación sigue funcionando.

## Flujo de trabajo típicno

1. **Desarrollo:** `npx expo start --web` para iterar rápidamente en el navegador.
2. **Type check:** `npx tsc --noEmit` cada cambio significativo.
3. **Tests:** `npm test` para validar módulos puros (decodificadores, FFT, buffers).
4. **Integración:** Cambiar a `npx expo run:android` para probar BLE y native.
5. **Build de release:** `eas build --profile production` cuando la funcionalidad esté validada.

## Flujo de Git típico

```bash
# 1. Crear rama para la tarea
git checkout -b feature/nueva-funcionalidad main

# 2. Hacer cambios y commit
git add .              # o archivos específicos
git commit -m "feat: describir el cambio"

# 3. Hacer typecheck antes de subir
npx tsc --noEmit

# 4. Subir y crear PR
git push origin feature/nueva-funcionalidad
# Luego crear Pull Request en GitHub
```