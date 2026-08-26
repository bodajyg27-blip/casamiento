# Página "Dejar un mensaje" — configuración

Conjunto de páginas para que los invitados graben mensajes de video y para
verlos/administrarlos:

- `mensaje/index.html` — la ve el invitado: botón "Dejar un mensaje", enciende
  la cámara en un óvalo, graba video+audio (grabando en espejo, igual a como
  se ve en pantalla), preview con opción de regrabar, y al enviar sube el
  archivo a Google Drive. Grabación máxima: **30 segundos**.
- `mensaje/admin.html` — panel para ver y borrar los mensajes recibidos.
  Protegido por una clave numérica de 4 dígitos (estilo passcode), validada
  del lado del servidor contra un valor guardado en el Google Sheet (ver
  abajo) — no alcanza con conocer la URL para ver/borrar mensajes.
- `tv/index.html` — pantalla pensada para transmitir por Chromecast/AirPlay:
  slideshow de fotos + mensajes de video mezclados. Soporta `?modo=fotos` y
  `?modo=videos` para ver solo uno de los dos tipos.

Todo reutiliza el mismo Apps Script (`documentos/AppsScript_RSVP.gs`) y la
misma implementación web que ya usan `index.html`, `invitacion/` y
`galeria/` — no hace falta crear ni desplegar un script nuevo.

## Carpeta de Drive

Carpeta destino de los videos: ID `1apKNUF3hWw8F4q-8EUd69j7gsSbD3YMJ`,
cargado en `MENSAJES_FOLDER_ID` dentro de `documentos/AppsScript_RSVP.gs`.

## Clave del panel de administración (mensaje/admin.html)

La clave **no** está en el código — se guarda en el mismo Google Sheet que
usan Invitados/Canciones/Regalo, para que no quede visible mirando el
código fuente de la página. El servidor la exige solo para **borrar**
mensajes (`borrarMensaje`); listar y ver mensajes (`getMensajes`,
`getMensajeVideo`) son públicos a propósito, porque `tv/index.html`
también los necesita sin clave para mostrarlos en el slideshow — no tiene
sentido proteger algo que se muestra igual en la TV del salón.

1. En el Sheet, crear una pestaña nueva llamada exactamente **`Config`**.
2. Celda **A1**: `ClaveAdmin`. Celda **B1**: el código de 4 dígitos que se
   quiera usar (sin comillas).
3. Para cambiar la clave más adelante, alcanza con editar el valor de B1 —
   no hace falta tocar código ni redesplegar nada.

Si la pestaña `Config` no existe o la fila `ClaveAdmin` está vacía,
`claveValida()` siempre devuelve `false` y el panel queda inaccesible para
todos (comportamiento seguro por default, no "abierto por error").

## Aplicar cambios en Apps Script

El código de `documentos/AppsScript_RSVP.gs` es una copia local de referencia.
Para que un cambio funcione hay que reflejarlo también del lado de Google:

1. Abrir el proyecto en [script.google.com](https://script.google.com) (el que ya
   está desplegado con la URL que usan `index.html`/`galeria`/`invitacion`).
2. Reemplazar todo el contenido por el de `documentos/AppsScript_RSVP.gs` actualizado.
3. Guardar (Ctrl/Cmd+S). **No hace falta crear una nueva implementación** ni
   generar otra URL: al guardar, la implementación web existente ya sirve el
   código actualizado (Apps Script Web Apps siempre corren la última versión
   guardada del proyecto) — siempre que quede **una sola implementación
   activa** (si en algún momento aparecen dos, hay que confirmar cuál es la
   que usan los archivos del sitio).

## Modo kiosko en iPad (Acceso Guiado)

1. Ajustes → Accesibilidad → Acceso Guiado → activar, y fijar un código.
2. Agregar `mensaje/index.html` a la pantalla de inicio desde Safari
   (Compartir → Agregar a pantalla de inicio) para que abra sin la barra del navegador.
3. Abrir esa app y triple-click al botón lateral (o Inicio) para activar Acceso Guiado.
4. El iPad queda bloqueado en esa pantalla: no se puede minimizar, cambiar de app
   ni bloquear el dispositivo hasta ingresar el código y desactivarlo.

## Pantalla de TV (tv/index.html)

Pensada para dejarse corriendo sola durante el evento, transmitida por
Chromecast/AirPlay desde un celu/tablet en la misma wifi:

- `tv/` — fotos y mensajes mezclados.
- `tv/?modo=fotos` — solo fotos.
- `tv/?modo=videos` — solo mensajes de video.

Hay que tocar la pantalla una vez ("Tocá para comenzar") para que el
navegador permita reproducir audio y active pantalla completa. Se actualiza
sola cada 2 minutos para traer contenido nuevo, y tiene un timeout +
"vigilante" de recuperación por si alguna descarga se cuelga por un bache
de wifi.

## Notas

- Grabación máxima: **30 segundos**, a 2.5 Mbps de video + 128 kbps de audio.
- Formato: prioriza `video/webm` (Chrome/Android), cae a `video/mp4` en
  Safari/iOS, que no soporta grabar en webm.
- El video se graba en espejo (igual a la vista en vivo) — ver la decisión
  técnica y cómo revertirla en `claude-ia/memoria/decisiones-tecnicas.md`.
- Si el invitado rechaza el permiso de cámara, o el micrófono está
  silenciado/interrumpido, se muestra un mensaje de error o advertencia.
- Los videos se guardan localmente (IndexedDB) antes de subirse y recién se
  borran de ahí cuando la subida se confirma — si no hay conexión, quedan
  en cola y se reintenta solo al reconectar.
