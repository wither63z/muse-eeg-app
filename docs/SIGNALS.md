# Muse Open Monitor — Señales y Datos

Descripción detallada de cada señal que la aplicación recibe, procesa y muestra de la diadema Muse 2.

## Canales EEG

La diadema Muse 2 mide actividad eléctrica cerebral a través de 4 electrodos principales. Los datos se reciben empaquetados en paquetes GATT de 20 bytes (12 muestras por paquete).

### Canales

| Canal | Posición | Tipo de señal |
|-------|----------|---------------|
| **TP9** | Párpado izquierdo (temporal) | EEG |
| **AF7** | Frente izquierdo | EEG |
| **AF8** | Frente derecho | EEG |
| **TP10** | Párpado derecho (temporal) | EEG |

### Unidades y formato

- **Microvoltios (µV):** Las muestras se decodifican de valores ADC de 12 bits a µV.
- **Factor de conversión:** `EEG_UV_PER_LSB = 0.48828125` (2000 µV / 4096).
- **Punto medio ADC:** `EEG_ADC_MIDPOINT = 2048` (valor que representa 0 µV).

### Formato del paquete EEG (decodificado en `ble/museDecoder.ts`)

```
Layout: [seqHi, seqLo, ...18 bytes]
  - bytes[0-1]: Secuencia uint16 (0..65535, con wrap-around)
  - bytes[2-19]: 12 muestras de 12 bits big-endian empaquetados
    - Muestras pares (0, 2, 4, 10): Ocupan byte[k] completo + nibble alto de byte[k+1]
    - Muestras impares (1, 3, 5, 11): Ocupan nibble bajo de byte[k] + byte[k+1] completo
    - Fórmula: raw = (bytes[k] << 4) | (bytes[k+1] >> 4)  (pares)
               raw = ((bytes[k] & 0x0f) << 8) | bytes[k+1]  (impares)
    - µV = (raw - 2048) * 0.48828125
```

### Ejemplo de decodificación (`types/muse.ts` → `ble/museDecoder.ts`)

```typescript
// samplesUv[i] = (raw - EEG_ADC_MIDPOINT) * EEG_UV_PER_LSB
samplesUv[i] = (raw - 2048) * 0.48828125;
```

## PPG (Ritmo Cardíaco)

### Fuente

LED infrarrojo de la diadema Muse 2/S clásico. El paquete contiene 6 muestras unsigned de 24 bits.

### Formato del paquete PPG (decodificado en `ble/museDecoder.ts`)

```
Layout: [seqHi, seqLo, ...18 bytes de muestras (bytes 2 a 19)]
  - bytes[0-1]: Secuencia uint16
  - bytes[2,5,8,11,14,17]: Primer byte de cada muestra (8 bits MSB)
  - bytes[3,6,9,12,15,18]: Segundo byte (8 bits middle)
  - bytes[4,7,10,13,16,19]: Tercer byte (8 bits LSB)
  - Fórmula: sample = bytes[offset] * 65536 + bytes[offset+1] * 256 + bytes[offset+2]
  - Offset empieza en 2, paso de 3 (offset = 2, 5, 8, 11, 14, 17)
```

### Frecuencia y estimación de pulso

- **PPG_SAMPLE_RATE_HZ = 64:** La frecuencia es de 64 muestras por segundo, agrupadas en paquetes de 6: aproximadamente 10,67 paquetes/s por canal óptico.
- **estimateHeartRate(window):** Aplica un estimador de periodicidad por autocorrelación sobre una ventana de `PPG_SAMPLE_RATE_HZ * 8` muestras (aprox. 8 segundos).
- **BPM (Beats Per Minute):** Resultado del estimador, mostrado en la pantalla como número de pulsaciones por minuto.
- **Cuando no hay datos suficientes o la señal es pobre:** `heartRate` se establece en `null`.

### Calidad del PPG

El sistema descarta paquetes PPG duplicados o con secuencia inválida (wrap detection). Si no se reciben paquetes durante >3 segundos, `heartRate` se pone a `null` y se limpia la ventana de análisis.

## Movimiento (Acelerómetro y Giroscopio)

### Fuentes

IMU interna de la diadema Muse 2.

### Unidades

| Sensor | Unidades | Rangos típicos |
|--------|----------|----------------|
| **Acelerómetro** | `g` (gravedad) | ±2g aprox. |
| **Giroscopio** | °/s (grados por segundo) | ±250°/s aprox. |

### Formato del paquete MotionSample

Cada paquete contiene 3 vectores (3 × 3 ejes = 9 valores):

```typescript
{ sequence: number, samples: [Vec3, Vec3, Vec3], receivedAtMs: number }
// Vec3 { x: number, y: number, z: number }
```

- **Throttling:** Los datos se throttlean a ~10 Hz en el store (via `setMotion` en `ble/museClient.ts`).
- **Filtro anti-spam:** En `museClient.ts` se usa `if (now - this.lastAccelMs < 100) return;` para limitar a ~10 Hz.

### Uso en la aplicación

- **QuietIndicator:** muestra QUIETO si `abs(hypot(ax, ay, az) - 1) < 0.08 g` y `abs(gx)+abs(gy)+abs(gz) < 15 °/s`. Sin ambos sensores muestra SIN DATOS. Es un indicador aproximado, no una separación filtrada de gravedad.
- **Fit check:** Movimientos excesivos pueden afectar la calidad del señal EEG.

