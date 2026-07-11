// ID de la carpeta de Google Drive donde se guardan las fotos de la galería.
// Se toma del ID en la URL de la carpeta: drive.google.com/drive/folders/ESTE_ID
const GALERIA_FOLDER_ID = "PEGAR_AQUI_ID_DE_CARPETA_DRIVE";

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
  if (tipo === "foto") {
    return getFotoBlob(e.parameter.id);
  }
  return getInvitados();
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  if (params.tipo === "cancion") {
    return addCancion(params);
  }
  if (params.tipo === "foto") {
    return addFoto(params);
  }
  return confirmarInvitado(params);
}

// ---------- INVITADOS ----------

function getInvitados() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Invitados");
  const data = sheet.getDataRange().getValues();
  const guests = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    guests.push({
      nombre: data[i][0],
      confirmado: data[i][1] === true || data[i][1] === "TRUE"
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

// Sirve el archivo de Drive codificado en base64 (doGet no admite devolver
// un blob binario crudo), sin depender de que el archivo esté compartido
// públicamente — el script siempre tiene acceso como su dueño.
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
