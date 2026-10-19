// Este script solo lee y escribe el Google Sheet (invitados/RSVP,
// canciones, regalo, modo del sitio, visibilidad de la galería y la clave
// del admin). No toca Drive: las fotos de la galería, el carrusel y los
// mensajes de video viven en Cloudflare R2 y los sirve el Worker de
// worker/ (ver claude-ia/memoria/decisiones-tecnicas.md). El Worker
// consulta acá ?tipo=verificarClave para autorizar los borrados del admin.
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
