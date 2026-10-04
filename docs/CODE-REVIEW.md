# Revisión del código — 4 de octubre de 2026

El commit conserva el rediseño existente e integra las correcciones de Muse 2 (preset PPG, decodificación, periodicidad del pulso, filtro visual, calidad EEG y borrado web). No certifica producción ni precisión clínica.

Correcciones de esta revisión:
- QuietIndicator usa g y magnitud independiente de orientación; distingue falta de datos. Sigue siendo un indicador aproximado, sin separación vectorial filtrada de gravedad ni calibración.
- M1/M2/M3 guardan etiquetas distintas.
- Conteo final de filas conserva el total escrito; las pruebas del grabador ahora adquieren muestras, cierran un sink real inyectado y verifican marcadores/desuscripción.
- Archivos nativos importan expo-file-system/legacy y exportan las partes sin duplicar la cabecera.
- Desconectar el simulador detiene/guarda primero la grabación.
- El reset del store conserva el historial de grabaciones al desconectar.
- Añadidos npm test y npm run typecheck.

Pendientes confirmados:
1. Rendimiento real: no hay mediciones antes/después ni optimización completa. Se siguen creando objetos por muestra, arrays en DSP y paths por frame. Las pantallas no suspenden el dibujo según foco.
2. CSV: aún genera una fila por muestra de cada canal con valores retenidos de los demás. Falta sincronizar por secuencia/índice y timestamps de muestreo. No contar el incremento de un índice local como implementación de esa sincronización.
3. IndexedDB: el módulo existe pero no está conectado al repositorio activo ni al WebSink. Falta migración, manejo de todos los errores/abortos y pruebas de persistencia real.
4. El guardado activo sigue usando localStorage y conserva un fallback peligroso a solo metadatos al agotar cuota. Exportar las sesiones importantes antes de recargar; el borrado ya no usa ese fallback. No afirmar resuelta la persistencia grande.
5. Falta serializar flush y stop, gestionar errores/reintentos y proteger llamadas simultáneas al grabador. Evitar sobrescribir sesiones si coincide un id.
6. Falta limpiar suscripciones BLE y manejar desconexión inesperada web/ciclo de vida móvil. Las reconexiones requieren pruebas con hardware.
7. Persisten tipos any en módulos anteriores, particularmente Skia/BLE; que TypeScript pase no implica cumplimiento completo de la regla no-any.
8. El pulso y los umbrales de calidad siguen siendo estimaciones experimentales. Confirmar con referencia real; no suavizar RAW para esconder interferencia.
9. Falta probar build nativo, iPhone 8, rendimiento/consumo, batería y grabación con pantalla bloqueada. La exportación web no valida esos casos.

Verificación de esta revisión: TypeScript, 64 pruebas de 9 suites y exportación web. Las pruebas no sustituyen la validación física. Los launchers/rutas personales de Claude y los adjuntos del usuario quedan fuera del commit.
