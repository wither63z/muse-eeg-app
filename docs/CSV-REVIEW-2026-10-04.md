# CSV real y borrado web

Se analizó el adjunto sin modificarlo: 22,26 MB, 96.576 filas, unos 94,23 segundos. Aproximadamente 1.025 filas/s, no 256 filas sincronizadas/s. El recorder escribe una fila por cada muestra de cada canal y repite la última lectura de los otros canales. 94,1 % de las filas tienen la misma marca de tiempo que la anterior. Los tiempos de recepción BLE se repiten en todas las muestras de un paquete; no son timestamps de muestreo precisos.

Las capturas muestran interferencia de red estimada de 94 % en TP9 y 82 % en AF7, frente a 3 % en AF8 y 44 % en TP10, sin saturación en esa ventana. El archivo completo contiene valores en los raíles ADC (−1000 y +999,512 µV) en TP9, AF7 y TP10: hubo saturación en otras ventanas. El pulso no está incluido en el CSV.

Una reconstrucción aproximada, reteniendo cambios de cada columna RAW y suponiendo 256 Hz, tiene pico dominante de 60 Hz en los cuatro canales al inicio. No es una reconstrucción exacta: pierde muestras consecutivas idénticas y no prueba sincronización entre canales. No comparar sus porcentajes con la captura de otra ventana como si fueran la misma medición. Detalles: CSV-ANALYSIS-2026-10-04.json.

Borrado: React Native Web implementa Alert.alert como función vacía. RecordingRow ahora confirma con window.confirm en web y conserva Alert nativo. Espera la operación, evita repetición y muestra errores. El repositorio persiste la eliminación antes de mutar memoria y no usa el fallback que descarta datos de otras sesiones. Pruebas verifican persistencia tras recargar y conservación si falla almacenamiento. No se borraron sesiones reales durante el arreglo.

Pendiente que Claude coordine en su trabajo de grabación:
- Filas sincronizadas por índice de muestra y timestamps reales derivados de secuencia/frecuencia. No decimar a ciegas ni quitar datos para reducir tamaño.
- IndexedDB para sesiones grandes: el fallback actual de saveToStorage guarda solo metadatos cuando se llena localStorage y puede perder CSV al recargar. Ese problema de guardado sigue pendiente; aquí se corrigió solo el borrado sin sobrescribir su arreglo concurrente.
- Separar exportación RAW completa de resumen opcional; el tamaño completo es normal para datos de alta frecuencia, pero la repetición actual es evitable.
- Para interferencia: comparar diadema colocada igual en app oficial, probar lejos de fuentes eléctricas y con el portátil desenchufado. No conectar electrodos a tierra ni improvisar modificaciones físicas. Si se introduce notch de 60 Hz, hacerlo opcional en visualización y preservar RAW y diagnóstico de calidad.
