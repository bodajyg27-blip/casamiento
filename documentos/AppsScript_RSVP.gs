// Este script lee y escribe el Google Sheet (invitados/RSVP, canciones,
// regalo, modo del sitio, visibilidad de la galería y la clave del admin).
// Las fotos de la galería, el carrusel y los mensajes de video viven en
// Cloudflare R2 y los sirve el Worker de worker/ (ver
// claude-ia/memoria/decisiones-tecnicas.md). El Worker consulta acá
// ?tipo=verificarClave para autorizar los borrados del admin.
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
// E=detalle restricción, F=(sin uso), G=Tipo ("Familiar" o "Invitado") —
// define a qué variante de invitación redirige el buscador de index.html.

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
const RESPALDO_TANDA = 6;            // descargas en paralelo por tanda
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

function sincronizarDrive() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Ya hay una sincronización en curso" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    const inicio = Date.now();
    const raiz = carpetaRespaldo();
    const grupos = [
      { carpeta: subcarpeta(raiz, "Fotos"), lista: listarWorker("/fotos") },
      { carpeta: subcarpeta(raiz, "Mensajes"), lista: listarWorker("/mensajes") }
    ];

    // Todo lo que falta, de las dos carpetas, en una sola cola.
    let total = 0;
    const faltan = [];
    grupos.forEach(g => {
      total += g.lista.length;
      const ya = idsEnCarpeta(g.carpeta);
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
      const respuestas = UrlFetchApp.fetchAll(tanda.map(t => ({ url: t.item.url, muteHttpExceptions: true })));
      respuestas.forEach((res, j) => {
        const t = tanda[j];
        if (res.getResponseCode() !== 200) { fallidas++; return; }
        const fecha = Utilities.formatDate(new Date(t.item.fecha), RESPALDO_ZONA, "yyyy-MM-dd HH.mm.ss");
        t.carpeta.createFile(res.getBlob().setName(fecha + " - " + t.item.id));
        copiadas++;
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      total,
      copiadas,
      fallidas,
      pendientes: faltan.length - i,
      carpetaUrl: raiz.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    logError(err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
