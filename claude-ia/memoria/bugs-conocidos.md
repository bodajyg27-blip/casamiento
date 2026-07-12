# Bugs / pendientes conocidos — Invitación de casamiento

## Resuelto — Divergencia git local/remoto

`main` local y `origin/main` (`bodajyg27-blip/casamiento`) divergieron varias veces durante el 2026-07-10/11 porque alguien seguía editando una copia de la invitación directo en GitHub (raíz del repo: `index.html`, `invitacion/index.html`, `.github/workflows/static.yml`) mientras se trabajaba local en `documentos/`. Se resolvió con merges sucesivos (sin conflictos reales, porque las rutas tocadas por cada lado no se superponían) y quedó todo sincronizado. Ver la decisión de consolidar el trabajo en los archivos de la raíz en [[decisiones-tecnicas]].

## Pendiente — Foto real de la pareja

La portada ahora es una imagen (`img/TARJETA.jpg`) en vez de texto+SVG, así que este pendiente **ya no aplica** de la misma forma — si en el futuro se quiere una foto real de la pareja en vez del diseño actual de la tarjeta, habría que pedirle al usuario que genere/edite una nueva imagen equivalente (no una foto suelta a insertar en un placeholder, porque ese placeholder ya no existe).

## Resuelto — Ajuste de tipografía y colores por sección con imágenes de referencia

El usuario fue pasando imágenes de referencia y se fueron reemplazando secciones enteras (portada, calendario, lugar) e incorporando fondo con textura + tipografía real (Edwardian Script ITC) en el resto. Ver [[desarrollos]] para el detalle completo. Sigue siendo un proceso abierto/iterativo — cualquier ajuste nuevo de este tipo va en **ambos** `index.html` e `invitacion/index.html` (raíz).

## Pendiente — Redeploy de Apps Script tras cada cambio en AppsScript_RSVP.gs

Cada vez que se edita `documentos/AppsScript_RSVP.gs`, el usuario tiene que pegar el código actualizado en el editor de Apps Script y hacer un nuevo **Deploy** (Manage deployments → editar → New version) para que el cambio tome efecto en el `GAS_URL` real. Si se agrega código que usa un servicio nuevo (ej. `DriveApp` cuando antes solo se usaba `SpreadsheetApp`), además hay que **re-autorizar permisos manualmente** — Apps Script no vuelve a pedir autorización solo porque el código cambió; hay que correr la función nueva manualmente una vez desde el editor (o revocar el acceso previo en myaccount.google.com/permissions y volver a autorizar) para que el popup de permisos aparezca.

## Abierto — Archivos congelados que no reciben más cambios

Estos archivos quedaron fuera del flujo de trabajo activo y no se tocan más (ver [[decisiones-tecnicas]]):
- `documentos/invitacion_casamiento.html` — congelado desde 2026-07-10.
- `documentos/index.html` y `documentos/invitacion/index.html` — congelados desde 2026-07-11 (el trabajo se mudó a los archivos homónimos de la **raíz** del repo).

Si alguien los abre esperando ver el estado actual del proyecto, va a ver algo desactualizado. Antes de tocar cualquier `index.html` del proyecto, confirmar que sea el de la raíz.
