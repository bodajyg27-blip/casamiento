# Arquitectura — Invitación de casamiento

## Qué es

Invitación web estática de casamiento (Julieta & Gabriel, 23/10/2027) con sobre de apertura a pantalla completa, cuenta regresiva en vivo, calendario de la fecha, RSVP, sugerencia de canciones y datos de regalo, pensada para hostear en GitHub Pages. Paleta general: verde oliva (ver [[decisiones-tecnicas]]).

## Archivos

- `documentos/index.html` — **archivo de trabajo principal**. HTML + CSS + JS inline, todo en un solo archivo. Sin la sección de método de pago. Es el que sirve GitHub Pages por defecto.
- `documentos/invitacion/index.html` — **segunda variante de trabajo**, copia de `index.html` que sí incluye la sección "Nuestro regalo de bodas" con el alias/CBU. Cualquier cambio de diseño/estructura se replica en ambos (ver [[decisiones-tecnicas]]).
- `documentos/invitacion_casamiento.html` — versión histórica, congelada desde el 2026-07-10, ya no se edita ni recibe los cambios posteriores (ver [[bugs-conocidos]]).
- `documentos/AppsScript_RSVP.gs` — backend en Google Apps Script, deployado como Web App, respaldado por un Google Sheet con dos pestañas: "Invitados" y "Canciones". No se redeploya solo — cualquier cambio acá requiere que el usuario vuelva a hacer "Deploy" en el editor de Apps Script.

## Backend (Google Apps Script)

- `doGet`: `?tipo=canciones` devuelve las canciones; sin parámetro devuelve la lista de invitados (`{ nombre, confirmado }`).
- `doPost`: `{ tipo: "cancion", cancion }` agrega una canción (recortada a 50 caracteres en el servidor); cualquier otro body confirma asistencia (`{ nombre, restricciones, detalle }`), pero **solo si el nombre ya existe en la planilla de Invitados**.
- La URL del Web App vive hardcodeada en `GAS_URL` dentro del `<script>` de cada `index.html` (repetida en ambos archivos). Es visible en la pestaña Network del navegador de cualquiera que use la página — ver [[decisiones-tecnicas]] sobre por qué no se oculta.

## Interacción / UX de cada `index.html`

1. **Sobre de apertura** (`#envelope`): overlay fijo a pantalla completa, bloquea el scroll hasta el click. Al abrir, el panel superior se desliza hacia arriba y el sello se desvanece (ver [[desarrollos]]).
2. **Portada**: "Nos casamos" + nombres ("Julieta & Gabriel") + descripción + placeholder de foto (SVG de anillos, pendiente de reemplazo — ver [[bugs-conocidos]]).
3. **Guardá la fecha**: calendario de octubre 2027 (día 23 resaltado) + hora + cuenta regresiva en vivo (días/horas/min/seg).
4. **Dónde celebramos**: dirección + mapa de Google embebido.
5. **Confirmar asistencia (RSVP)**: busca contra `guestList` (cargada de la planilla), muestra restricciones alimentarias.
6. **Dejá tu canción**: lista visible guardada en `sessionStorage` (por pestaña, ver [[decisiones-tecnicas]]), envío real al Sheet vía POST.
7. **Nuestro regalo de bodas** — **solo en `invitacion/index.html`**, al final antes del footer.

## Repo remoto

- `origin` → `https://github.com/bodajyg27-blip/casamiento.git`
- Identidad git local del proyecto: `bodajyg27 <bodajyg27@gmail.com>` (no la global de la máquina, que es Gabriel Oros).
- Divergencia local/remoto sin resolver — ver [[bugs-conocidos]].
