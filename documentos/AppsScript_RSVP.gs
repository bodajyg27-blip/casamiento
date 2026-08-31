// ID de la carpeta de Google Drive donde se guardan las fotos de la galería.
// Se toma del ID en la URL de la carpeta: drive.google.com/drive/folders/ESTE_ID
const GALERIA_FOLDER_ID = "1QYVFOCSnEKjwwPsz23O1sdYEFdrQ8QRz";

// ID de la carpeta de Google Drive donde se guardan los videos de "Dejanos un mensaje".
const MENSAJES_FOLDER_ID = "1apKNUF3hWw8F4q-8EUd69j7gsSbD3YMJ";

// ID de la carpeta de Google Drive con las fotos del carrusel "Nuestra historia"
// en la portada. Se toma del ID en la URL de la carpeta.
const CARRUSEL_FOLDER_ID = "1krOS3o8mvyNX3N_cvydD32PDI6ng83TO";

// ID de la carpeta de Google Drive con el video de "Save the date" que se
// muestra en index.html cuando ModoIndex (pestaña Config) = "savethedate".
const SAVETHEDATE_FOLDER_ID = "1Z5_sw5Hu7L3D7hrvJnlf-U-SJ4YEvU1J";

// API key de Google Cloud (Drive API habilitada), restringida a Drive API
// y a los referentes HTTP del sitio (bodajyg.site y localhost para
// pruebas). Se usa para que galeria/index.html pueda pedir cada foto
// directo a googleapis.com (drive/v3/files/ID?alt=media&key=...) sin
// pasar por este script — ver escanearGaleriaDrive(). Se guarda como
// Script Property (Configuración del proyecto > Propiedades del script >
// DRIVE_API_KEY) en vez de hardcodeada acá, para que el valor no quede en
// el historial de git — solo el nombre de la propiedad viaja en el código.
function getDriveApiKey() {
  return PropertiesService.getScriptProperties().getProperty('DRIVE_API_KEY') || '';
}

