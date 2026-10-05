# Muse Open Monitor — Monitor EEG de Diadema Muse 2

**Para quién:** Cualquier persona que quiera visualizar y grabar datos en tiempo real de una diadema Muse 2 (señales EEG, PPG/ritmo cardíaco, acelerómetro y giroscopio).

## Qué hace la aplicación

Conecta con una diadema Muse 2 por Bluetooth y muestra:

- **Osciloscopio EEG** en tiempo real (4 canales: TP9, AF7, AF8, TP10 a 256 Hz).
- **Barras de banda de potencia** (Delta, Theta, Alpha, Beta, Gamma).
- **Indicador de ritmo cardíaco (PPG)**.
- **Indicadores de movimiento** (acelerómetro y giroscopio).
- **Fit check** (calidad de la diadena).
- **Grabación CSV** de la sesión con marcadores M1/M2/M3.

## La Muse 2 y los datos que recibimos

La diadema Muse 2 mide actividad cerebral a través de sensores EEG y también incluye sensores PPG (infrarrojo para pulso), acelerómetro y giroscopio.

La aplicación recibe los siguientes tipos de datos:

| Dato | Fuente | Frecuencia | Unidades |
|------|--------|------------|----------|
| **EEG** (4 canales) | Sensores TP9, AF7, AF8, TP10 | 256 Hz | microvoltios (µV) |
| **PPG** (ritmo cardíaco) | LED infrarrojo | ~64 Hz | muestras sin procesar |
| **Batería** | Diadema | ~0.1 Hz | porcentaje (0–100%) |
| **Acelerómetro** | IMU | ~10 Hz | gravedad (g) |
| **Giroscopio** | IMU | ~10 °/s | grados por segundo |
| **Fit check** | Algoritmo interno | 2 Hz | GOOD / FAIR / POOR |

## Pantallas de la aplicación

La aplicación tiene 4 pantallas principales (accesibles mediante la barra inferior):

1.  **Conexión (index):** Escanear y conectar la diadema. Muestra el estado, batería y botón para iniciar la diadema o simular datos.
2.  **EEG (raw-eeg):** Osciloscopio en tiempo real. Controles para cambiar la ventana (2s/5s/10s) y la escala (50µV/div o 100µV/div). Muestra el indicador de "quieto" (movimiento detectado).
3.  **Ondas (brainwaves):** Tarjetas que muestran el último cálculo de bandas de poder (log10 potencia absoluta y relativa por canal) a 10 Hz.
4.  **Grabaciones (recordings):** Lista de sesiones grabadas. Permite exportar a CSV, compartir y borrar sesiones.

## Requisitos e instalación

### Versiones compatibles

- **Expo SDK:** `~57.0.26` (consultar `package.json`).
- **Node / npm:** Versiones compatibles con el SDK 57.
- **Sistema operativo:** Windows, macOS o Linux con Node instalado.

### Comandos exactos

```bash
# 1. Instalar dependencias (usa npx expo install, nunca npm/yarn directamente)
npx expo install

# 2. Iniciar el servidor de desarrollo
npx expo start

# 3. Para Web (navegador):
   Abre la dirección que indique Expo (habitualmente http://localhost:8081).
   O: npx expo start --web

# 4. Para dispositivo físico (Android o iOS):
   Se requiere una compilación de desarrollo (explain below).
   O: npx expo run:android   o   npx expo run:ios

# 5. Comprobar tipos:
npx tsc --noEmit

# 6. Ejecutar pruebas automáticas:
npm test   # o: npx jest

# 7. Diagnóstico de dependencias y configuración:
npx expo-doctor

# 8. Arreglar versiones incompatibles:
npx expo install --fix
```

### Por qué Expo Go no sirve

Esta aplicación usa dependencias con código nativo:

- **react-native-ble-plx:** Para acceso Bluetooth nativo (Android/iOS).
- **@shopify/react-native-skia:** Para renderizado gráfico avanzado (Canvas/Skia).

**Expo Go** incluye módulos nativos preinstalados, pero no los módulos BLE/Skia requeridos por este proyecto. Para usarla, debe crear un "development build":

```bash
npx expo prebuild --clean   # genera directorios ios/ y android/ (primera vez o tras cambios en app.json)
npx expo run:android        # o run:ios
# o en la nube:
eas build --profile development
```

## Limitaciones actuales

- **Hardware necesario:** La diadema Muse 2 es necesaria para adquirir señales reales. La app también puede explorarse con el simulador.
- **Bluetooth en web:** Usa la API de Web Bluetooth del navegador, que requiere que el usuario conceda permiso y seleccione el dispositivo desde un diálogo del navegador. No todos los navegadores o dispositivos la admiten.
- **Renderizado:** En web se usa canvas 2D nativo; en dispositivos nativos se usa Skia. Ambas rutas están implementadas pero pueden tener diferencias visuales menores.
- **PPG en web:** La adquisición de ritmo cardíaco (PPG) por Web Bluetooth es experimental y depende del navegador y la diadema.
- **Grabación en web:** Usa `localStorage`; su fallback ante cuota agotada puede conservar solo metadatos y perder las muestras al recargar. pero la migración a IndexedDB está está pendiente (ver `docs/STATUS.md`).

## Referencias

- Docs de Expo: https://docs.expo.dev/versions/v57.0.0/
- Docs de LLM con correcciones: https://docs.expo.dev/llms.txt
- Guía de tipos y constantes: `types/muse.ts`, `constants/muse.ts`
- Arquitectura del proyecto: `AGENTS.md`, `docs/ARCHITECTURE.md`