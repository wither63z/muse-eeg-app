# Estado del proyecto

Actualizado el 4 de octubre de 2026. Distingue implementación, pruebas automáticas y evidencia física.

## Comprobado automáticamente
- TypeScript y 64 pruebas en 9 suites pasaron en la revisión anterior; deben volver a ejecutarse al modificar código.
- Las pruebas cubren FFT, buffer circular, calidad EEG, decodificación, CSV, estimación de pulso sintético, pipeline de sensores, borrado/persistencia web y ciclo de grabación con sink inyectado.
- La exportación web se generó correctamente. No equivale a una compilación nativa ni a una revisión visual completa.

## Implementado, con validación parcial
- Adquisición EEG/PPG, batería, IMU, simulador, osciloscopio web/Skia y las cuatro pantallas.
- BatteryGaugeCompact, HeartRateCompact y QuietIndicator están utilizados en pantallas reales.
- El usuario comprobó adquisición con Muse 2 y envió capturas y un CSV real. Se observó pulso mostrado, interferencia de 60 Hz y saturación en algunas ventanas. Eso no valida precisión clínica ni sincronización de canales.
- El indicador de movimiento es una aproximación en g; no tiene separación vectorial filtrada de gravedad ni calibración.

## Pendientes confirmados
1. Medir y optimizar rendimiento con EEG real, con y sin grabación. Suspender dibujo fuera de la pantalla y reducir asignaciones en rutas frecuentes.
2. Sincronizar filas y tiempos del CSV por índice de muestra. Actualmente se producen unas 1.024 filas/s, repitiendo valores de otros canales.
3. Integrar el módulo IndexedDB en el repositorio web y WebSink, con migración segura de sesiones. No basta cambiar el store de Zustand. IndexedDB también tiene cuotas y posibles errores.
4. Eliminar el fallback activo de localStorage que conserva solo metadatos; puede perder las muestras al recargar.
5. Serializar flush/stop, manejar errores y reconexiones, y limpiar suscripciones BLE.
6. Validar pulso y calidad EEG con referencia independiente y datos reales.
7. Probar build nativo, iPhone 8, consumo, bloqueo de pantalla y comportamiento en segundo plano.
8. Completar tipos estrictos en módulos que todavía usan any.

## Matriz de validación

| Comprobación | Qué demuestra | Qué no demuestra |
|---|---|---|
| TypeScript | Coherencia de los tipos declarados | Ausencia de errores físicos o de ejecución |
| Jest | Casos sintéticos y almacenamiento simulado cubiertos | Precisión con Muse o persistencia IndexedDB real |
| Exportación web | Que se genera el bundle | Fluidez ni funcionamiento nativo |
| Capturas/CSV reales aportados | Recepción real y problemas observados | Precisión del pulso ni funcionamiento completo |
| Prueba física pendiente | Conexión, señal, exportación y reconexión en el dispositivo | Validación clínica |

Para conocer detalles de la revisión anterior, ver [CODE-REVIEW.md](CODE-REVIEW.md). No declarar terminado un pendiente porque exista un archivo o pase la compilación.
