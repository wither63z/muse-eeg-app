# Muse Open Monitor — Troubleshooting

Problemas concretos y cómo investigarlos. Para cada problema: síntoma → comprobación → posible causa → siguiente acción.

## Página en blanca

| Síntoma | Pantalla totalmente en blanco o error "Unable to resolve module" |
|---------|---------------------------------------------------------------|
| **Comprobación** | 1. Ejecutar `npx tsc --noEmit` — ¿hay errores de tipo?<br>2. Revisar la consola del desarrollador (F12) del navegador — ¿hay mensajes rojos?<br>3. Verificar que el empaque Metro se completó: `npx expo start` debe terminar sin quedarse atascado. |
| **Causa posible** | - Módulo importado incorrectamente (ej. importar `react-native` en un módulo puro `dsp/*`).<br>- Versión incompatibles después de `npx expo install --fix` fallido.<br>- Archivo `.tsx` sintaxis incorrecta o import circular. |
| **Siguiente acción** | 1. Corregir el error de tipo mostrado por `tsc`.<br>2. Ejecutar `npx expo install --fix` para reparar dependencias.<br>3. Limpiar caché: `rm -rf node_modules && npm install` (útil como último recurso).<br>4. Reiniciar el servidor: `npx expo start --clear`. |

## Bluetooth no conecta o se desconecta

| Síntoma | No se encuentra el dispositivo, se conecta y inmediatamente se desconecta, o la app crashea. |
|---------|---------------------------------------------------------------|
| **Comprobación** | 1. `npx expo doctor` — ¿algún warning sobre BleManager o configuración?<br>2. En Android: verificar que `Bluetooth` esté encendido y el dispositivo tenga permisos de ubicación.<br>3. En Web: ¿el navegador pide permiso de Bluetooth la primera vez?<br>4. Revisar la consola: ¿hay errores `Error monitoring TP9:` o `Failed to connect`? |
| **Causa posible** | - Bluetooth del sistema operativo apagado o no compatible.<br>- Permisos de ubicación en Android (obligatorio para BLE scanning).<br>- Web Bluetooth no soportado en el navegador o modo "incognito".<br>- La diadema Muse 2 está conectada a otra app (Ej: Muse App oficial).<br>- Interferencia 60 Hz o saturación de canales. |
| **Siguiente acción** | 1. En Android: Ir a Ajustes → Aplicaciones → [Tu app] → Permisos → Activar Ubicación.<br>2. Probar en otro navegador (Chrome usualmente mejor que Safari para Web Bluetooth).<br>3. Asegurarse de que la diadema no esté conectada a otro dispositivo.<br>4. Reiniciar la app y el Bluetooth del teléfono. |

## EEG lento, ruidoso o saturado

| Síntomopatrón | Señales EEG con poco movimiento, mucha ruido o valores extremos. |
|---------------|---------------------------------------------------------------|
| **Comprobación** | 1. ¿El indicador **Fit Check** dice GOOD/FAIR/POOR?<br>2. ¿El **QuietIndicator** dice QUIET o MOVING?<br>3. ¿Los valores RAW en el CSV están en rango esperado (µV: típicamente ±100 µV, máximo ~500 µV)?<br>4. ¿Hay interferencia de 60 Hz visible en las bandas Beta/Gamma? |
| **Causa posible** | - Diadema mal colocada (suelta o demasiado ajustada).<br>- Sudor, pelo o contacto deficiente en los electrodos.<br>- Interferencia electromagnética (celulares, cargadores nearby).<br>- Saturación ADC (valores cerca de 0 o 4095).<br>- Falta de calibración del fit check para el usuario. |
| **Siguiente acción** | 1. Ajustar la diadema: debe ser firme pero cómoda, los electrodos en contacto directo con la piel.<br>2. Limpiar los electrodos con alcohol isopropílico antes de usar.<br>3. Mover dispositivos que emitan RF (móvil, microondas) lejos de la diadema.<br>4. Si los valores RAW están saturados (cerca de ±2000 µV), reducir la escala en `EegScope` (cambiar de 100µV/div a 50µV/div o viceversa).<br>5. Reiniciar la conexión (Desconectar → Volver a Conectar). |

## PPG sin datos o BPM poco fiable

