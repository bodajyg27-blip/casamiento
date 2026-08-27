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

function doGet(e) {
  const tipo = e.parameter.tipo || "invitados";
  if (tipo === "canciones") {
    return getCanciones();
  }
  if (tipo === "regalo") {
    return getRegalo();
  }
  if (tipo === "galeria") {
    return getGaleria();
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
    if (params.tipo === "setModoIndex") {
      if (!claveValida(params.clave)) return errorNoAutorizado();
      return setModoIndex(params);
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

// ---------- Modo de index.html (Save the date / Invitación) ----------
// Misma pestaña "Config" que la clave: fila "ModoIndex" | "savethedate" o
// "invitacion". Si no existe la fila, se asume "invitacion" por default.

function getModoIndex() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Config");
  if (!sheet) return "invitacion";
  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === "modoindex") {
      const valor = String(data[i][1] || "").trim().toLowerCase();
      return valor === "savethedate" ? "savethedate" : "invitacion";
    }
  }
  return "invitacion";
}

function setModoIndex(params) {
  const modo = params.modo === "savethedate" ? "savethedate" : "invitacion";
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

function getGaleria() {
  const folder = DriveApp.getFolderById(GALERIA_FOLDER_ID);
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
      const fotoUrl = baseUrl + "?tipo=foto&id=" + id;
      fotos.push({
        id: id,
        nombre: file.getName(),
        fecha: file.getDateCreated(),
        url: fotoUrl,
        download: fotoUrl
      });
    }
  }

  agregar(files);
  otrosTipos.forEach(tipo => agregar(folder.getFilesByType(tipo)));

  fotos.sort((a, b) => b.fecha - a.fecha);

  return ContentService.createTextOutput(JSON.stringify(fotos))
    .setMimeType(ContentService.MimeType.JSON);
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

  return ContentService.createTextOutput(JSON.stringify({ success: true, id: file.getId() }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- MENSAJES (video, Google Drive) ----------

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

// Lista los mensajes de video guardados (para el panel de administración).
function getMensajes() {
  const folder = DriveApp.getFolderById(MENSAJES_FOLDER_ID);
  const files = folder.getFiles();
  const mensajes = [];
  while (files.hasNext()) {
    const file = files.next();
    if (file.getName() === "ULTIMO_ERROR.txt") continue;
    mensajes.push({
      id: file.getId(),
      nombre: file.getName(),
      fecha: file.getDateCreated(),
      mimeType: file.getMimeType()
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
