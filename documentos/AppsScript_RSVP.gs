// Este script lee y escribe el Google Sheet (invitados/RSVP, canciones,
// regalo, modo del sitio, visibilidad de la galería y la clave del admin).
// Las fotos de la galería, el carrusel y los mensajes de video viven en
// Cloudflare R2 y los sirve el Worker de worker/ (ver
// claude-ia/memoria/decisiones-tecnicas.md). El Worker consulta acá
// ?tipo=verificarClave para autorizar los borrados del admin.
//
// El panel admin/ también edita el Sheet por acá (lista de invitados y datos
// del regalo): ver "ADMIN" más abajo. Todo con la clave de admin.
//
// Drive se usa solo para el respaldo: el botón "Sincronizar" del admin
// llama a sincronizarDrive(), que copia a una carpeta de Drive las fotos y
// videos del Worker que todavía no estén ahí. Nada del sitio depende de
// Drive para funcionar.
//
// Es un proyecto de Apps Script independiente (no atado al Sheet), con el
// proyecto de Google Cloud que administra Google: así la autorización no
// vence cada 7 días como pasaba con el proyecto propio que se había creado
// para la API key de Drive (ver bugs-conocidos.md). Por eso abre el Sheet
// por su ID en vez de usar getActiveSpreadsheet().

// ID del Google Sheet: lo que va entre /d/ y /edit en su URL.
const SHEET_ID = "1vRvTfZVKwXR0nmf51KRuPveJpdkgXfbM_XfydzSV1I8";