| Síntoma | No hay número de BPM, o el número parpadea/change rápido. |
|---------|----------------------------------------------------------|
| **Comprobación** | 1. ¿La consola confirma el primer paquete PPG infrarrojo? La pantalla EEG actual no dibuja PPG.<br>2. ¿El `QuietIndicator` usa accel/gyro, no PPG directamente.<br>3. ¿Hace cuántos segundos que no hay datos PPG? (Esta variable interna no se imprime automáticamente; usar instrumentación de desarrollo si hace falta).<br>4. ¿El BPM está en `null` en el store (`useMuseStore(s => s.heartRate)`)? |
| **Causa posible** | - Sin señal infrarroja suficiente (usuario con mucho vello, piel seca, diadema mal ajustada).<br>- El navegador web bloqueó la característica PPG de Web Bluetooth.<br>- Interferencia o paquetes PPG con secuencia inválida (descartados).<br>- El usuario acaba de empezar a usarla; el algoritmo de estimación necesita ~8 segundos de ventana. |
| **Siguiente acción** | 1. Ajustar la diadema para que el sensor PPG (infrarrojo) tenga buen contacto con la piel (en el punto de la frente indicado por el fabricante; no colocar sobre el párpado).<br>2. En web, probar con Chrome o Edge (Safari tiene soporte limitado de Web Bluetooth).<br>3. Esperar 8-10 segundos para reunir una ventana suficiente y obtener una estimación si la señal es fiable.<br>4. Si el BPM está siempre `null`, revisar la consola por mensajes `Error decoding ppg:` o `Primer paquete PPG...`. |

## Grabación que no guarda, exporta o borra

| Síntoma | Darle a "Grabar" nothing pasa, "Exportar" da error, "Borrar" no quita la sesión. |
|---------|----------------------------------------------------------|
| **Comprobación** | 1. Estado de la conexión: `useMuseStore(s => s.status)` debe ser `'streaming'` para grabar.<br>2. Consola: ¿Hay errores `No se puede grabar: no hay conexión activa`?<br>3. En Web: ¿Hay mensaje `localStorage quota exceeded`?<br>4. Probar `list()` manualmente: `npm test -- --testPathPattern=recordingsRepo` |
| **Causa posible** | - No hay conexión streaming (estado `idle` o `connecting`).<br>- `localStorage` lleno — la app cambia a modo "solo metadatos" en silencio.<br>- Intentar borrar desde la UI sin que la sesión exista en el almacén.<br>- El sink (WebSink/SegmentedSink) está en estado inconsistente. |
| **Siguiente acción** | 1. Conectar la diadema y asegurar estado `streaming` antes de gravar.<br>2. Si en web y la grabación deja de guardar después de un tiempo, es probable que se haya agotado `localStorage`; la migración a IndexedDB está prevista (`docs/STATUS.md`).<br>3. Borrar sesión: usar la función `deleteRecording(id)` desde código o verificar que el ID de la sesión coincida con lo que muestra la lista.<br>4. Reiniciar la app si el sink quedó en estado raro. |

## Cuota de almacenamiento agotada

| Síntoma | En web, después de grabar un poco, los datos dejan de guardarse o la app lenta. |
|---------|----------------------------------------------------------|
| **Comprobación** | 1. Abrir la consola del navegador (F12 → Console).<br>2. Buscar: `[recordingsRepo] localStorage quota exceeded:<br>3. Ejecutar `window.localStorage.getMuse_recordings` (o similar) y ver el tamaño.<br>4. Comparar con el límite típico del navegador (5 MB – 10 MB). |
| **Causa posible** | `localStorage` tiene un límite de almacenamiento por origen (generalmente 5–10 MB en la mayoría de navegadores). Las grabaciones CSV de 256 Hz con varios segundos de datos pueden excederlo rápidamente. |
| **Siguiente acción** | 1. **Es un fallo pendiente con riesgo de pérdida de datos:** la app tiene un `try/catch` que detecta este error y cambia a guardar solo metadatos (no los datos CSV crudos).<br>2. Si necesitas grabar más datos, la solución a largo plazo es la migración a IndexedDB (ver `docs/STATUS.md` y `recording/recordingsRepo.indexeddb.ts`).<br>3. Como workaround temporal: exportar primero las sesiones importantes que aún tengan datos. No limpiar localStorage ni borrar sesiones como primera solución. |

## Índice rápido de solución de problemas

| Problema | Documento clave |
|----------|-----------------|
| Página blanca / error de módulo | `DEVELOPMENT.md` (typecheck, expo doctor) |
| Bluetooth no conecta | `DEVELOPMENT.md` (permisos Android), `ARCHITECTURE.md` (ruta nativa vs web) |
| EEG ruidoso/saturado | `SIGNALS.md` (ajuste de diadema, rango µV), `RECORDING.md` (formato CSV) |
| PPG sin BPM | `SIGNALS.md` (condiciones de estimulación), `DEVELOPMENT.md` (flujo de PPG) |
| Grabación falla | `RECORDING.md` (requisitos, `QuotaExceededError`) |
| Almacenamiento lleno (web) | `TROUBLESHOOTING.md` (cuota localStorage), `STATUS.md` (migración IndexedDB) |

---
*Nota: Si ningún de estos pasos resuelve tu problema, revisa la consola del navegador/terminal para mensajes de error específicos y vuelve a intentarlo con un reinicio completo de la aplicación (`npx expo start --clear`).*