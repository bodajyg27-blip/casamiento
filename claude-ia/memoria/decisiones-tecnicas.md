# Decisiones técnicas — Invitación de casamiento

## El botón de cámara de la galería se oculta solo, el día después de la boda

**Decisión:** en `galeria/index.html`, el botón de cámara (`#cameraBtn`) se oculta con un chequeo client-side (`new Date() >= new Date(2027, 9, 24, 6, 0, 0)`) — mismo patrón que el cierre de RSVP/canciones en `familiar/`/`invitacion/`. Cuando se oculta, el botón de subir desde la galería del dispositivo (`#uploadBtn`) pasa a ocupar la posición principal (clase `.solo`) en vez de quedar un hueco vacío abajo. Ese botón **no** tiene fecha de corte — subir fotos ya sacadas sigue funcionando siempre.

**Por qué:** después de la boda no tiene sentido invitar a "sacá una foto ahora" (la noche ya pasó), pero sí puede haber fotos sueltas del evento que alguien quiera subir más tarde desde su rollo.

**Cómo aplicarlo:** igual que el resto de los cierres por fecha del sitio, es un chequeo del reloj del dispositivo del visitante, no algo validado en el servidor — mismo criterio de "bajo riesgo, sin incentivo adversarial" que RSVP/canciones.

## Cola offline para subir fotos de la galería (mismo patrón que los mensajes)

**Decisión:** `galeria/index.html` guarda cada foto en IndexedDB (`galeria-casamiento` / store `pendientes`) **antes** de subirla, y recién la borra de ahí cuando el servidor confirma `{success:true}`. Si no hay conexión al momento de sacar/elegir la foto, queda encolada localmente y se reintenta sola al reconectar (`online` event) o cada 30s (`setInterval`), igual que ya hacía `mensaje/index.html` con los videos.

**Por qué:** antes, si el `fetch` fallaba (sin internet), la foto se perdía directo — no había ningún resguardo. Con un evento en vivo (boda) donde el wifi/datos pueden cortarse en cualquier momento, perder la foto sin avisar es peor que hacer esperar la subida.

**Cómo aplicarlo:** a diferencia de `uploadRecord` de `mensaje/index.html` (que usa `mode:'no-cors'` y asume éxito porque no puede leer la respuesta), el de `galeria/index.html` sí lee `data.success` de la respuesta (el POST de fotos nunca tuvo problema de CORS) y solo borra el pendiente si el servidor confirmó — si en algún momento se le agrega `no-cors` a este POST por algún motivo, hay que volver a la lógica optimista (asumir éxito si el fetch no tira excepción de red), como en mensajes.

## Ocultar la galería: solo cambia qué se muestra, no bloquea nada del servidor

**Decisión:** el toggle "Fotos de la galería: Visibles/Ocultas" en `admin/` (Config → `GaleriaVisible`, `true`/`false`, default visible) solo controla si `galeria/index.html` muestra la grilla de fotos o el mensaje "Seguí compartiendo tu enfoque sobre esta noche, mañana se revelará cada recuerdo subido por nuestros invitados." El endpoint `getGaleria`/`getFotoBlob` sigue siendo público y sin cambios — no se le agregó ningún chequeo de `GaleriaVisible` del lado del servidor. Subir fotos (`addFoto`) tampoco se toca: los invitados pueden seguir sacando/subiendo fotos mientras están "ocultas", solo no las ven en pantalla hasta que alguien las vuelva a mostrar.

**Por qué:** ya pasó una vez que proteger de más un endpoint compartido rompió `tv/index.html` (ver [[bugs-conocidos]], regresión de la clave de admin) porque esa pantalla también consume `getMensajes`/`getMensajeVideo` sin clave. `tv/index.html` usa el mismo `getGaleria` para su slideshow de fotos — si se lo hubiera bloqueado cuando `GaleriaVisible = false`, la TV del salón se hubiera quedado sin fotos también, que no es lo que se pidió (el pedido era ocultar la vista de `galeria/index.html` para los invitados, no la de la TV).

**Cómo aplicarlo:** cualquier futuro "modo oculto"/toggle de visibilidad en este proyecto debería seguir el mismo patrón que `ModoIndex` y este: una bandera pública de solo lectura en `Config`, cuyo único efecto es qué arma cada página del lado del cliente — nunca condicionar del lado del servidor el acceso a datos que otra página (como `tv/`) también necesita sin clave.

## Botón de cámara en la galería: `<input capture>`, no acceso a la cámara vía JS

**Decisión:** en `galeria/index.html` el botón de "sacar foto" es un segundo `<input type="file" accept="image/*" capture="environment">` oculto (además del que ya existía para elegir de la galería), no una implementación con `getUserMedia`/`MediaRecorder` como la de `mensaje/index.html`.