function libro() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function doGet(e) {
  const tipo = e.parameter.tipo || "invitados";
  if (tipo === "canciones") {
    return getCanciones();
  }
  if (tipo === "regalo") {
    return getRegalo();
  }
  if (tipo === "verificarClave") {
    return ContentService.createTextOutput(JSON.stringify({ ok: claveValida(e.parameter.clave) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (tipo === "modoIndex") {
    return ContentService.createTextOutput(JSON.stringify({ modo: getModoIndex() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (tipo === "galeriaVisible") {
    return ContentService.createTextOutput(JSON.stringify({ visible: getGaleriaVisible() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (tipo === "buscarInvitado") {
    return buscarInvitado(e.parameter.q);
  }
  // La lista completa de invitados ya no es pública: solo con la clave de
  // admin. Las páginas usan ?tipo=buscarInvitado&q=..., que devuelve
  // únicamente los nombres que coinciden con lo que se escribió.
  if (!claveValida(e.parameter.clave)) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return getInvitados();
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    if (params.tipo === "cancion") {
      return addCancion(params);
    }
    if (params.tipo === "setModoIndex") {
      if (!claveValida(params.clave)) return errorNoAutorizado();
      return setModoIndex(params);
    }
    if (params.tipo === "setGaleriaVisible") {
      if (!claveValida(params.clave)) return errorNoAutorizado();
      return setGaleriaVisible(params);
    }
    if (params.tipo === "sincronizarDrive") {
      if (!claveValida(params.clave)) return errorNoAutorizado();
      return sincronizarDrive();
    }
    if (params.tipo === "adminListarInvitados") {
      if (!claveValida(params.clave)) return errorNoAutorizado();
      return adminListarInvitados();
    }
    if (params.tipo === "adminGuardarInvitado") {
      if (!claveValida(params.clave)) return errorNoAutorizado();
      return adminGuardarInvitado(params);
    }
    if (params.tipo === "adminBorrarInvitado") {
      if (!claveValida(params.clave)) return errorNoAutorizado();
      return adminBorrarInvitado(params);
    }
    if (params.tipo === "adminGuardarRegalo") {
      if (!claveValida(params.clave)) return errorNoAutorizado();
      return adminGuardarRegalo(params);
    }
    return confirmarInvitado(params);
  } catch (err) {
    logError(err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Anota el error en la pestaña "Errores" del Sheet (la crea si no existe)
// y deja solo los últimos 50, para poder ver qué falló sin abrir el editor.
function logError(err) {
  try {
    const ss = libro();
    const sheet = ss.getSheetByName("Errores") || ss.insertSheet("Errores");
    sheet.appendRow([new Date(), String((err && err.stack) || err)]);
    const sobrantes = sheet.getLastRow() - 50;
    if (sobrantes > 0) sheet.deleteRows(1, sobrantes);
  } catch (e2) {}
}

// ---------- Clave del panel de administración ----------
// Pestaña "Config" en el mismo Sheet: columna A = nombre del campo,
// columna B = valor. Fila esperada: ClaveAdmin | <la clave> (sin encabezado).

function getClaveAdmin() {
  const sheet = libro().getSheetByName("Config");
  if (!sheet) return "";
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === "claveadmin") {
      return String(data[i][1]).trim();
    }
  }
  return "";
}

function claveValida(clave) {
  const real = getClaveAdmin();
  return real !== "" && String(clave || "").trim() === real;
}

function errorNoAutorizado() {
  return ContentService.createTextOutput(JSON.stringify({ error: "No autorizado" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Modo de index.html (Save the date / Invitación / Galería) ----------
// Misma pestaña "Config" que la clave: fila "ModoIndex" | "savethedate",
// "galeria" o "invitacion". Si no existe la fila, se asume "invitacion".

const MODOS_INDEX_VALIDOS = ["savethedate", "invitacion", "galeria"];

function getModoIndex() {
  const sheet = libro().getSheetByName("Config");
  if (!sheet) return "invitacion";
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === "modoindex") {
      const valor = String(data[i][1] || "").trim().toLowerCase();
      return MODOS_INDEX_VALIDOS.includes(valor) ? valor : "invitacion";
    }
  }
  return "invitacion";
}

function setModoIndex(params) {
  const modo = MODOS_INDEX_VALIDOS.includes(params.modo) ? params.modo : "invitacion";
  const sheet = libro().getSheetByName("Config");
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Falta la pestaña Config" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === "modoindex") {
      sheet.getRange(i + 1, 2).setValue(modo);
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  sheet.appendRow(["ModoIndex", modo]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Visibilidad de la galería (galeria/index.html) ----------
// Misma pestaña "Config": fila "GaleriaVisible" | "true" o "false". Si no
// existe la fila, se asume visible (comportamiento de siempre). Solo afecta
// si galeria/index.html muestra la grilla de fotos o un mensaje de "todavía
// no" — subir fotos y verlas en tv/ siguen funcionando igual, sin bloquear
// nada del lado del servidor (mismo criterio que ModoIndex/ClaveAdmin).

function getGaleriaVisible() {
  const sheet = libro().getSheetByName("Config");
  if (!sheet) return true;
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === "galeriavisible") {
      return String(data[i][1]).trim().toLowerCase() !== "false";
    }
  }
  return true;
}

function setGaleriaVisible(params) {
  const visible = params.visible !== false && params.visible !== "false";
  const sheet = libro().getSheetByName("Config");
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Falta la pestaña Config" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === "galeriavisible") {
      sheet.getRange(i + 1, 2).setValue(String(visible));
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  sheet.appendRow(["GaleriaVisible", String(visible)]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- INVITADOS ----------
// Columnas: A=nombre, B=confirmado, C=fecha confirmación, D=restricciones,
// E=detalle restricción, F=Pagado ("SI", "NO" o "AUN NO CONFIRMADO": solo lo
// ven y editan los admin, ver PAGO_* más abajo), G=Tipo ("Familiar" o
// "Invitado") — define a qué variante de invitación redirige el buscador de
// index.html. Más una columna "Capitán" ("C" o vacío, también solo admin;
// se busca por el encabezado, ver columnaCapitan()).

const INVITADOS_CACHE_TTL = 60;      // segundos
const BUSQUEDA_MIN_LETRAS = 3;
const BUSQUEDA_MAX_RESULTADOS = 8;

// Lee la pestaña "Invitados". Se guarda en caché unos segundos para que
// cada búsqueda (una por invitado que escribe su nombre) no tenga que
// abrir el Sheet; confirmarInvitado() lo invalida para que el "ya
// confirmado" se vea enseguida.
function leerInvitados() {
  const cache = CacheService.getScriptCache();
  const enCache = cache.get('invitados_lista');
  if (enCache) return JSON.parse(enCache);

  const sheet = libro().getSheetByName("Invitados");
  const data = sheet.getDataRange().getValues();
  const guests = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    guests.push({
      nombre: data[i][0],
      confirmado: data[i][1] === true || data[i][1] === "TRUE",
      tipo: String(data[i][6] || "").trim()
    });
  }
  const json = JSON.stringify(guests);
  // CacheService limita cada clave a 100KB; con listas enormes se sigue
  // funcionando igual, solo que sin caché.
  if (json.length < 95000) cache.put('invitados_lista', json, INVITADOS_CACHE_TTL);
  return guests;
}

function getInvitados() {
  return ContentService.createTextOutput(JSON.stringify(leerInvitados()))
    .setMimeType(ContentService.MimeType.JSON);
}

// Minúsculas y sin acentos, para que "jose" encuentre a "José".
function normalizarTexto(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Devuelve solo los invitados cuyo nombre contiene lo que se escribió
// (mínimo BUSQUEDA_MIN_LETRAS letras, máximo BUSQUEDA_MAX_RESULTADOS
// resultados), en vez de entregar la lista entera a cualquiera que tenga
// la URL del script.
function buscarInvitado(q) {
  const consulta = normalizarTexto(q);
  let resultados = [];
  if (consulta.length >= BUSQUEDA_MIN_LETRAS) {
    resultados = leerInvitados()
      .filter(g => normalizarTexto(g.nombre).indexOf(consulta) !== -1)
      .slice(0, BUSQUEDA_MAX_RESULTADOS);
  }
  return ContentService.createTextOutput(JSON.stringify(resultados))
    .setMimeType(ContentService.MimeType.JSON);
}

function confirmarInvitado(params) {
  // Mismo candado que las ediciones del admin: borrar un invitado corre las
  // filas, y una confirmación a mitad de camino caería en otra.
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return confirmarInvitadoSinCandado(params);
  } finally {
    lock.releaseLock();
  }
}

function confirmarInvitadoSinCandado(params) {
  const sheet = libro().getSheetByName("Invitados");
  const data = sheet.getDataRange().getValues();
  const nombreBuscado = (params.nombre || "").toLowerCase().trim();
  const restricciones = Array.isArray(params.restricciones) ? params.restricciones.join(", ") : "";
  const detalle = params.detalle || "";

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).toLowerCase().trim() === nombreBuscado) {
      sheet.getRange(i + 1, 2).setValue(true);
      sheet.getRange(i + 1, 3).setValue(new Date());
      sheet.getRange(i + 1, 4).setValue(restricciones);
      sheet.getRange(i + 1, 5).setValue(detalle);
      const colPago = columnaPago(data);
      sheet.getRange(i + 1, colPago + 1).setValue(pagoAlConfirmar(data[i][colPago]));
      CacheService.getScriptCache().remove('invitados_lista');
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- CANCIONES ----------

function getCanciones() {
  const sheet = libro().getSheetByName("Canciones");
  const data = sheet.getDataRange().getValues();
  const songs = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    songs.push({ cancion: data[i][0] });
  }
  return ContentService.createTextOutput(JSON.stringify(songs))
    .setMimeType(ContentService.MimeType.JSON);
}

function addCancion(params) {
  const sheet = libro().getSheetByName("Canciones");
  const cancion = (params.cancion || "").trim().slice(0, 50);
  if (!cancion) {
    return ContentService.createTextOutput(JSON.stringify({ success: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  sheet.appendRow([cancion, new Date()]);
  return ContentService.createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- REGALO ----------
// Pestaña "Regalo": columna A = nombre del campo, columna B = valor.
// Filas esperadas: Monto, Titular, Banco, CBU, Alias (cualquier orden, sin encabezado).
function getRegalo() {
  const sheet = libro().getSheetByName("Regalo");
  const data = sheet.getDataRange().getValues();
  const regalo = {};
  for (let i = 0; i < data.length; i++) {
    const campo = String(data[i][0]).trim();
    if (!campo) continue;
    regalo[campo] = data[i][1];
  }
  return ContentService.createTextOutput(JSON.stringify(regalo))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- RESPALDO EN DRIVE (botón "Sincronizar" del admin) ----------
// Copia a Drive las fotos y videos del Worker que todavía no estén. La
// carpeta se crea sola la primera vez ("Casamiento J&G - Respaldo", con
// subcarpetas Fotos y Mensajes) y su ID queda en Config, fila
// "CarpetaRespaldo": se puede mover o renombrar en Drive sin problema.
//
// Cada archivo se nombra "<fecha> - <id>": el id es el mismo del Worker,
// así se sabe qué ya está copiado sin llevar otra lista. Cada llamada
// trabaja como mucho RESPALDO_TIEMPO_MAX_MS (~20 s, y termina la tanda de
// descargas en curso) y devuelve cuántos faltan: el admin vuelve a llamar
// hasta que no quede nada y va mostrando el porcentaje (Apps Script corta
// a los 6 minutos). Solo copia, nunca borra: lo que se borre en el Worker queda
// en Drive.
//
// La primera vez hay que autorizar Drive y UrlFetch corriendo
// autorizarRespaldo() desde el editor, ANTES de publicar la versión nueva
// (si no, el sitio entero queda pidiendo permisos; ver bugs-conocidos.md).

const MEDIA_URL = "https://boda-media.bodajyg.workers.dev";
const RESPALDO_NOMBRE_CARPETA = "Casamiento J&G - Respaldo";
const RESPALDO_TIEMPO_MAX_MS = 20 * 1000;   // tandas cortas: el admin muestra el avance entre una y otra
const RESPALDO_TANDA = 4;            // descargas en paralelo por tanda
const RESPALDO_REINTENTOS = 3;       // intentos por archivo antes de darlo por fallido
const RESPALDO_ZONA = "America/Argentina/Buenos_Aires";

function autorizarRespaldo() {
  DriveApp.getRootFolder();
  UrlFetchApp.fetch(MEDIA_URL + "/carrusel");
}

function leerConfig(nombre) {
  const sheet = libro().getSheetByName("Config");
  if (!sheet) return "";
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === nombre.toLowerCase()) {
      return String(data[i][1] || "").trim();
    }
  }
  return "";
}

function guardarConfig(nombre, valor) {
  const sheet = libro().getSheetByName("Config");
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === nombre.toLowerCase()) {
      sheet.getRange(i + 1, 2).setValue(valor);
      return;
    }
  }
  sheet.appendRow([nombre, valor]);
}

function carpetaRespaldo() {
  const id = leerConfig("CarpetaRespaldo");
  if (id) {
    try {
      const carpeta = DriveApp.getFolderById(id);
      if (!carpeta.isTrashed()) return carpeta;
    } catch (err) {}
  }
  const nueva = DriveApp.createFolder(RESPALDO_NOMBRE_CARPETA);
  guardarConfig("CarpetaRespaldo", nueva.getId());
  return nueva;
}

function subcarpeta(padre, nombre) {
  const it = padre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : padre.createFolder(nombre);
}

// Ids que ya están en la carpeta, sacados del final del nombre.
function idsEnCarpeta(carpeta) {
  const ids = new Set();
  const archivos = carpeta.getFiles();
  while (archivos.hasNext()) {
    const m = archivos.next().getName().match(/(\d{13}-[0-9a-f]{8}\.[a-z0-9]{2,5})$/);
    if (m) ids.add(m[1]);
  }
  return ids;
}

function listarWorker(ruta) {
  const res = UrlFetchApp.fetch(MEDIA_URL + ruta, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("El Worker respondió " + res.getResponseCode() + " en " + ruta);
  const lista = JSON.parse(res.getContentText());
  if (!Array.isArray(lista)) throw new Error("Listado inválido en " + ruta);
  return lista;
}

// Baja un archivo del Worker con reintentos. Un corte momentáneo de red
// ("Dirección no disponible") es normal entre los servidores de Google y
// Cloudflare: se reintenta con una pausa corta y, si no hay caso, se
// devuelve null para que ESE archivo cuente como fallido sin cortar la
// sincronización entera. El motivo queda en ultimoErrorDescarga.
let ultimoErrorDescarga = "";

// Drive también tira errores pasajeros ("Service error: Drive"), sobre todo
// al crear muchos archivos seguidos: lo que toca Drive se reintenta igual.
function conReintentos(fn) {
  let ultimo;
  for (let intento = 1; intento <= RESPALDO_REINTENTOS; intento++) {
    try {
      return fn();
    } catch (err) {
      ultimo = err;
      ultimoErrorDescarga = err.message;
      if (intento < RESPALDO_REINTENTOS) Utilities.sleep(800 * intento);
    }
  }
  throw ultimo;
}

function descargar(item) {
  for (let intento = 1; intento <= RESPALDO_REINTENTOS; intento++) {
    try {
      const res = UrlFetchApp.fetch(item.url, { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) return res;
      ultimoErrorDescarga = "HTTP " + res.getResponseCode() + " en " + item.id;
      if (res.getResponseCode() === 404) return null;   // ya no existe: reintentar no sirve
    } catch (err) {
      ultimoErrorDescarga = err.message;
    }
    if (intento < RESPALDO_REINTENTOS) Utilities.sleep(700 * intento);
  }
  return null;
}

function sincronizarDrive() {
  // Bandera en caché y no el candado del script: ese candado lo usan las
  // confirmaciones de invitados y las ediciones del admin, y no pueden
  // esperar a que termine una tanda de copia.
  const cache = CacheService.getScriptCache();
  if (cache.get("sync_en_curso")) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Ya hay una sincronización en curso" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  cache.put("sync_en_curso", "1", 90);
  try {
    const inicio = Date.now();
    const raiz = conReintentos(carpetaRespaldo);
    const grupos = [
      { carpeta: conReintentos(() => subcarpeta(raiz, "Fotos")), lista: listarWorker("/fotos") },
      { carpeta: conReintentos(() => subcarpeta(raiz, "Mensajes")), lista: listarWorker("/mensajes") }
    ];

    // Todo lo que falta, de las dos carpetas, en una sola cola.
    let total = 0;
    const faltan = [];
    grupos.forEach(g => {
      total += g.lista.length;
      const ya = conReintentos(() => idsEnCarpeta(g.carpeta));
      g.lista.forEach(item => {
        if (!ya.has(item.id)) faltan.push({ carpeta: g.carpeta, item });
      });
    });

    let copiadas = 0;
    let fallidas = 0;
    let i = 0;
    while (i < faltan.length && Date.now() - inicio < RESPALDO_TIEMPO_MAX_MS) {
      const tanda = faltan.slice(i, i + RESPALDO_TANDA);
      i += tanda.length;
      // En paralelo para ir rápido; si fetchAll tira error (una sola
      // conexión caída lo hace fallar entero), cada archivo se vuelve a
      // pedir por separado con reintentos.
      let respuestas;
      try {
        respuestas = UrlFetchApp.fetchAll(tanda.map(t => ({ url: t.item.url, muteHttpExceptions: true })));
      } catch (err) {
        ultimoErrorDescarga = err.message;
        respuestas = tanda.map(() => null);
      }
      respuestas.forEach((resParalela, j) => {
        const t = tanda[j];
        const res = resParalela && resParalela.getResponseCode() === 200 ? resParalela : descargar(t.item);
        if (!res) { fallidas++; return; }
        const fecha = Utilities.formatDate(new Date(t.item.fecha), RESPALDO_ZONA, "yyyy-MM-dd HH.mm.ss");
        try {
          const blob = res.getBlob().setName(fecha + " - " + t.item.id);
          conReintentos(() => t.carpeta.createFile(blob));
          copiadas++;
          Utilities.sleep(100);   // sin ráfagas: Drive se queja si se crean muchos seguidos
        } catch (err) {
          fallidas++;             // este archivo no se pudo guardar; el resto sigue
        }
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      total,
      copiadas,
      fallidas,
      pendientes: faltan.length - i,
      ultimoError: fallidas ? ultimoErrorDescarga : "",
      carpetaUrl: raiz.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    logError(err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    cache.remove("sync_en_curso");
  }
}

// ---------- ADMIN: invitados y regalo (panel admin/) ----------
// Todas exigen la clave de admin (ver doPost). Las que escriben toman el
// candado del script: confirmarInvitado() usa el mismo.

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function conCandado(fn) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return jsonOut({ ok: false, error: "El servidor está ocupado, probá de nuevo" });
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// Lista completa para el panel, siempre leída del Sheet (sin la caché que
// usa el buscador de los invitados). "fila" es el número de fila del Sheet:
// el panel lo devuelve al guardar o borrar, y se confirma con el nombre
// original para no tocar otra fila si la lista cambió mientras tanto.
function adminListarInvitados() {
  const sheet = libro().getSheetByName("Invitados");
  const data = sheet.getDataRange().getValues();
  const colPago = columnaPago(data);
  const colCapitan = columnaCapitan(data, colPago);
  const invitados = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const confirmado = data[i][1] === true || data[i][1] === "TRUE";
    const fecha = data[i][2] instanceof Date ? data[i][2].toISOString() : "";
    invitados.push({
      fila: i + 1,
      nombre: String(data[i][0]).trim(),
      confirmado,
      fecha: confirmado ? fecha : "",
      restricciones: String(data[i][3] || "").split(/,\s*/).map(x => x.trim()).filter(Boolean),
      detalle: String(data[i][4] || ""),
      pago: String(data[i][colPago] || "").trim(),
      capitan: colCapitan >= 0 && String(data[i][colCapitan] || "").trim().toUpperCase() === "C",
      tipo: String(data[i][6] || "").trim()
    });
  }
  return jsonOut({ ok: true, invitados, capitanDisponible: colCapitan >= 0 });
}

const TIPOS_INVITADO = ["Familiar", "Invitado"];

// Columna "Pagado" de la pestaña Invitados (menú desplegable en el Sheet).
// Es un dato interno: solo viaja en las acciones de admin. leerInvitados(),
// buscarInvitado() y getInvitados() devuelven campos explícitos (nombre,
// confirmado, tipo) y no la incluyen, así que no llega a la tarjeta de los
// invitados.
const PAGO_VALORES = ["SI", "NO", "AUN NO CONFIRMADO"];
const PAGO_POR_DEFECTO = "AUN NO CONFIRMADO";   // todo invitado nuevo arranca así

// Al confirmar (el invitado o el admin), "Pagado" pasa de AUN NO CONFIRMADO
// (o vacío) a NO: ya confirmó, todavía no pagó. Un SI (o un NO) que ya
// estuviera puesto no se toca: confirmar no puede pisar un pago.
function pagoAlConfirmar(actual) {
  const valor = String(actual || "").trim();
  return valor === "" || valor === PAGO_POR_DEFECTO ? "NO" : valor;
}

// Índice (desde 0) de la columna Pagado: la que tenga "pag" en el
// encabezado y, si no hay, la F. Nunca una de las que ya usa otra cosa.
function columnaPago(data) {
  const encabezado = data[0] || [];
  for (let c = 0; c < encabezado.length; c++) {
    if ([0, 1, 2, 3, 4, 6].includes(c)) continue;
    if (normalizarTexto(encabezado[c]).indexOf("pag") !== -1) return c;
  }
  return 5;
}

// El desplegable de "Pagado" (y cualquier otra validación, como casillas de
// verificación) es una validación de datos de cada celda: una fila agregada
// con appendRow NO la hereda. Se copia de la fila de arriba y, si ahí no hay
// ninguna, se arma la lista de PAGO_VALORES.
function copiarValidaciones(sheet, fila, colPago, colCapitan) {
  try {
    if (fila > 2) {
      const ancho = Math.max(7, colPago + 1, (colCapitan === undefined ? -1 : colCapitan) + 1);
      sheet.getRange(fila - 1, 1, 1, ancho).copyTo(
        sheet.getRange(fila, 1, 1, ancho), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    }
    const celda = sheet.getRange(fila, colPago + 1);
    if (!celda.getDataValidation()) {
      celda.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(PAGO_VALORES, true).setAllowInvalid(false).build());
    }
  } catch (err) {
    logError(err);   // el invitado ya está guardado: que falle esto no lo deshace
  }
}

// Para correr UNA vez a mano desde el editor: les pone el desplegable de
// "Pagado" a las filas que se agregaron antes de que se copiara solo (tomándolo
// de la fila más cercana de arriba que lo tenga).
function repararListasPago() {
  const sheet = libro().getSheetByName("Invitados");
  const data = sheet.getDataRange().getValues();
  const col = columnaPago(data) + 1;
  let arreglados = 0;
  for (let fila = 3; fila <= data.length; fila++) {
    const celda = sheet.getRange(fila, col);
    if (celda.getDataValidation()) continue;
    for (let f = fila - 1; f >= 2; f--) {
      const origen = sheet.getRange(f, col);
      if (origen.getDataValidation()) {
        origen.copyTo(celda, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
        arreglados++;
        break;
      }
    }
  }
  Logger.log("Filas arregladas: " + arreglados);
}

// Columna "Capitán": una "C" marca a los invitados que son capitanes, vacío
// para el resto. Se busca por el encabezado (que contenga "capit") porque no
// tiene un lugar fijo; si no existe, la función se desactiva (el panel no
// muestra el interruptor y no se escribe nada). Dato interno, igual que Pagado:
// solo viaja en las acciones de admin.
function columnaCapitan(data, colPago) {
  const encabezado = data[0] || [];
  for (let c = 0; c < encabezado.length; c++) {
    if ([0, 1, 2, 3, 4, 6, colPago].includes(c)) continue;
    if (normalizarTexto(encabezado[c]).indexOf("capit") !== -1) return c;
  }
  return -1;
}

// Busca la fila de un invitado: la indicada si todavía tiene ese nombre y,
// si no, por nombre. Devuelve 0 si no aparece.
function filaDeInvitado(data, fila, nombreOriginal) {
  const buscado = normalizarTexto(nombreOriginal);
  const i = (parseInt(fila, 10) || 0) - 1;
  if (i >= 1 && i < data.length && normalizarTexto(data[i][0]) === buscado) return i + 1;
  for (let k = 1; k < data.length; k++) {
    if (normalizarTexto(data[k][0]) === buscado) return k + 1;
  }
  return 0;
}

function adminGuardarInvitado(params) {
  return conCandado(() => {
    const nombre = String(params.nombre || "").trim().slice(0, 100);
    if (!nombre) return jsonOut({ ok: false, error: "Falta el nombre" });
    // "tipo" ya lleva el nombre de la acción (ver doPost): el del invitado
    // viaja como "tipoInvitado".
    const tipo = TIPOS_INVITADO.includes(params.tipoInvitado) ? params.tipoInvitado : "Invitado";
    // El admin puede CONFIRMAR a un invitado (como si lo hiciera él desde su
    // invitación) pero NO desconfirmarlo: un "confirmado: false" se ignora.
    const confirmar = params.confirmado === true;
    const restricciones = Array.isArray(params.restricciones) ? params.restricciones.map(String).join(", ") : "";
    const detalle = String(params.detalle || "").trim().slice(0, 300);
    // "pago" es opcional: si no llega, en un invitado existente no se toca
    // y en uno nuevo queda PAGO_POR_DEFECTO.
    let pago = null;
    if (params.pago !== undefined && params.pago !== null) {
      pago = String(params.pago).trim();
      if (!PAGO_VALORES.includes(pago)) return jsonOut({ ok: false, error: "Valor de pago inválido" });
    }

    // "capitan" es opcional: si no llega, en un invitado existente no se toca
    // y en uno nuevo queda vacío.
    const capitan = typeof params.capitan === "boolean" ? params.capitan : null;

    const sheet = libro().getSheetByName("Invitados");
    const data = sheet.getDataRange().getValues();
    const colPago = columnaPago(data);
    const colCapitan = columnaCapitan(data, colPago);
    const esNuevo = !params.nombreOriginal;
    const fila = esNuevo ? 0 : filaDeInvitado(data, params.fila, params.nombreOriginal);
    if (!esNuevo && !fila) return jsonOut({ ok: false, error: "No se encontró ese invitado: la lista cambió, recargá" });

    // confirmarInvitado() busca por nombre: dos con el mismo nombre se pisarían.
    for (let k = 1; k < data.length; k++) {
      if (k + 1 !== fila && normalizarTexto(data[k][0]) === normalizarTexto(nombre)) {
        return jsonOut({ ok: false, error: "Ya hay un invitado con ese nombre" });
      }
    }

    if (esNuevo) {
      // Columnas A..G (F = Pagado)
      const filaNueva = [nombre, confirmar, confirmar ? new Date() : "", restricciones, detalle, "", tipo];
      while (filaNueva.length <= Math.max(colPago, colCapitan)) filaNueva.push("");
      filaNueva[colPago] = pago === null ? (confirmar ? pagoAlConfirmar("") : PAGO_POR_DEFECTO) : pago;
      if (colCapitan >= 0) filaNueva[colCapitan] = capitan ? "C" : "";
      sheet.appendRow(filaNueva);
      copiarValidaciones(sheet, sheet.getLastRow(), colPago, colCapitan);
    } else {
      const yaConfirmado = data[fila - 1][1] === true || data[fila - 1][1] === "TRUE";
      sheet.getRange(fila, 1).setValue(nombre);
      if (confirmar && !yaConfirmado) {
        sheet.getRange(fila, 2).setValue(true);
        sheet.getRange(fila, 3).setValue(new Date());
        sheet.getRange(fila, colPago + 1).setValue(pagoAlConfirmar(data[fila - 1][colPago]));
      }
      sheet.getRange(fila, 4).setValue(restricciones);
      sheet.getRange(fila, 5).setValue(detalle);
      sheet.getRange(fila, 7).setValue(tipo);
      if (pago !== null) sheet.getRange(fila, colPago + 1).setValue(pago);
      if (colCapitan >= 0 && capitan !== null) sheet.getRange(fila, colCapitan + 1).setValue(capitan ? "C" : "");
    }
    CacheService.getScriptCache().remove("invitados_lista");
    return jsonOut({ ok: true });
  });
}

function adminBorrarInvitado(params) {
  return conCandado(() => {
    if (!params.nombreOriginal) return jsonOut({ ok: false, error: "Falta el nombre" });
    const sheet = libro().getSheetByName("Invitados");
    const data = sheet.getDataRange().getValues();
    const fila = filaDeInvitado(data, params.fila, params.nombreOriginal);
    if (!fila) return jsonOut({ ok: false, error: "No se encontró ese invitado: la lista cambió, recargá" });
    sheet.deleteRow(fila);
    CacheService.getScriptCache().remove("invitados_lista");
    return jsonOut({ ok: true });
  });
}

// Pestaña "Regalo" (ver getRegalo): se actualizan solo las filas de los
// campos que llegan y se agregan si no existían; cualquier otra fila queda
// como está. El CBU se guarda como texto para no perder los ceros del
// principio.
function adminGuardarRegalo(params) {
  return conCandado(() => {
    const monto = String(params.Monto === undefined ? "" : params.Monto).replace(/\D/g, "");
    const cbu = String(params.CBU || "").replace(/\D/g, "");
    if (cbu && cbu.length !== 22) return jsonOut({ ok: false, error: "El CBU/CVU tiene que tener 22 dígitos" });
    const campos = {
      Monto: monto === "" ? "" : Number(monto),
      Titular: String(params.Titular || "").trim().slice(0, 100),
      Banco: String(params.Banco || "").trim().slice(0, 100),
      CBU: cbu,
      Alias: String(params.Alias || "").trim().toUpperCase().slice(0, 50)
    };
    const sheet = libro().getSheetByName("Regalo");
    const data = sheet.getDataRange().getValues();
    Object.keys(campos).forEach(campo => {
      let fila = 0;
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim().toLowerCase() === campo.toLowerCase()) { fila = i + 1; break; }
      }
      if (!fila) {
        fila = sheet.getLastRow() + 1;
        sheet.getRange(fila, 1).setValue(campo);
      }
      const celda = sheet.getRange(fila, 2);
      if (campo === "CBU") celda.setNumberFormat("@");
      celda.setValue(campos[campo]);
    });
    return jsonOut({ ok: true });
  });
}
