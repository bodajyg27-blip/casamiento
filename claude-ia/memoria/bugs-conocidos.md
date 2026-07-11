# Bugs / pendientes conocidos — Invitación de casamiento

## Resuelto — Divergencia git local/remoto

`main` local y `origin/main` (`bodajyg27-blip/casamiento`) divergieron varias veces durante el 2026-07-10/11 porque alguien seguía editando una copia de la invitación directo en GitHub (raíz del repo: `index.html`, `invitacion/index.html`, `.github/workflows/static.yml`) mientras se trabajaba local en `documentos/`. Se resolvió con merges sucesivos (sin conflictos reales, porque las rutas tocadas por cada lado no se superponían) y quedó todo sincronizado. Ver la decisión de consolidar el trabajo en los archivos de la raíz en [[decisiones-tecnicas]].

## Pendiente — Foto real de la pareja

La portada ahora es una imagen (`img/TARJETA.jpg`) en vez de texto+SVG, así que este pendiente **ya no aplica** de la misma forma — si en el futuro se quiere una foto real de la pareja en vez del diseño actual de la tarjeta, habría que pedirle al usuario que genere/edite una nueva imagen equivalente (no una foto suelta a insertar en un placeholder, porque ese placeholder ya no existe).

## Pendiente — Ajuste de tipografía y colores por sección con imágenes de referencia

El usuario sigue pasando imágenes de referencia para ajustar secciones (la portada ya se resolvió reemplazándola por imagen directa — ver [[desarrollos]]). Cuando lleguen imágenes para otras secciones: aplicar los cambios en **ambos** `index.html` e `invitacion/index.html` (los de la **raíz** del repo, no los de `documentos/` — ver [[decisiones-tecnicas]]) salvo que se indique lo contrario, y documentar cada ajuste en [[desarrollos]] / [[decisiones-tecnicas]] a medida que se confirme con el usuario.

## Abierto — Archivos congelados que no reciben más cambios

Estos archivos quedaron fuera del flujo de trabajo activo y no se tocan más (ver [[decisiones-tecnicas]]):
- `documentos/invitacion_casamiento.html` — congelado desde 2026-07-10.
- `documentos/index.html` y `documentos/invitacion/index.html` — congelados desde 2026-07-11 (el trabajo se mudó a los archivos homónimos de la **raíz** del repo).

Si alguien los abre esperando ver el estado actual del proyecto, va a ver algo desactualizado. Antes de tocar cualquier `index.html` del proyecto, confirmar que sea el de la raíz.
