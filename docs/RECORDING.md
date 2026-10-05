# Muse Open Monitor — Grabación de Sesiones

Guía completa sobre cómo iniciar, detener, marcar y exportar sesiones EEG.

## Inicio y parada

### Iniciar grabación (`recorder.start()`)

- **Requisito previo:** La diadema debe estar conectada y con estado `streaming` (`useMuseStore(s => s.status) === 'streaming'`).
- **Qué hace:**
  1. Crea un nuevo sink (WebSink en web, SegmentedSink en nativo).
  2. Suscribe a `dspEngine.onRawSample` para capturar cada muestra EEG.
  3. Suscribe a `dspEngine.onBands` para capturar las bandas de poder.
  4. Inicia timers:
     - **Flush timer:** Cada 60 segundos (~15,360 filas a 256 Hz) vacía las filas al sink.
     - **Row count timer:** Cada 1 segundo actualiza `store.recordingRowCount`.
     - **State capture timer:** Cada 100 ms (10 Hz) captura accel/gyro/battery del store.
  5. Escribe la cabecera CSV (`MM_CSV_HEADER`).
  6. Marca `store.isRecording = true` y `store.recordingStartedAtMs`.

```typescript
// Uso desde la UI (app/(tabs)/raw-eeg.tsx)
<Button onPress={() => recorder.start()}>Grabar</Button>
```

### Detener grabación (`recorder.stop()`)

- **Qué hace:**
  1. Parar todos los timers (flush, rowCount, stateCapture).
  2. Desuscribirse de `dspEngine` (raw samples y bands).
  3. Vaciar `pendingRows` al sink por última vez.
  4. Cierra el sink (escribe metadatos en web, part-NNNN.csv en nativo).
  5. Genera `RecordingMeta` con: id, fileName, startedAtMs, durationMs, rowCount, sizeBytes, uri.
  6. `store.isRecording = false`, `store.recordingStartedAtMs = null`.

```typescript
// Uso desde la UI
<Button onPress={() => recorder.stop()}>Detener</Button>
```

### Resultado

Un objeto `RecordingMeta`:

| Campo | Descripción |
|-------|-------------|
| `id` | Identificador único (UUID o similar). |
| `fileName` | `mindMonitor_YYYY-MM-DD--HH-mm-ss.csv`. |
| `startedAtMs` | `Date.now()` al iniciar la grabación. |
| `durationMs` | `Date.now() - startedAtMs` al detener. |
| `rowCount` | Número total de filas grabadas (incluyendo `pendingRows` al cerrar). |
| `sizeBytes` | `0` en web (se calcula al exportar) o tamaño real en nativo. |
| `uri` | Ruta o URL donde se guardó la sesión. |

## Marcadores (M1, M2, M3)

- **`recorder.addMarker(label)`:** Añade una marca en el momento actual de la grabación.
- **Convenios:** `M1`, `M2`, `M3` son los labels por defecto. Cualquier string puede pasarse como etiqueta.
- **En CSV:** Aparecen en la columna `Elements` (última columna). Un marcador vacío significa "sin marca en esa fila".

```typescript
<Button onPress={() => recorder.addMarker('M1')}>Marcador M1</Button>
<Button onPress={() => recorder.addMarker('M2')}>Marcador M2</Button>
```

## Formato CSV

### Cabecera (`MM_CSV_HEADER`)

```
TimeStamp,Delta_TP9,Delta_AF7,Delta_AF8,Delta_TP10,Theta_TP9,Theta_AF7,Theta_AF8,Theta_TP10,Alpha_TP9,Alpha_AF7,Alpha_AF8,Alpha_TP10,Beta_TP9,Beta_AF7,Beta_AF8,Beta_TP10,Gamma_TP9,Gamma_AF7,Gamma_AF8,Gamma_TP10,RAW_TP9,RAW_AF7,RAW_AF8,RAW_TP10,Accelerometer_X,Accelerometer_Y,Accelerometer_Z,Gyro_X,Gyro_Y,Gyro_Z,HeadBandOn,HSI_TP9,HSI_AF7,HSI_AF8,HSI_TP10,Battery,Elements
```

### Columnas detalladas

| Grupo | Columnas | Descripción | Unidad |
|-------|----------|-------------|--------|
| **Timing** | `TimeStamp` | Marca de tiempo local `yyyy-MM-dd HH:mm:ss.SSS` | — |
| **Bandas** | 20 columnas (5 bandas × 4 canales) | Potencia log10 absoluta por banda y canal | — |
| **RAW** | 4 columnas (`RAW_TP9`, etc.) | Muestras crudas µV (últimas de cada paquete) | µV |
| **Movimiento** | `Accelerometer_X`, `Accelerometer_Y`, `Accelerometer_Z`, `Gyro_X`, `Gyro_Y`, `Gyro_Z` | Acelerómetro y giroscopio | g / °/s |
| **Estado** | `HeadBandOn` | 1 = diadena puesta, 0 = quitada | — |
| | `HSI_TP9`, etc. | Health Score Index: 1=bueno, 2=regular, 4=malo | — |
| | `Battery` | Porcentaje batería (1 decimal) | % |
| **Marcadores** | `Elements` | Texto de marcador (M1, M2, M3) o vacío | — |

### Filas individuales (`formatRow`)

Cada fila contiene 56+ valores separados por coma. Ejemplo simplificado:

```
2026-10-04 14:30:00.123,0.123,-0.456,...,12.345,1.234,5.678,...
0.111,0.222,0.333,0.444,1.5,2.5,3.5,4.5,50.0,M1
```

- **Valores nulos:** Se representan como cadena vacía entre comas (`,,`).
- **Timestamps:** Hora local del dispositivo donde se grabó.
- **Batería:** `state.battery.percent.toFixed(1)` (ej. `87.5`).

### Tamaño esperado de grabaciones

- **Frecuencia EEG:** 256 muestras/seg.
- **Frecuencia capturada en el CSV:** Cada fila incluye las últimas muestras de los 4 canales (no todas las 256), más metadata a 10 Hz (accel/gyro/battery) y fit a 2 Hz.
- **Intervalo de flush:** Cada 60 segundos (~15,360 filas) en nativo; en web depende del límite de `localStorage`.
- **Límite duro:** 20 minutos máximo de grabación continua (`MAX_RECORDING_MIN = 20`).
- **Ejemplo actual:** 20 min × 60 s/min × 4 canales × 256 muestras/s ≈ 1.228.800 filas. Cada fila actualiza un canal y repite las últimas lecturas de los otros. No son filas sincronizadas; esa corrección sigue pendiente.

### Estado de sincronización entre canales

- Todas las muestreo comparten el mismo reloj interno de la diadema Muse 2.
- Los timestamps en el CSV (`TimeStamp`) son `new Date(tMs)` donde `tMs` es `Date.now()` al momento de recibir la muestra en `dspEngine.pushEeg()`.
- **Posible desync:** Si se pierden paquetes (gap en la secuencia), las muestras afectadas se rellenan con la última muestra válida (`gap filling` en `dspEngine.pushEeg()`), pero el timestamp se mantiene consistente con `Date.now()` del momento de relleno.

## Borrado de sesiones

### `deleteRecording(id)`

- **Qué hace:** Elimina la sesión del almacenamiento (localStorage o IndexedDB) y actualiza la lista UI.
- **Precaución:** En `recordingsRepo.web.ts`, **nunca** se usa el fallback de "solo metadatos" al borrar, para evitar descartar datos CSV de otras sesiones.
- **Flujo:**
  1. `recordingsRepo.deleteRecording(id)` → borra de la DB.
  2. `useMuseStore.setRecordings(list)` → actualiza el array `recordings` en el store.
  3. La UI se refleja automáticamente (selector `useMuseStore(s => s.recordings)`).

## Manejo de errores

### `QuotaExceededError` (web/localStorage)

- Si `localStorage` se llena (límite típicamente 5–10 MB dependiendo del navegador), `saveToStorage()` captura el error y cambia a modo "solo metadatos":
  - Siguientes grabaciones solo guardan el `RecordingMeta`, no las filas CSV completas.
  - Las sesiones ya grabadas conservan sus datos (están en `sessionRecordings` en memoria hasta que `saveToStorage()` se llama de nuevo con éxito o se cierra la app).
- **Indicador:** En consola aparece: `[recordingsRepo] localStorage quota exceeded: ...`

### Fallo en la conexión BLE

- Si la diadema se desconecta durante la grabación, `recorder.stop()` lanza error "No hay grabación activa" si ya no hay estado `streaming`. El try/catch en `museClient.disconnect()` lo captura y continua.

### Fallo en la exportación

- `exportCsv(id)` puede retornar `''` si la sesión no existe. Siempre verifica el retorno antes de crear el `Blob` URL.

## Riesgos de pérdida de datos

| Riesgo | Probabilidad | Consecuencia | Mitigación |
|--------|--------------|--------------|------------|
| **Agotar localStorage** | Alta (web, grabaciones largas) | Datos CSV se pierden, solo metadatos se guardan. | Migración a IndexedDB (ver `docs/STATUS.md`). |
| **Cierre accidental de la app** | Media | Filas pendentes (`pendingRows`) se pierden si no da tiempo al flush de 60 s. | El flush de 60 s salva periódicamente; al detener se hace un flush final. |
| **Desconexión BLE** | Media | Grabación puede quedar incompleta o `recorder` lanza error. | El listener de desconexión en `museClient` llama automáticamente a `recorder.stop()` si estaba grabando. |
| **Error en el hilo principal** | Baja | El timer de stateCapture (100 ms) puede fallar si el store tiene ciclos raros. | El store usa patrones inmutables y selectores finos. |
| **Corrupción CSV** | Muy baja | Si `formatRow` recibe datos `null` inesperados, puede generar comas de más. | `formatRow` maneja `undefined`/`` con valores por defecto. |

## Qué información NO contiene el CSV

- **Sincronización garantizada:** No existe aún alineación por índice de muestra entre los cuatro canales. Se registran las muestras recibidas, pero con valores retenidos en las demás columnas y timestamps de recepción repetidos.
- **PPG y BPM:** El CSV no contiene las muestras ópticas ni el pulso. Sí contiene muestras RAW EEG y potencia absoluta log10 por banda; no incluye la potencia relativa.
- **Información de posición de electrodos:** El CSV no incluye datos de colocación; el `Fit Check` es la proxíma aproximación a la calidad.
- **Timestamps de alta precisión:** Los timestamps son a nivel de milisegundo (`yyyy-MM-dd HH:mm:ss.SSS`) y corresponden al `Date.now()` del dispositivo que grabó, no al tiempo UTC o reloj interno de la diadema con precisión de muestreo.