## Fit Check (Calidad de la diadema)

### Qué mide

Algortimo que evalúa la "buena colocación" de la diadema basándose en la energía de las señales EEG en las bandas de frecuencia Delta, Theta, Alpha, Beta, Gamma.

### Valores posibles

| FitLevel | Significado | HSI (Mind Monitor) |
|----------|-------------|---------------------|
| **GOOD (0)** | Señal buena, diadema bien colocada | 1 |
| **FAIR (1)** | Señal aceptable, posible movimiento leve | 2 |
| **POOR (2)** | Señal débil, diadema mal colocada o mucha interferencia | 4 |

### Salida

- **`FitCheck`**: `ChannelMap<FitLevel>` — un valor por cada canal (TP9, AF7, AF8, TP10).
- **`headbandOn: boolean`**: Si la diadema está detectada (usado por el store).
- Publicado a 2 Hz vía `dspEngine.computeFitCheck()`.

### Uso en la interfaz

- Mostrado como indicadores de color por canal en la pantalla `brainwaves`.
- Afecta la captura de grabación (`recorder` verifica `headbandOn` antes de grabar).

## PPG y BPM: Cuándo se ocultan/datos poco fiables

El sistema oculta el BPM (ponlo en `null`) en los siguientes casos:

1. **Sin datos recientes:** Si `Date.now() - lastPpgReceivedAtMs > 3000` (3 segundos sin PPG).
2. **Secuencia inválida:** El wrap de 65535 a 0 es válido. Los duplicados y paquetes atrasados se descartan; un salto de secuencia reinicia la ventana (protege el eje temporal óptico).
3. **Muestras insuficientes:** Si la ventana de análisis (8 segundos ≈ 512 muestras a 64 Hz) no tiene suficiente energía para detectar picos.
4. **Interferencia fuerte:** Ruido súbito o saturación en el canal infrarrojo.

## Indicadores de calidad de señal

| Indicador | Significado | Umbral / Comportamiento |
|-----------|-------------|-------------------------|
| **Quiet (QuietIndicator)** | El usuario está quieto (sín movimiento significativo). | Aceleración: `abs(hypot(x,y,z) - 1) < 0.08 g` Y Giroscopio: `< 15°/s`. |
| **Moving** | Hay movimiento significativo. | Lo opuesto a Quiet. |
| **Fit GOOD** | Señal EEG de buena calidad, diadema bien colocada. | Energía en bandas dentro de rangos esperados. |
| **Fit FAIR** | Señal aceptable pero con alguna anomalía. | Energía parcialmente fuera de rango. |
| **Fit POOR** | Señal débil, probable mala colocación. | Energía muy baja o muy alta en bandas. |

## Interferencia de 60 Hz (mains)

- **Contexto:** Ecuador usa red eléctrica de 60 Hz. La diadema Muse puede captar algo de esta interferencia en las señales EEG.
- **Efecto:** Aparece como picos o energía adicional en la banda de frecuencia cercana a 60 Hz.
- **Validación:** El algoritmo de banda poder cuenta todo el espectro; la interferencia de 60 Hz podría inflar levemente la potencia en la banda Beta (13–30 Hz) y Gamma (30–45 Hz) si está muy cerca del Nyquist o armónicos.
- **Nota:** No se aplica filtrado activo de 60 Hz en el pipeline actual; esto es un área de mejora futura.

## Saturación y artefactos de movimiento

- **Saturación:** Si el valor raw ADC llega al extremo (cerca de 0 o 4095), la muestra estará saturada y tendrá poco valor fisiológico. El decodificador no corta automáticamente; el usuario debe asegurarse de que la diadena no esté demasiado ajustada o suelta.
- **Artefactos de movimiento:** Movimientos bruscos generan picos grandes en las señales de accel/gyro y pueden "colapsar" el fit check (ponerlo en POOR). El sistema detecta esto pero no elimina las muestras EEG afectadas (se dejan en el buffer para que el usuario las vea).

## Cálculos experimentales y qué falta validar

Los siguientes cálculos están implementados pero **no han sido validados contra el algoritmo oficial de Muse**:

1. **Estimación de BPM desde PPG (`estimateHeartRate`):** Usa periodicidad por autocorrelación en una ventana de 8 segundos. La exactitud depende de la calidad del LED infrarrojo y la circulación periférica del usuario.
2. **Fit check personalizado:** El algoritmo de umbrales `GOOD/FAIR/POOR` fue diseñado internamente y no coincide necesariamente con los niveles de ajuste oficiales de Muse.
3. **Banderas de potencia relativa:** La normalización a "potencia total 0.5–45 Hz" es un conveniente de ingeniería, no una característica documentada de Muse.
4. **Filtro high-pass en osciloscopio (`highPassDisplayWindow`):** Aplica una suavizado visual; su efecto en la precisión de las bandas no está totalmente estudiado.

## Fuentes y referencias

- Protocolo Muse 2 GATT: Referencia oficial de documentación de Muse (no distribuida con este proyecto).
- Decodificación EEG: `EEG_UV_PER_LSB = 0.48828125` (2000 µV / 4096 ADC steps).
- Banderas de banda: Definidas en `constants/muse.ts` con rangos `delta (0.5–4 Hz)`, `theta (4–8 Hz)`, `alpha (8–13 Hz)`, `beta (13–30 Hz)`, `gamma (30–45 Hz)`.
- Fit Check: Umbrales internos, no oficiales.