**Por qué:** el pedido era que al tocar el botón se abra la app de cámara nativa del dispositivo (no una cámara embebida en la página) y que la foto tomada se suba sola. El atributo `capture` en un `<input type="file">` hace exactamente eso en Safari iOS y Chrome Android: abre la cámara del sistema directo, sin pedir permiso de `getUserMedia` ni mantener un stream de video abierto en la página. En desktop, donde `capture` no tiene efecto, cae solo al selector de archivos normal — degradación aceptable porque ahí no hay cámara "nativa" que abrir de todas formas.

**Cómo aplicarlo:** el input de cámara reusa la misma función de subida (`handleFiles`) que el input de galería — ambos terminan llamando al mismo POST `tipo: 'foto'` del Apps Script. Si en el futuro hace falta grabar/recortar antes de subir, ahí sí conviene mirar el patrón de `mensaje/index.html` (canvas + MediaRecorder), pero para una foto suelta el `<input capture>` es más simple y no requiere pedir permisos de cámara aparte.

## Formato de imagen: JPEG si no hay alpha real, WebP si lo hay

**Decisión:** para las imágenes de `img/`, se elige el formato según si la imagen tiene transparencia real (canal alpha usado) o no, no por costumbre/lo que venga del diseñador.
- Si la imagen es opaca (aunque el archivo original sea PNG), se convierte a JPEG — comprime mucho mejor para fotos/diseños con degradés.
- Si necesita transparencia real (ej. `alianzas.webp`, que se recorta sobre distintos fondos), se usa WebP, no PNG — WebP soporta alpha y comprime bastante mejor que PNG para el mismo contenido.
- Además, toda imagen se redimensiona al tamaño real en que se muestra en pantalla antes de exportarla (ej. `alianzas.webp` se bajó de 1844×2304 a 500×624 porque se muestra a 1.6em de alto) — no tiene sentido servir resolución de impresión para un ícono chico.

**Por qué:** `img/sobre.png` y `img/alianzas.png` pesaban 2.8M y 3.3M respectivamente sin necesidad — ninguna de las dos tenía razón real para ser tan pesada (una no tenía alpha, la otra se mostraba 4x más chica de lo que pesaba). Ver [[desarrollos]] para el detalle de la conversión.

**Cómo aplicarlo:** cualquier imagen nueva que se agregue al proyecto debería pasar por este mismo criterio antes de commitear — no subir un PNG de varios MB directo del diseñador sin evaluar si puede ser JPEG/WebP y si puede reducirse de tamaño. Herramienta usada: Pillow (`Image.save()`), no había `cwebp`/`pngquant` instalados en la máquina.

## sessionStorage (no localStorage) para las canciones

**Decisión:** la lista de canciones que ve cada invitado se guarda en `sessionStorage`, no en `localStorage` ni trayéndola del Google Sheet.

**Por qué:** el requerimiento era "que cada uno vea las canciones que agregó, pero que si abre otra pestaña no vea las que ya cargaron [otros, o él mismo en otra sesión]". `localStorage` se comparte entre todas las pestañas del mismo origen — no serviría. `sessionStorage` es exclusivo de cada pestaña (sobrevive a un refresh, pero no se comparte al abrir una pestaña nueva), que es exactamente el comportamiento pedido.

**Cómo aplicarlo:** si en el futuro se pide "que se vea una lista compartida de canciones para todos", hay que volver a traer los datos del Sheet (`GAS_URL + "?tipo=canciones"`) en vez de leer `sessionStorage` — son requerimientos opuestos, no compatibles al mismo tiempo sin un toggle explícito.

## No ofuscar `GAS_URL`

**Decisión:** no se implementó ofuscación/encriptación de la URL de Google Apps Script en el `<script>`.

**Por qué:** cualquier ofuscación en el código fuente es cosmética — en cuanto la página hace `fetch(GAS_URL)`, la URL real viaja tal cual y es visible en la pestaña Network del navegador. Ocultarla del código fuente no evita que alguien la extraiga ahí. La única forma de esconderla de verdad sería un proxy propio (servidor/función serverless intermedia), que no se justificó para este proyecto.

**Cómo aplicarlo:** la protección real contra spam se hizo del lado del servidor (Apps Script), no ocultando la URL — ver el límite de 50 caracteres en `addCancion()` y la validación de nombre existente en `confirmarInvitado()`.

## Límite de 50 caracteres por truncado, no por rechazo

**Decisión:** en `addCancion()` (AppsScript_RSVP.gs), el texto de la canción se recorta con `.slice(0, 50)` en vez de rechazar el request si excede el límite.

**Por qué:** pedido explícito del usuario ("aplica el punto 2 nomas pero a 50 caracteres"). Se replicó el mismo límite en el cliente (`maxlength="50"` en el input) para que la UI ya refleje la restricción antes de llegar al servidor.