function doGet(e) {
  const tipo = e.parameter.tipo || "invitados";
  if (tipo === "canciones") {
    return getCanciones();
  }
  if (tipo === "regalo") {
    return getRegalo();
  }
  if (tipo === "galeria") {
    return getGaleria(e);
  }
  if (tipo === "carrusel") {
    return getCarrusel();
  }
  if (tipo === "foto") {
    return getFotoBlob(e.parameter.id);
  }
  if (tipo === "mensajes") {
    return getMensajes();
  }
  if (tipo === "mensajeVideo") {
    return getMensajeBlob(e.parameter.id);
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
  if (tipo === "saveTheDate") {
    return getSaveTheDate();
  }
  return getInvitados();
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    if (params.tipo === "cancion") {
      return addCancion(params);
    }
    if (params.tipo === "foto") {
      return addFoto(params);
    }
    if (params.tipo === "mensaje") {
      return addMensaje(params);
    }
    if (params.tipo === "borrarMensaje") {
      if (!claveValida(params.clave)) return errorNoAutorizado();
      return borrarMensaje(params);
    }
    if (params.tipo === "borrarFoto") {
      if (!claveValida(params.clave)) return errorNoAutorizado();
      return borrarFoto(params);
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

function logError(err) {
  try {
    const folder = DriveApp.getFolderById(MENSAJES_FOLDER_ID);
    const existentes = folder.getFilesByName("ULTIMO_ERROR.txt");
    while (existentes.hasNext()) existentes.next().setTrashed(true);
    folder.createFile("ULTIMO_ERROR.txt", String((err && err.stack) || err), MimeType.PLAIN_TEXT);
  } catch (e2) {}
}

// ---------- Clave del panel de administración ----------
// Pestaña "Config" en el mismo Sheet: columna A = nombre del campo,
// columna B = valor. Fila esperada: ClaveAdmin | 2358 (sin encabezado).

function getClaveAdmin() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
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

// Devuelve el id/nombre del primer video de la carpeta de "Save the date".
// El contenido en sí se pide después con ?tipo=foto&id=... (reutiliza el
// mismo endpoint que sirve fotos y videos en el resto del sitio).
function getSaveTheDate() {
  const folder = DriveApp.getFolderById(SAVETHEDATE_FOLDER_ID);
  const files = folder.getFiles();
  if (!files.hasNext()) {
    return ContentService.createTextOutput(JSON.stringify({ error: "No hay video cargado" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const file = files.next();
  return ContentService.createTextOutput(JSON.stringify({
    id: file.getId(),
    nombre: file.getName()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ---------- INVITADOS ----------
// Columnas: A=nombre, B=confirmado, C=fecha confirmación, D=restricciones,
// E=detalle restricción, F=(sin uso), G=Tipo ("Familiar" o "Invitado") —
// define a qué variante de invitación redirige el buscador de index.html.

function getInvitados() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Invitados");
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
  return ContentService.createTextOutput(JSON.stringify(guests))
    .setMimeType(ContentService.MimeType.JSON);
}

function confirmarInvitado(params) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Invitados");
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
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- CANCIONES ----------

function getCanciones() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Canciones");
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Canciones");
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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Regalo");
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

// ---------- GALERÍA (Google Drive) ----------
//
// Pensado para escalar a varios miles de fotos sin recargar cada visita:
//
// 1) getListaGaleriaCompleta() escanea Drive como mucho una vez cada
//    GALERIA_CACHE_TTL segundos (CacheService) — durante ese tiempo todos
//    los invitados que abren la galería leen la lista desde caché en vez
//    de volver a listar la carpeta entera. La lista se guarda partida en
//    "chunks" porque CacheService limita cada clave a 100KB, y con miles
//    de fotos la lista completa no entra en una sola.
// 2) getGaleria() pagina server-side (?pagina=N&porPagina=M) cuando el
//    cliente lo pide, para que el primer request sea liviano incluso con
//    miles de fotos ya subidas. Sin esos parámetros devuelve el array
//    plano de siempre, por compatibilidad con tv/index.html y
//    admin/index.html (que necesitan la lista completa igual).
// 3) galeria/index.html pide cada foto directo a la API oficial de Drive
//    (googleapis.com/drive/v3/files/ID?alt=media&key=DRIVE_API_KEY), no a
//    este script — así ver fotos no consume ejecuciones de Apps Script
//    (limitadas a 30 simultáneas). Antes se probó el truco no oficial
//    drive.google.com/thumbnail para lo mismo, pero con apenas 16 fotos
//    cargando casi en simultáneo ya devolvía 429 (Too Many Requests): no
//    es una API con cuota documentada. La API v3 con key sí la tiene (muy
//    por encima de lo que necesita esta boda). tipo=foto sigue existiendo
//    para tv/index.html, admin/index.html y el botón "Descargar".

const GALERIA_CACHE_TTL = 60; // segundos
// Fotos por clave de caché. CacheService limita cada clave a 100KB; cada
// foto acá pesa ~350-400 bytes, así que 200 por chunk deja margen de
// sobra (~70-80KB) aunque haya nombres de archivo largos.
const GALERIA_CACHE_CHUNK = 200;

function escanearGaleriaDrive() {
  const folder = DriveApp.getFolderById(GALERIA_FOLDER_ID);
  const files = folder.getFilesByType(MimeType.JPEG);
  // "image/webp" no existe como constante en el enum MimeType de Apps
  // Script (no hay MimeType.WEBP), pero getFilesByType() acepta el string
  // de content-type crudo igual que los demás — se agrega así para que las
  // fotos subidas en WebP (ver resizeImage() en galeria/index.html) también
  // aparezcan en la galería.
  const otrosTipos = [MimeType.PNG, MimeType.GIF, MimeType.BMP, 'image/webp'];
  const fotos = [];
  const vistos = {};
  const baseUrl = ScriptApp.getService().getUrl();
  const apiKey = getDriveApiKey();

  function agregar(iter) {
    while (iter.hasNext()) {
      const file = iter.next();
      const id = file.getId();
      if (vistos[id]) continue;
      vistos[id] = true;
      const fotoUrl = baseUrl + "?tipo=foto&id=" + id;
      fotos.push({
        id: id,
        nombre: file.getName(),
        fecha: file.getDateCreated().getTime(),
        // url/download: proxy de este script — lo siguen usando
        // tv/index.html, admin/index.html y el botón "Descargar".
        url: fotoUrl,
        download: fotoUrl,
        // directo: API oficial de Drive, la usa galeria/index.html para
        // no consumir ejecuciones de Apps Script en cada foto que se ve.
        directo: "https://www.googleapis.com/drive/v3/files/" + id + "?alt=media&key=" + apiKey
      });
    }
  }

  agregar(files);
  otrosTipos.forEach(tipo => agregar(folder.getFilesByType(tipo)));

  fotos.sort((a, b) => b.fecha - a.fecha);
  return fotos;
}

function getListaGaleriaCompleta() {
  const cache = CacheService.getScriptCache();
  const metaRaw = cache.get('galeria_meta');
  if (metaRaw) {
    const meta = JSON.parse(metaRaw);
    const claves = [];
    for (let i = 0; i < meta.chunks; i++) claves.push('galeria_chunk_' + i);
    const chunksRaw = cache.getAll(claves);
    if (Object.keys(chunksRaw).length === meta.chunks) {
      let fotos = [];
      for (let i = 0; i < meta.chunks; i++) {
        fotos = fotos.concat(JSON.parse(chunksRaw['galeria_chunk_' + i]));
      }
      return fotos;
    }
  }

  // Caché vacío o vencido: recién acá se escanea Drive de verdad.
  const fotos = escanearGaleriaDrive();
  const chunks = [];
  for (let i = 0; i < fotos.length; i += GALERIA_CACHE_CHUNK) {
    chunks.push(fotos.slice(i, i + GALERIA_CACHE_CHUNK));
  }
  const paraGuardar = {};
  chunks.forEach((chunk, i) => { paraGuardar['galeria_chunk_' + i] = JSON.stringify(chunk); });
  paraGuardar['galeria_meta'] = JSON.stringify({ chunks: chunks.length, total: fotos.length });
  cache.putAll(paraGuardar, GALERIA_CACHE_TTL);

  return fotos;
}

// Se llama después de subir o borrar una foto para que el cambio se vea
// enseguida en vez de esperar a que venza GALERIA_CACHE_TTL.
function invalidarCacheGaleria() {
  const cache = CacheService.getScriptCache();
  const metaRaw = cache.get('galeria_meta');
  const claves = ['galeria_meta'];
  if (metaRaw) {
    const meta = JSON.parse(metaRaw);
    for (let i = 0; i < meta.chunks; i++) claves.push('galeria_chunk_' + i);
  }
  cache.removeAll(claves);
}

function getGaleria(e) {
  const fotos = getListaGaleriaCompleta();

  // tv/index.html y admin/index.html piden ?tipo=galeria sin "pagina" y
  // esperan el array plano de siempre (con .url para el proxy base64) —
  // se los sigue sirviendo así, ahora más rápido gracias al caché de
  // getListaGaleriaCompleta(). Solo galeria/index.html manda "pagina" y
  // recibe la respuesta paginada, para no traer miles de fotos de golpe.
  if (!e || e.parameter.pagina === undefined) {
    return ContentService.createTextOutput(JSON.stringify(fotos))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const porPagina = Math.min(Math.max(parseInt(e.parameter.porPagina || '24', 10) || 24, 1), 200);
  const pagina = Math.max(parseInt(e.parameter.pagina, 10) || 0, 0);
  const inicio = pagina * porPagina;

  return ContentService.createTextOutput(JSON.stringify({
    total: fotos.length,
    pagina: pagina,
    porPagina: porPagina,
    fotos: fotos.slice(inicio, inicio + porPagina)
  })).setMimeType(ContentService.MimeType.JSON);
}

// Ejecutar UNA SOLA VEZ a mano desde el editor de Apps Script: comparte la
// CARPETA de la galería con "Cualquiera con el enlace, solo ver". Los
// archivos que ya estaban adentro y los que se suban de ahora en más
// heredan ese permiso automáticamente — así addFoto() ya no necesita
// compartir cada foto una por una (ver por qué en el comentario de
// addFoto()), y subir fotos hace una operación menos contra Drive por
// invitado, lo que ayuda cuando hay muchas subidas al mismo tiempo.
function compartirCarpetaGaleria() {
  DriveApp.getFolderById(GALERIA_FOLDER_ID).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  Logger.log('Carpeta de la galería compartida.');
}

// Fotos del carrusel "Nuestra historia" de la portada. A diferencia de
// getGaleria(), se ordena por NOMBRE de archivo (no por fecha) para que
// la pareja controle el orden nombrando los archivos "1.jpg", "2.jpg", etc.
// Reutiliza el mismo endpoint tipo=foto que ya usa la galería para traer
// cada imagen — no hace falta una función de blob aparte.
function getCarrusel() {
  const folder = DriveApp.getFolderById(CARRUSEL_FOLDER_ID);
  const files = folder.getFilesByType(MimeType.JPEG);
  const otrosTipos = [MimeType.PNG, MimeType.GIF, MimeType.BMP];
  const fotos = [];
  const vistos = {};
  const baseUrl = ScriptApp.getService().getUrl();

  function agregar(iter) {
    while (iter.hasNext()) {
      const file = iter.next();
      const id = file.getId();
      if (vistos[id]) continue;
      vistos[id] = true;
      fotos.push({
        id: id,
        nombre: file.getName(),
        url: baseUrl + "?tipo=foto&id=" + id
      });
    }
  }

  agregar(files);
  otrosTipos.forEach(tipo => agregar(folder.getFilesByType(tipo)));

  fotos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));

  return ContentService.createTextOutput(JSON.stringify(fotos))
    .setMimeType(ContentService.MimeType.JSON);
}

// Sirve el archivo de Drive codificado en base64 (doGet solo admite
// devolver TextOutput/HtmlOutput, NO un Blob binario crudo — confirmado
// probando: "el valor que muestra no es un valor de retorno admitido"),
// sin depender de que el archivo esté compartido públicamente — el
// script siempre tiene acceso como su dueño.
function getFotoBlob(id) {
  if (!id) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Falta el id" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const file = DriveApp.getFileById(id);
  const blob = file.getBlob();
  return ContentService.createTextOutput(JSON.stringify({
    mimeType: blob.getContentType(),
    data: Utilities.base64Encode(blob.getBytes())
  })).setMimeType(ContentService.MimeType.JSON);
}

function addFoto(params) {
  const base64 = params.data || "";
  if (!base64) {
    return ContentService.createTextOutput(JSON.stringify({ success: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const folder = DriveApp.getFolderById(GALERIA_FOLDER_ID);
  const nombre = (params.nombre || "foto").replace(/[^a-zA-Z0-9._-]/g, "_");
  const mimeType = params.mimeType || "image/jpeg";
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, nombre);
  const file = folder.createFile(blob);
  // No hace falta compartir este archivo individualmente: la carpeta
  // GALERIA_FOLDER_ID ya está compartida como "Cualquiera con el enlace"
  // (ver compartirCarpetaGaleria()) y los archivos nuevos heredan ese
  // permiso solos — así cada subida es una operación menos contra Drive,
  // lo que importa cuando hay muchas subidas al mismo tiempo.
  invalidarCacheGaleria();

  return ContentService.createTextOutput(JSON.stringify({ success: true, id: file.getId() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function borrarFoto(params) {
  const id = params.id || "";
  if (!id) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Falta el id" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  DriveApp.getFileById(id).setTrashed(true);
  invalidarCacheGaleria();
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- MENSAJES (video, Google Drive) ----------
//
// Ejecutar UNA SOLA VEZ a mano desde el editor de Apps Script: comparte la
// CARPETA de mensajes con "Cualquiera con el enlace, solo ver", igual que
// compartirCarpetaGaleria(). Los videos nuevos heredan el permiso solos —
// necesario para que la API key pueda leerlos vía "directo" (getMensajes()).
// El archivo interno ULTIMO_ERROR.txt (logError()) queda en la misma
// carpeta compartida, pero su id nunca se expone por ningún endpoint —
// getMensajes() lo excluye explícitamente — así que sigue siendo
// inaccesible en la práctica aunque la carpeta sea pública.
function compartirCarpetaMensajes() {
  DriveApp.getFolderById(MENSAJES_FOLDER_ID).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  Logger.log('Carpeta de mensajes compartida.');
}

function addMensaje(params) {
  const base64 = params.file || "";
  if (!base64) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Falta el archivo" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const folder = DriveApp.getFolderById(MENSAJES_FOLDER_ID);
  const nombre = (params.filename || "mensaje").replace(/[^a-zA-Z0-9._-]/g, "_");
  const mimeType = params.mimeType || "video/webm";
  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, nombre);
  folder.createFile(blob);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Lista los mensajes de video guardados (para tv/index.html y el panel de
// administración). "directo" apunta a la API oficial de Drive, igual que
// las fotos de la galería (ver escanearGaleriaDrive()) — evita que
// tv/index.html tenga que bajar el video entero como JSON+base64 antes de
// poder reproducir un solo frame; con la URL directa el <video> puede
// arrancar en streaming y permite adelantar/atrasar. "url" (proxy de este
// script) se mantiene para el botón "Descargar" y como fallback.
function getMensajes() {
  const folder = DriveApp.getFolderById(MENSAJES_FOLDER_ID);
  const files = folder.getFiles();
  const baseUrl = ScriptApp.getService().getUrl();
  const apiKey = getDriveApiKey();
  const mensajes = [];
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName() === "ULTIMO_ERROR.txt") continue;
    const id = file.getId();
    mensajes.push({
      id: id,
      nombre: file.getName(),
      fecha: file.getDateCreated(),
      mimeType: file.getMimeType(),
      url: baseUrl + "?tipo=mensajeVideo&id=" + id,
      directo: "https://www.googleapis.com/drive/v3/files/" + id + "?alt=media&key=" + apiKey
    });
  }
  mensajes.sort((a, b) => b.fecha - a.fecha);
  return ContentService.createTextOutput(JSON.stringify(mensajes))
    .setMimeType(ContentService.MimeType.JSON);
}

// Sirve un video de mensaje codificado en base64, mismo patrón que getFotoBlob.
function getMensajeBlob(id) {
  if (!id) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Falta el id" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const file = DriveApp.getFileById(id);
  const blob = file.getBlob();
  return ContentService.createTextOutput(JSON.stringify({
    mimeType: blob.getContentType(),
    data: Utilities.base64Encode(blob.getBytes())
  })).setMimeType(ContentService.MimeType.JSON);
}

function borrarMensaje(params) {
  const id = params.id || "";
  if (!id) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Falta el id" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  DriveApp.getFileById(id).setTrashed(true);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
