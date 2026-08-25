# Página "Dejar un mensaje" — configuración

Página en `mensaje/index.html`: botón que enciende la cámara en un óvalo, graba
video+audio (MediaRecorder), muestra preview con opción de regrabar, y al enviar
sube el archivo a una carpeta de Google Drive.

Reutiliza el mismo Apps Script (`documentos/AppsScript_RSVP.gs`) y la misma
implementación web que ya usan `index.html`, `invitacion/` y `galeria/` — no hace
falta crear ni desplegar un script nuevo. Se agregó la rama `tipo: "mensaje"` en
`doPost` con la función `addMensaje`, que guarda el video en `MENSAJES_FOLDER_ID`.

## Carpeta de Drive

Carpeta destino: ID `1apKNUF3hWw8F4q-8EUd69j7gsSbD3YMJ`, cargado en
`MENSAJES_FOLDER_ID` dentro de `documentos/AppsScript_RSVP.gs`.

## Aplicar el cambio en Apps Script

El código de `documentos/AppsScript_RSVP.gs` es una copia local de referencia.
Para que el cambio funcione hay que reflejarlo también del lado de Google:

1. Abrir el proyecto en [script.google.com](https://script.google.com) (el que ya
   está desplegado con la URL que usan `index.html`/`galeria`/`invitacion`).
2. Reemplazar el contenido por el de `documentos/AppsScript_RSVP.gs` actualizado
   (agrega `MENSAJES_FOLDER_ID`, la rama `tipo === "mensaje"` en `doPost` y la
   función `addMensaje`).
3. Guardar (Ctrl/Cmd+S). **No hace falta crear una nueva implementación** ni
   generar otra URL: al guardar, la implementación web existente ya sirve el
   código actualizado (Apps Script Web Apps siempre corren la última versión
   guardada del proyecto).

## Modo kiosko en iPad (Acceso Guiado)

1. Ajustes → Accesibilidad → Acceso Guiado → activar, y fijar un código.
2. Agregar `mensaje/index.html` a la pantalla de inicio desde Safari
   (Compartir → Agregar a pantalla de inicio) para que abra sin la barra del navegador.
3. Abrir esa app y triple-click al botón lateral (o Inicio) para activar Acceso Guiado.
4. El iPad queda bloqueado en esa pantalla: no se puede minimizar, cambiar de app
   ni bloquear el dispositivo hasta ingresar el código y desactivarlo.

## Notas

- Grabación máxima: 180 segundos (corta sola por seguridad).
- Formato: `video/mp4` en Safari/iOS, `video/webm` en Chrome — se detecta automático.
- Si el invitado rechaza el permiso de cámara, se muestra un mensaje de error con
  botón para reintentar.