## `fetch` a Apps Script con `mode: 'no-cors'` en mensaje/index.html

**Decisión:** el envío del video grabado a Drive (`mensaje/index.html` → `GAS_URL`) usa `fetch(GAS_URL, {method:'POST', mode:'no-cors', body: JSON.stringify(...)})`, sin leer la respuesta. El cliente muestra "Mensaje enviado" apenas el `fetch` resuelve sin tirar excepción, no en base a un `{ok:true}` del servidor.

**Por qué:** con `fetch` normal (sin `mode:'no-cors'`), Chrome bloqueaba la lectura de la respuesta del redirect que usa Apps Script para servir el resultado (`script.google.com/.../exec` → 302 → `script.googleusercontent.com/macros/echo?...`), aunque el request llegaba y se ejecutaba bien (confirmado con `curl` y viendo el archivo creado en Drive). Ver bug resuelto en [[bugs-conocidos]].

**Cómo aplicarlo:** cualquier otro `fetch` nuevo hacia `GAS_URL` que necesite un POST desde esta página va a tener el mismo problema. Si en el futuro hace falta leer la respuesta real (por ejemplo, para saber si `addMensaje` falló y mostrar un error específico), la alternativa es hacer que Apps Script escriba el resultado en otro lado (Sheet, o un archivo en Drive) y consultarlo aparte, no depender de leer el body del `fetch` original.

## `mimeType` de MediaRecorder: preferir webm/opus antes que mp4/aac (mensaje/index.html)

**Decisión:** `pickMimeType()` en `mensaje/index.html` prueba primero `video/webm;codecs=vp9,opus`, `vp8,opus` y `webm` a secas, y recién después `video/mp4;codecs=h264,aac` / `video/mp4`.

**Por qué:** con `video/mp4;codecs=h264,aac` primero en la lista, Chrome en Mac elegía ese formato y el video grababa bien pero sin audio (bug de codificación de audio en esa combinación). `webm`+`opus` es la combinación más probada para audio+video simultáneo en navegadores Chromium. `mp4` se deja como último recurso para Safari/iOS, que no soporta grabar en `webm`.

**Cómo aplicarlo:** si en el futuro aparece un reporte de "video sin audio" en iPad/Safari, no alcanza con este orden (ahí sí va a usar `mp4`) — habría que investigar puntualmente si Safari tiene el mismo problema con `h264,aac`, es un caso no probado todavía.

## Grabar el video de "Dejanos tu mensaje" en espejo (mensaje/index.html)

**Decisión:** el video que se sube a Drive queda espejado (igual a como se ve en pantalla mientras el invitado se graba), en vez de la orientación real de la cámara. Se logra dibujando cada cuadro del `<video>` en vivo sobre un `<canvas>` invertido (`ctx.scale(-1, 1)` + `drawImage`) y grabando el stream de ese canvas (`canvas.captureStream(30)`) combinado con el audio original del micrófono, en vez de pasarle a `MediaRecorder` el `mediaStream` de la cámara directo.

**Por qué:** originalmente el espejo (`transform: scaleX(-1)`) era solo un efecto visual CSS en el `<video>` en vivo — no afecta lo que graba `MediaRecorder`, que siempre captura la orientación real de la cámara. Eso hacía que el preview (y el archivo final) se vieran "dados vuelta" respecto a lo que el invitado veía mientras grababa, un salto visual que pidieron sacar. Sacar el espejo del CSS del preview no alcanzaba porque el archivo real seguía sin espejo; hubo que espejar el contenido real grabado, no solo la vista en pantalla.

**Código relevante:** `obtenerStreamParaGrabar()` y `detenerEspejoCanvas()` en `mensaje/index.html`. Se llama a `obtenerStreamParaGrabar()` dentro de `startRecording()` en vez de pasar `mediaStream` directo a `new MediaRecorder(...)`.

**Cómo volver atrás:** si se pide revertir a grabar sin espejo (orientación real de cámara, como estaba en el commit `d7de69a` y anteriores), hay que:
1. En `startRecording()`, volver a `mediaRecorder = new MediaRecorder(mediaStream, options)` (sacar el `obtenerStreamParaGrabar()`).
2. Borrar las funciones `obtenerStreamParaGrabar()` y `detenerEspejoCanvas()`, y las llamadas a `detenerEspejoCanvas()` en `cancelRecording()` y `onRecordingStop()`.
3. Opcional: si además se quiere que el preview vuelva a mostrarse sin espejo (mostrando la orientación real), reagregar `.oval video.preview { transform: none; }` en el CSS (se sacó en el mismo cambio).

