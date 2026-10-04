# Muse 2: correcciones de adquisición y osciloscopio

## Cambios
- Detectar la característica clásica infrarroja 273e0010 antes de seleccionar p50 (EEG + PPG). Sin ella se conserva p21; no se presupone soporte de Muse Athena.
- Decodificar paquetes PPG de 20 bytes: secuencia de 16 bits y seis valores unsigned de 24 bits. No rellenar muestras ficticias con cero.
- Usar intervalos de 64 Hz entre muestras ópticas; borrar BPM si no hay datos o picos recientes. El detector de picos sigue siendo una estimación sencilla, pendiente de validar con señal real.
- Reiniciar buffers y detector al iniciar otra adquisición. Corregir la primera secuencia EEG no nula y el cálculo de tasa efectiva (256 Hz por canal esperado).
- Filtrar únicamente la copia visual del EEG, de forma determinista, y recorrer toda la ventana al dibujar. No modificar los datos crudos para ocultar ruido.
- Usar fit por electrodo en el estado activo de las tarjetas, en vez de headbandOn para todos.

## Prueba real pendiente
1. Cerrar otras aplicaciones conectadas a la Muse. Recargar Muse Open Monitor, desconectar y volver a conectar (el preset se envía en la conexión).
2. Revisar consola: [Muse] PPG infrarrojo disponible; preset p50.
3. Confirmar: [Muse] Primer paquete PPG infrarrojo recibido: 6 muestras.
4. Si aparece el primero sin el segundo, comprobar comandos/firmware/transporte. Si no existe la característica, registrar modelo/firmware y servicios BLE; no inventar BPM.
5. Mantenerse quieto y esperar varios latidos. Comparar el BPM con una referencia independiente. No es una medición médica validada.
6. Revisar calidad de cada electrodo y tasa efectiva próxima a 256 Hz por canal. Canales presentes no implican buen contacto. Los artefactos por ojos, mandíbula, movimiento o contacto deben identificarse; no borrarse del dato crudo.

## Evidencia
TypeScript pasa y 47 pruebas pasan. Incluyen formato PPG completo, rechazo de paquetes truncados, estabilidad del filtro visual, secuencia EEG inicial, reinicio y una señal PPG sintética de 72 BPM. No hubo prueba de diadema física desde Codex.

Referencias de protocolo (implementación, no SDK del fabricante):
- https://github.com/urish/muse-js/blob/master/src/muse.ts
- https://github.com/urish/muse-js/blob/master/src/lib/muse-parse.ts

Siguen pendientes las mejoras generales de grabación y conexión móvil de la revisión previa. Este cambio no confirma esos flujos ni la precisión clínica del pulso.

## Segunda revisión: pulso alto y calidad EEG
El detector de máximos locales fue sustituido por estimación de periodicidad sobre 8 segundos a 64 Hz, con filtrado de línea base/ruido rápido y rechazo de ventanas planas, saturadas o no periódicas. No se impone un rango de reposo ni se fuerza un BPM normal. Paquetes duplicados se descartan; pérdida o discontinuidad PPG reinicia la ventana y oculta el BPM hasta reunir datos nuevos. Actualiza aproximadamente una vez por segundo.

Las categorías de calidad EEG ya no se muestran como porcentajes ficticios. En Estadísticas Avanzadas se indican motivo, sigma, proporción de interferencia de red y fracción saturada por canal. Se necesita revisar esos datos reales antes de cambiar los umbrales; no convertir una mala señal en buena por petición estética. Una muestra aislada cerca del raíl ADC ya no clasifica toda la ventana como saturada. Los umbrales son empíricos y no equivalen a impedancia ni al algoritmo de la app oficial.

El algoritmo nuevo pasa señales sintéticas de 45, 72, 90, 120 y 180 BPM, rechaza ruido broadband y resuelve una señal con pico secundario moderado. No está validado clínicamente y el movimiento periódico aún puede confundirse con pulso. Para comprobarlo usar una referencia independiente y una captura real.

LED: el fabricante describe emisores IR y rojo. La luz IR no es visible para el ojo humano. Que solo se vea una luz no confirma un fallo ni demuestra que todos los emisores estén activos. No se alteró la potencia de emisores ni se inventaron comandos de iluminación.
Fuentes:
- https://intl.choosemuse.com/pages/muse-s-muse-2-holiday-offers
- https://science.nasa.gov/ems/07_infraredwaves/

Validación adicional: 60 pruebas de 7 suites, pendiente validación con la misma diadema del usuario. Tras recargar/reconectar, esperar 10–15 segundos inmóvil y comparar. Si persiste, recoger diagnósticos EEG y un fragmento PPG real; no seguir cambiando umbrales sin evidencia.
