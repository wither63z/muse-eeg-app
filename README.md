# Muse Open Monitor

[![Comprobaciones](https://github.com/wither63z/muse-eeg-app/actions/workflows/verify.yml/badge.svg)](https://github.com/wither63z/muse-eeg-app/actions/workflows/verify.yml)

Monitor **gratuito y de código abierto** para leer señales de una **Muse 2**.
Permite ver EEG crudo, potencia por bandas, batería, PPG óptico y movimiento;
grabar muestras y exportarlas a CSV para analizarlas con tus propias herramientas.
No requiere cuenta ni suscripción. La diadema y el equipo no están incluidos.

Proyecto independiente: **no es la app oficial de Muse**, no está afiliado a
InteraXon ni reproduce sus meditaciones, algoritmos propietarios o contenido.
No es un producto médico ni interpreta diagnósticos, emociones o estados mentales.

## Dónde funciona

| Equipo | Opción | Limitación |
|---|---|---|
| PC Windows/macOS | Navegador Chromium compatible con Web Bluetooth | Bluetooth BLE y HTTPS o localhost. |
| Android | Chrome compatible o compilación nativa | La diadema debe estar libre de otras aplicaciones. |
| iPhone/iPad | Compilación nativa iOS | No se promete conexión desde Safari. Requiere macOS/Xcode y firma para instalar. |
| Linux | Navegador con Web Bluetooth habilitado | Depende del navegador, BlueZ y los permisos; no se garantiza soporte universal. |

Las pruebas automáticas usan paquetes y dispositivos simulados. Compilar web y
aprobar pruebas **no verifica una diadema física ni una compilación Android/iOS**.
No se adjunta por ahora un APK, aplicación de escritorio o aplicación iOS firmada.
Expo Go no incluye los módulos nativos Bluetooth/Skia: para móvil nativo hay que
compilar. [Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth)
y [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) explican los requisitos.

## Ejecutar en el PC o desarrollar

Necesitas Node compatible con Expo SDK 57 y Bluetooth BLE para datos reales.

```sh
git clone https://github.com/wither63z/muse-eeg-app.git
cd muse-eeg-app
npm ci
npm run web
```

Abre el enlace local mostrado por Expo. Para publicarla como web estática:

```sh
npm run build:web
```

Publica el contenido de `dist/` en un alojamiento HTTPS. El Bluetooth se conecta
desde el equipo del usuario, no desde un servidor remoto. Una página abierta
mediante una IP HTTP de la red local no sustituye HTTPS.

## Usar

1. Enciende Muse y desconéctala de otras apps.
2. En **Conexión**, pulsa **Buscar Muse**, elige la diadema y selecciónala en la lista.
3. Espera datos nuevos de **los cuatro canales**. Seleccionar un dispositivo no
   basta para declarar que está transmitiendo.
4. Si prefieres EEG/IMU sin PPG, activa **Solo EEG, sin pulso** antes de conectar.
   Si el perfil con PPG no inicia los cuatro canales, se intenta el perfil EEG.
5. En **EEG**, ajusta escala y ventana; pausar el dibujo no detiene la adquisición.
   El filtro visual es opcional y no cambia las muestras grabadas.
6. En **Grabaciones**, inicia/detén, añade M1/M2/M3 y exporta el CSV. El simulador
   sirve para explorar la interfaz y sus muestras llevan `source=simulation`.
7. Exporta antes de cerrar o limpiar almacenamiento. Las sesiones tienen un límite
   de 20 minutos; en web se acumulan en memoria hasta guardarse. Sesiones largas
   y exportaciones grandes requieren memoria y espacio suficientes.

La conexión se vigila: un canal detenido deja de mostrarse como transmisión
correcta. Vuelve a conectar para abrir una adquisición nueva. No se reanuda una
grabación anterior silenciosamente.

## Datos y límites

EEG: TP9, AF7, AF8 y TP10, frecuencia nominal 256 Hz. El CSV **raw-v2** contiene
una fila por muestra recibida: UTC, tiempo monotónico de recepción, época,
procedencia, flujo/canal, secuencia, índice dentro del paquete, valor/ejes,
unidad, indicadores de duplicado/atraso, huecos observables, identificador de
grabación y marcador.
Las muestras del mismo paquete comparten hora de recepción: no es el tiempo de
medición del sensor ni prueba sincronización física entre canales.

Se conservan notificaciones duplicadas o atrasadas con indicadores; no se
rellenan paquetes perdidos con ceros ni muestras repetidas. El visor corta el
trazo ante huecos; estos no se convierten en datos. La ventana del visor se basa
en cantidades nominales de muestras recibidas; el corte no reconstruye la
duración física exacta de lo perdido. Los reinicios de secuencia
no pueden distinguirse siempre de paquetes atrasados: reconectar crea otra época.
La detección de duplicados EEG compara secuencias consecutivas; datos atrasados
se marcan aparte, sin afirmar una clasificación universal de reinicios.

PPG se exporta en cuentas ADC; acelerómetro en g y giroscopio en grados/s. El
pulso mostrado es una **estimación**, puede quedar sin dato y no está validado
contra un instrumento médico. Calidad EEG es una heurística, no impedancia
medida ni garantía de señal limpia. Bandas son cálculos descriptivos, no un
indicador de una condición. Con falta de ventana completa no se presenta potencia.

Las exportaciones antiguas de columnas anchas se conservan al migrar. La nueva
grabación no arrastra valores anteriores de otros canales para aparentar una
muestra simultánea. `csvFormat.ts` conserva utilidades históricas para quien
necesite adaptar datos; no se afirma compatibilidad certificada con Mind Monitor.

## Privacidad y almacenamiento

No hay backend propio, cuentas, pacientes, análisis clínico ni subida de señales.
El Bluetooth y los datos se procesan localmente. En web, las grabaciones finalizadas
se guardan en **IndexedDB**; el navegador puede imponer cuotas o borrar datos.
En móvil se guardan en archivos privados de la aplicación. Al compartir/exportar,
tú eliges dónde enviar el archivo; EEG y otros registros pueden ser sensibles.
El alojamiento web puede registrar accesos normales, aunque esta app no le envíe
las muestras. No es una copia de seguridad ni una certificación de privacidad.

La migración de `localStorage` preserva el origen y no sobrescribe IDs existentes.
Eliminar borra la sesión de IndexedDB y su copia de origen seleccionada, sin
borrar otras sesiones. Si un error antiguo guardó solo metadatos, las muestras
que faltan no pueden reconstruirse. Los fallos de almacenamiento no se presentan
como guardado correcto: conserva la página y revisa el aviso.

## Compilar para móvil

```sh
npx expo prebuild
npm run android
# Solo en macOS con Xcode:
npm run ios
```

Instala las herramientas Android/iOS y concede Bluetooth; en Android antiguo
puede solicitar ubicación como requisito del sistema para BLE. Los directorios
nativos se generan desde `app.json`, no se mantienen a mano. La distribución en
tiendas y la firma son procesos separados; este repositorio no cobra por el código.

## Modificar y comprobar

```sh
npm run check:public
npm run typecheck
npm test -- --runInBand
npm run build:web
npx playwright install chromium
npm run test:web
```

- `ble/`: transportes web/nativo, comandos y decodificación de paquetes.
- `dsp/`: buffers crudos, cálculos descriptivos y preparación del dibujo.
- `recording/`: CSV, archivos nativos y almacenamiento IndexedDB.
- `store/`: solo estado lento; las muestras EEG permanecen fuera de React.
- `app/`, `components/`: pantallas y controles.
- `__tests__/`: regresiones con fixtures; `scripts/test-web.cjs`: prueba de navegador.

Las escalas, bandas y frecuencia de red (50/60 Hz) se ajustan en
`constants/muse.ts`; el perfil de conexión no cambia los crudos ya recibidos.
Para añadir dependencias compatibles, usa `npx expo install <paquete>`.
Mantén crudos y visualización separados, conserva ausencias y no conviertas
pruebas sintéticas en resultados físicos. No subas grabaciones, credenciales ni
informes personales. Las dependencias/modelos instalados no pertenecen a Git.

## Licencia

[MIT](LICENSE): puedes usar, estudiar, modificar y distribuir el código, sin
suscripción. Conserva los avisos de autoría/licencia. Las bibliotecas de terceros
mantienen sus propias licencias; se conserva el aviso original del template Expo.
El permiso no concede derechos sobre marcas, hardware o software propietario de Muse.


## Estado de seguridad de dependencias

La auditoría del 23 de octubre de 2026 señaló 11 avisos transitivos (5 altos y 6
moderados) en el stack Expo/router/herramientas, incluidos node-forge, Zod y
paquetes de análisis de URL. No se declara que estén resueltos ni que esta app
esté certificada. Ejecuta `npm audit` para revisar el estado de tu instalación.
No uses `npm audit fix --force` sin evaluar compatibilidad: el resultado observado
proponía incluso Expo 44 para un proyecto SDK 57. La publicación de este código
no equivale a una versión endurecida para datos clínicos o entornos de confianza
especial. Mantén el monitor en tu equipo y comparte registros deliberadamente.