**Costo a tener en cuenta:** dibujar cada cuadro en un canvas vía `requestAnimationFrame` consume más CPU/batería que grabar directo desde la cámara. Para los 30 segundos máximos de grabación no debería notarse, pero es la primera sospecha si en algún momento se reporta que el iPad se calienta o se traba durante la grabación.

## Clave del panel de mensajes validada en el servidor, guardada en el Sheet (mensaje/admin.html)

**Decisión:** la clave de 4 dígitos para entrar a `mensaje/admin.html` ya no está hardcodeada en el HTML (`const CLAVE = "2358"`). Ahora vive en una pestaña `Config` del mismo Google Sheet (celda A1 `ClaveAdmin`, B1 el valor), y las funciones `getMensajes`, `getMensajeVideo` y `borrarMensaje` en `documentos/AppsScript_RSVP.gs` la exigen como parámetro (`clave`) y la validan del lado del servidor con `claveValida()` antes de devolver o borrar nada.

**Por qué:** antes, aunque la clave estuviera escondida, cualquiera que descubriera las URLs `?tipo=mensajes` / `?tipo=mensajeVideo&id=...` o el POST `tipo:"borrarMensaje"` podía ver o borrar mensajes sin conocerla — la clave solo gateaba la pantalla, no los datos. Ahora el servidor rechaza esas llamadas si no viene la clave correcta (`errorNoAutorizado()`), sea cual sea el camino por el que lleguen.

**Cómo funciona del lado del cliente:** `mensaje/admin.html` ya no compara el código tipeado contra una constante local — llama a `?tipo=mensajes&clave=XXXX` y si la respuesta es un array (no `{error:...}`), la clave es correcta. La clave que funcionó se guarda en `sessionStorage` (`mensajes-admin-clave`) y se manda en cada pedido posterior (listar, ver video, borrar). Si el servidor la rechaza en algún momento (por ejemplo, porque alguien cambió el valor en el Sheet), se limpia el `sessionStorage` y vuelve a pedir la clave.

**Cómo aplicarlo:** si en el futuro se agrega otra acción de admin (por ejemplo, descargar todos los mensajes de una), hay que sumarle el mismo chequeo `claveValida()` en el `doGet`/`doPost` del Apps Script — no alcanza con que la pantalla pida la clave, cada endpoint sensible tiene que validarla por su cuenta.

## Probado y descartado: `doGet` no puede devolver un Blob binario crudo

**Intento:** para achicar el peso de fotos/videos servidos (evitar el ~33% extra de base64 + el parseo de JSON gigante), se probó cambiar `getFotoBlob`/`getMensajeBlob` para que `doGet` devolviera directamente `DriveApp.getFileById(id).getBlob()` en vez de `ContentService.createTextOutput(JSON.stringify({mimeType, data: base64}))`.

**Resultado:** falla. Apps Script devuelve una página de error genérica: *"La secuencia de comandos se completó pero el valor que muestra no es un valor de retorno admitido."* Confirmado probando en producción con `curl` contra el deployment real — `doGet`/`doPost` solo aceptan devolver `TextOutput` o `HtmlOutput`, nunca un `Blob` crudo, pese a que hay ejemplos dando vueltas por internet que sugieren que sí se puede (puede haber cambiado, o depender de la versión del runtime).

**No volver a intentarlo** sin antes buscar si existe otra vía (por ejemplo, subir los archivos a una carpeta con permisos de "cualquiera con el link" y devolver la URL directa de Drive en vez de servir el contenido a través del script — cambia el modelo de privacidad, así que no es un reemplazo directo).

## `index.html` pasa a ser una puerta de entrada que reparte por tipo de invitado

**Decisión:** `index.html` (raíz) dejó de ser una invitación completa. Ahora es una página mínima: sobre de apertura + buscador de nombre. Al elegir un nombre, redirige a `familiar/index.html` o `invitacion/index.html` según una columna nueva `Tipo` (`Familiar`/`Invitado`) en la hoja "Invitados" del Sheet (columna **G**, índice 6 — la F quedó sin uso). El contenido que antes tenía `index.html` (todas las secciones) se movió tal cual a `familiar/index.html`, ajustando las rutas relativas a `../`.

**Por qué:** el usuario quería mostrarle a la familia una invitación sin la sección de regalo (`familiar/`) y al resto de los invitados la versión completa (`invitacion/`), sin que cada uno tenga que saber a qué link entrar — se busca el nombre una sola vez en la puerta de entrada y el sistema decide.

**Cómo aplicarlo:** `familiar/index.html` e `invitacion/index.html` deben mantenerse **parejas** en todo lo que no sea la sección de regalo — cualquier sección nueva (carrusel, itinerario, dress code, etc.) se agrega a las dos. Si `Tipo` viene vacío o con un valor no reconocido, `index.html` manda por default a `invitacion/` (la variante completa), no a `familiar/`.

**Sobre repetido:** como el sobre ya se abre una vez en `index.html`, se sacó de `familiar/` e `invitacion/` (antes cada una tenía el suyo) — al llegar ahí se ve el contenido directo, sin un segundo sobre.

## Modo de `index.html`: Invitación / Save the Date / Galería, vía Config

**Decisión:** además de la puerta de entrada normal, `index.html` puede mostrar otras dos cosas según una fila `ModoIndex` en la pestaña `Config` del Sheet (mismo patrón que `ClaveAdmin`): un video de "Save the date" a pantalla completa (con toque para reproducir, igual patrón que `tv/index.html`), o una redirección directa a `galeria/index.html`. Se cambia desde `admin/` (switch de tres botones), sin tocar código. `getModoIndex()`/`setModoIndex()` en el Apps Script leen/escriben ese valor; `setModoIndex` exige la clave admin, `getModoIndex` es público (lo necesita `index.html` sin login).

**Por qué:** pensado para las distintas etapas del sitio — antes de mandar las invitaciones (save the date), durante (invitación normal) y la noche después de la boda (galería, para que los invitados suban/vean fotos fácil desde el link que ya tienen guardado).

**Cómo aplicarlo:** el video de Save the Date sale del primer archivo que encuentre en `SAVETHEDATE_FOLDER_ID` (`getSaveTheDate()`) — si se quiere cambiar el video, alcanza con reemplazar el archivo en esa carpeta de Drive, no hace falta tocar nada más.

## Carrusel "Nuestra historia": carpeta propia + orden por nombre + precarga en sessionStorage

**Decisión:** el carrusel de fotos que aparece en `familiar/` e `invitacion/` usa una carpeta de Drive dedicada (`CARRUSEL_FOLDER_ID`, distinta de la galería de invitados), ordenada por **nombre de archivo** (no por fecha, a diferencia de `getGaleria()`) para que la pareja controle el orden nombrando `1.jpg`, `2.jpg`, etc. `index.html` precarga en segundo plano todas las fotos del carrusel (lista + cada base64) mientras el invitado abre el sobre y busca su nombre, y las deja en `sessionStorage` (clave `carruselCache`, con timestamp, vence a los 5 minutos). `familiar/`/`invitacion/` leen esa caché antes de pedir cada foto de nuevo.

**Por qué:** como el carrusel es idéntico en las dos variantes de invitación y el usuario siempre pasa por `index.html` antes de llegar a cualquiera de las dos, tiene sentido aprovechar ese tiempo (mientras busca su nombre) para bajar las fotos, en vez de que la persona vea el shimmer de carga recién al llegar a destino. `sessionStorage` sobrevive la navegación entre páginas (a diferencia de una variable JS), que es justo lo que se necesita acá.

**Cómo aplicarlo:** si se agrega un cuarto lugar donde se muestre este mismo carrusel, hay que replicar tanto `loadCarrusel()`/`loadCarruselFoto()` (con el chequeo de caché) como, idealmente, la precarga en `index.html` para que la caché exista quien sea que llegue primero.

## Cierre automático de RSVP y sugerencia de canciones, 15 días antes de la boda

**Decisión:** las secciones "Confirmar asistencia" y "Dejá tu canción" en `familiar/` e `invitacion/` se ocultan solas a partir del 8 de octubre de 2027 (15 días antes de la boda, 23/10/2027), reemplazadas por un cartel de "el plazo ya cerró". El chequeo (`chequearPlazoRSVP()` / `chequearPlazoCanciones()`) compara `new Date()` contra la fecha de corte calculada en JS, usando el **reloj del dispositivo del visitante** — no hay validación en el servidor.

**Por qué:** pedido explícito para no seguir recibiendo confirmaciones/canciones tan cerca de la boda, por la logística de catering/playlist. Al ser una fecha fija conocida de antemano (no depende de datos externos), no se justificó agregar esta lógica al backend — el peor caso de que alguien manipule el reloj de su dispositivo para confirmar tarde no tiene ningún incentivo real detrás.

**Cómo aplicarlo:** si se cambia la fecha de la boda, hay que actualizar `fechaBoda` en **cuatro** lugares de cada archivo (`renderCountdown`, `chequearPlazoRSVP`, `chequearPlazoCanciones`) — no está centralizado en una sola constante.

## Botón "Volver" de la galería usa el historial del navegador, no un link fijo

**Decisión:** en `galeria/index.html`, el botón de volver ya no apunta siempre a `../index.html`. Ahora, si `document.referrer` es del mismo origen y hay historial de navegación (`history.length > 1`), usa `history.back()` para volver exactamente a la página desde la que se entró (`familiar/` o `invitacion/`); si no (URL pegada directo, o vino de otro sitio), cae al link fijo de siempre.

**Por qué:** con la separación en `familiar/`/`invitacion/`, un link fijo a `index.html` sacaba al invitado de la invitación que ya había encontrado, mandándolo de nuevo a buscar su nombre — un paso de más y confuso.

## Panel de admin (`admin/`) reestructurado: menú + vistas bajo demanda

**Decisión:** `admin/index.html` (antes `mensaje/admin.html`) ya no carga la lista de mensajes automáticamente al entrar con la clave. Ahora muestra un menú (switch de modo + dos accesos: "Fotos de la galería" y "Mensajes de video"), y cada vista (lista, ver, borrar) recién carga sus datos cuando se toca esa opción. Se agregó `borrarFoto()` en el backend (mismo patrón protegido por clave que `borrarMensaje`) para poder borrar fotos de la galería desde ahí, algo que antes no existía.

**Por qué:** pedido explícito — el usuario no quería que los videos "salieran apenas entrás", y quería poder administrar también las fotos de la galería (antes el admin solo cubría mensajes de video).

## `index.html` como archivo de trabajo (histórico, superado en parte)

**Decisión original:** a partir del 2026-07-10 se edita solo `documentos/index.html`. `documentos/invitacion_casamiento.html` queda congelado como archivo histórico.

**Por qué:** GitHub Pages sirve `index.html` por defecto; apareció como duplicado (probablemente creado por el usuario vía GitHub para levantar Pages) y el usuario pidió consolidar el trabajo ahí.

**Actualización (mismo día):** esto ya no es "un solo archivo". Ver la decisión siguiente — ahora son dos archivos activos con un propósito distinto cada uno. `documentos/invitacion_casamiento.html` sigue congelado, sin tocar.

## Dos variantes activas: `index.html` (sin pago) vs `invitacion/index.html` (con pago)

**Decisión:** `documentos/invitacion/index.html` se creó como copia completa de `documentos/index.html`, y luego se le quitó la sección "Nuestro regalo de bodas" (+ la función `copyAlias()`) **solo** al `index.html` principal.

**Por qué:** pedido explícito del usuario — quería una versión de la invitación sin el método de pago visible (para compartir más ampliamente) y otra completa con el método de pago (`invitacion/index.html`).

**Cómo aplicarlo:** cualquier cambio de diseño, estructura, tipografía o color (sobre, calendario, RSVP, canciones, paleta general) se replica en **ambos archivos** por igual. Solo la sección de pago (y lo que dependa de ella, como `copyAlias()`) es exclusiva de `invitacion/index.html`. Si se agrega una feature nueva y no se aclara lo contrario, asumir que va en los dos.

## Archivos de trabajo definitivos: `index.html` e `invitacion/index.html` en la RAÍZ del repo (no en `documentos/`)

**Decisión (2026-07-11):** a partir de ahora se edita solo **`index.html`** e **`invitacion/index.html`** ubicados en la raíz del repo (no los de `documentos/`).

**Por qué:** el remoto ya tenía una copia de la invitación en la raíz (creada/editada directo desde GitHub, con su propio workflow de Pages en `.github/workflows/static.yml`) que terminó sincronizada con el contenido de `documentos/` tras los merges del 2026-07-11. El usuario decidió consolidar el trabajo ahí en vez de en `documentos/`, para simplificar y alinearse con cómo GitHub Pages sirve el sitio.

**Cómo aplicarlo:**
- Todo cambio nuevo de diseño/estructura/contenido va en `index.html` e `invitacion/index.html` (raíz).
- `documentos/index.html` y `documentos/invitacion/index.html` quedan **congelados** desde el 2026-07-11 — no se tocan más, igual que ya le pasaba a `documentos/invitacion_casamiento.html`. Si en algún momento hay que decidir entre uno y otro por una duda de "¿cuál es el que importa?", es siempre el de la raíz.
- La imagen de portada vive en `img/TARJETA.jpg` (raíz). Desde `index.html` (raíz) se referencia como `img/TARJETA.jpg`; desde `invitacion/index.html` (raíz) como `../img/TARJETA.jpg`. Ojo con no confundir estas rutas con las de los archivos congelados de `documentos/` (que usan `../img/` y `../../img/` respectivamente, por estar un nivel más adentro).

## Sobre de apertura a pantalla completa, con paleta propia adaptada de una referencia

**Decisión:** el usuario pasó una captura de un pin de Pinterest (no se pudo leer el contenido visual vía `WebFetch` — Pinterest no expone eso a scraping) describiendo un sobre a pantalla completa: panel de color sólido arriba con borde festoneado, sello ovalado con flor + iniciales superpuesto, texto de apertura abajo. Se implementó esa estructura con la paleta de colores del sitio en vez de copiar los colores exactos de la referencia (que era bordó).

**Por qué:** mantener coherencia visual con el resto de la invitación en vez de introducir un color ajeno a la paleta.

**Cómo aplicarlo:** si en el futuro se pasan más referencias visuales (imágenes) para ajustar tipografía/colores por sección, evaluar primero si conviene adoptar el color exacto de la referencia o adaptarlo a la paleta ya establecida — preguntar si no es obvio por contexto.

## Paleta verde oliva (reemplaza marrón/dorado/crema)

**Decisión:** se reemplazó toda la paleta marrón/dorado/crema original por verdes oliva, vía `sed` con mapeo de códigos hex exactos, aplicado igual en ambos archivos.

**Mapeo aplicado** (viejo → nuevo):
- `#6b4a2f` (oscuro, texto/botones) → `#4b5320`
- `#573c26` (hover de botón) → `#3a4118`
- `#5a4636` (texto de cuerpo) → `#48472e`
- `#c9a876` (dorado, dividers/bordes decorativos) → `#9c9a52`
- `#d8b98c` (bordes de tarjetas/inputs) → `#c7c894`
- `#a1794a` (texto secundario/links) → `#7d7a3f`
- `#a98a5a` (kicker) → `#8a8a4a`
- `#8a7360` (texto muted) → `#71724a`
- `#f7ece2`, `#efe0d0`, `#f4e6d6` (fondos claros) → `#f2f1de`, `#e7e6c6`, `#eeecd4`
- `#fffaf3`, `#fffdf8` (cremas de tarjetas/inputs) → `#f9f8ec`, `#f6f5e6`
- `#e6d3b8`, `#eee0c9`, `#f2e6d5` (bordes/hovers menores) → `#dcdcb0`, `#e4e4c4`, `#eceed6`
- `#7a9a6f` (status-tag, ya era verdoso) → `#6b7a3a`
- rgbas decorativos del fondo (`201,168,118` / `178,110,130` / `120,140,110`) → (`156,163,82` / `139,150,80` / `108,128,68`)
- sombra `rgba(107,74,47,x)` → `rgba(75,83,32,x)` (coincide con `#4b5320` en rgb)

**Qué NO se tocó:** el filtro `sepia(12%) saturate(90%)` del iframe de Google Maps (riesgo de romper la legibilidad del mapa real), y "Titular: Gabriel Oros" en la sección de pago (nombre real, no parte del theme).

**Cómo aplicarlo:** si se pide ajustar un color puntual de una sección específica más adelante (con imágenes de referencia), buscar el código hex actual de esa clase primero (ya no son los marrones originales) antes de tocar nada.

## Convención: orden de nombres "Julieta & Gabriel"

**Decisión:** en toda la invitación el nombre de Julieta va primero, Gabriel segundo — en el `<title>`, la portada, el sobre de apertura y el footer.

**Excepción:** "Titular: Gabriel Oros" en la sección de pago no sigue esta regla — es el nombre de una persona real (titular de cuenta bancaria), no una mención de la pareja como par.

## Archivos de trabajo definitivos (v2): `index.html` e `invitacion/index.html` en la raíz, `documentos/` congelado del todo

**Actualización (2026-07-11), reemplaza la decisión "Archivos de trabajo definitivos" anterior:** confirmado y en efecto — se trabaja únicamente en `index.html` e `invitacion/index.html` de la **raíz** del repo. `documentos/index.html`, `documentos/invitacion/index.html` y `documentos/invitacion_casamiento.html` están **todos** congelados y desactualizados a propósito.

**Cómo aplicarlo:** antes de tocar cualquier `index.html` del proyecto, confirmar que sea el de la raíz (no el de `documentos/`). Si alguna vez hay que decidir "¿cuál es la fuente de verdad?", es siempre el de la raíz.

## Galería de fotos: JSON+base64 en vez de blob binario o Drive público

**Decisión:** las fotos de la galería se sirven codificadas en base64 dentro de una respuesta JSON de Apps Script (`{ mimeType, data }`), no como archivo binario directo ni con el link público de Drive.

**Por qué:** se probaron dos alternativas y ambas fallaron:
1. `return file.getBlob()` directo desde `doGet` → Apps Script tira "el valor que muestra no es un valor de retorno admitido". No soporta devolver un blob crudo desde un web app.
2. Compartir cada archivo como "cualquiera con el link" (`file.setSharing(...)`) y que el navegador pida la URL de Drive directo → los requests anónimos (sin sesión de Google) redirigían a un login, aun con el sharing bien configurado. No quedó claro por qué (¿restricción de la cuenta/organización?), pero no era confiable.

**Cómo aplicarlo:** el cliente arma la imagen con `img.src = 'data:' + mimeType + ';base64,' + data`, construida en JS a partir del JSON. Es más pesado que servir binario directo, pero funciona de forma confiable sin depender de configuración de sharing de Drive. Si en el futuro hay muchas fotos y esto se vuelve lento, reconsiderar.

## Animación de secciones en dos niveles: `.visible` vs `.centered`

**Decisión:** el `IntersectionObserver` que revela las secciones al scrollear maneja **dos clases independientes**: `.visible` (la tarjeta entera hace fade+slide, se agrega una sola vez al 15% de intersección y no se saca más) y `.centered` (dispara la animación de los *datos internos* — contador, horas, monto, nombres — al 50% de intersección, y se **saca y pone** con cada cambio, así se repite cada vez que la sección se recentra).

**Por qué:** pedido explícito del usuario en dos pasos — primero quiso que los datos internos tuvieran su propio efecto de aparición (no solo la tarjeta), después que ese efecto se repitiera cada vez que volvía a centrar la sección scrolleando para arriba y para abajo.

**Cómo aplicarlo:** cualquier dato nuevo que se agregue a una sección y deba tener este efecto de aparición usa `.reveal.centered .clase-del-dato` en el CSS (no `.reveal.visible`), con su propio `transition-delay` para escalonarlo respecto a los demás datos de la misma sección.

## La primera sección no se observa desde el arranque — espera a que se abra el sobre

**Decisión:** la sección `.reveal` de índice 0 (la portada) no se pasa al `IntersectionObserver` al cargar la página. Se marca `.visible` de una (la tarjeta se ve apenas se abre el sobre), pero el `.centered` (que dispara la animación de los nombres) recién se empieza a observar cuando el usuario **abre el sobre** (`revealFirstSection()`, llamada desde el click handler del sobre).

**Por qué:** si se observara desde el arranque, el `IntersectionObserver` dispara su callback casi inmediatamente (la portada ya está en el viewport al cargar), agregando `.centered` mientras el sobre todavía tapa la pantalla. La animación de los nombres (dura ~2s) se reproduce entera *detrás* del sobre opaco — para cuando el usuario lo abre, ya terminó, se ve estática. No alcanzaba con un `requestAnimationFrame` doble (eso resuelve un problema de timing de *pintado*, no de *cuándo conceptualmente* debería arrancar la animación).

**Cómo aplicarlo:** si se agrega contenido animado nuevo a la portada, va a funcionar solo porque usa la misma clase `.reveal.centered` — no hace falta tocar nada extra, `revealFirstSection()` ya se encarga de arrancar la observación en el momento correcto.

## Sobre de apertura: click/tap, no scroll — y por qué

**Decisión:** el sobre se abre con un click/tap (`classList.add('open')` + fade/scale por CSS transition), no con una animación ligada al scroll (`scrollY`-driven).

**Por qué:** se implementó la versión scroll-driven (el sobre se iba desvaneciendo en proporción exacta a cuánto scrolleaba el usuario, sin necesidad de click) y funcionaba técnicamente, pero el usuario prefirió volver al modelo original de click. También se probó y se descartó una solapa animada en 3D (`rotateX`) imitando una secuencia de fotos de referencia — el usuario la encontró fea y se revirtió por completo, sin dejar rastros en el código.

**Cómo aplicarlo:** no reintroducir el mecanismo scroll-driven sin que el usuario lo pida explícitamente de nuevo — ya se probó y se descartó una vez.

## Tapar texto de una imagen y reemplazarlo por HTML animado (patrón repetible)

**Decisión/patrón:** cuando una imagen de diseño trae texto dibujado adentro (nombres, horas, lugar) que se necesita hacer dinámico o animado, no se edita la imagen "a mano" — se usa Python/Pillow para: (1) ubicar la banda de píxeles de ese texto (por brillo/oscuridad), (2) muestrear el color de fondo alrededor, (3) pintar un rectángulo sólido de ese color tapando el texto original, (4) superponer el texto real en HTML en esa posición exacta, con la tipografía y el efecto de aparición del resto del sitio.

**Por qué:** permite mantener el diseño gráfico que provee el usuario (mismo marco, misma textura) pero con contenido que puede animarse, actualizarse o traerse del Sheet — cosa que un texto dibujado en un JPG no permite.

**Cómo aplicarlo:** este patrón ya se usó en `lugares.jpg` (hora de ceremonia/fiesta) y `TARJETA.jpg` (nombres de la portada). Si aparece una imagen nueva con texto que haya que "activar", replicar el mismo proceso. Siempre verificar el parche componiendo la imagen resultante sobre un fondo sólido antes de darlo por bueno (ver también la nota de `alianzas.png` sobre falsos positivos de "transparencia" en el visor).
