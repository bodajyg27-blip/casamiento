// Fotos de la galería y mensajes de video en Cloudflare R2.
//
// Rutas:
//   GET  /fotos                      → lista completa (array), para tv/ y admin/
//   GET  /fotos?pagina=N&porPagina=M → { total, pagina, porPagina, fotos }, para galeria/
//   POST /fotos                      → FormData: foto (archivo), thumb (opcional), nombre,
//                                      hash (opcional); 409 si esa foto ya se subió
//   GET  /f/<id>                     → la foto original
//   GET  /t/<id>                     → su miniatura
//   GET  /mensajes                   → lista de videos
//   POST /mensajes                   → cuerpo = el video crudo; nombre en ?nombre=
//   GET  /m/<id>                     → el video (admite Range, para adelantar)
//   POST /borrar                     → JSON { tipo: "foto"|"mensaje", id, clave }
//   GET  /carrusel                   → fotos de "Nuestra historia", ordenadas por nombre
//   GET  /c/<nombre>                 → una foto del carrusel
//   POST /carrusel                   → FormData: foto, hash, clave (solo admin); va al final;
//                                      409 si ya hay una foto con ese hash
//   POST /borrar                     → también { tipo: "carrusel", id: <nombre>, clave }
//
// Las fotos del carrusel se cargan desde admin/ (ya convertidas a WebP o
// JPEG en el navegador) y quedan en R2 → boda-fotos → carpeta "carrusel".
// El orden sale del número del principio del nombre ("3-lq2x9a.webp"):
// cada foto nueva toma el siguiente. También se pueden subir a mano desde
// el panel de Cloudflare con nombres "1.jpg", "2.jpg"...
//
// Mismos campos que devolvía Apps Script (id, nombre, fecha, url, download,
// directo, thumb) para tocar lo menos posible las páginas. La diferencia es
// que url/directo/download ahora son la imagen o el video en sí, no el JSON
// con base64 del proxy de Apps Script.

const MAX_FOTO = 15 * 1024 * 1024;
const MAX_THUMB = 1024 * 1024;
// Cloudflare corta los pedidos de más de 100 MB en el plan gratis.
const MAX_VIDEO = 95 * 1024 * 1024;

// El listado se guarda unos segundos en memoria del Worker: con 150
// invitados abriendo la galería a la vez, R2 se lista unas pocas veces por
// minuto en vez de una vez por visita (listar es operación clase A).
const LISTA_TTL_MS = 15 * 1000;

const ORIGENES = [
  'https://bodajyg.site',
  'https://www.bodajyg.site',
  'https://bodajyg27-blip.github.io'
];

function origenPermitido(origen) {
  if (!origen) return null;
  if (ORIGENES.includes(origen)) return origen;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen)) return origen;
  return null;
}

function cors(request) {
  const h = new Headers();
  const origen = origenPermitido(request.headers.get('Origin'));
  h.set('Access-Control-Allow-Origin', origen || ORIGENES[0]);
  h.set('Vary', 'Origin');
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Range');
  h.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  return h;
}

function json(request, data, status = 200) {
  const h = cors(request);
  h.set('Content-Type', 'application/json');
  h.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: h });
}

// Clave que ordena del más nuevo al más viejo: R2 lista en orden
// alfabético, así que se guarda (10^13 - ahora) con ceros adelante.
function nuevoId(extension) {
  const invertido = String(1e13 - Date.now()).padStart(13, '0');
  const azar = crypto.randomUUID().slice(0, 8);
  return `${invertido}-${azar}.${extension}`;
}

function extensionDe(tipo) {
  const ext = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    'image/heic': 'heic', 'image/heif': 'heif',
    'video/webm': 'webm', 'video/mp4': 'mp4', 'video/quicktime': 'mov'
  };
  return ext[String(tipo || '').split(';')[0].trim().toLowerCase()] || null;
}

function idValido(id) {
  return /^\d{13}-[0-9a-f]{8}\.[a-z0-9]{2,5}$/.test(id || '');
}

function nombreCarruselValido(nombre) {
  return /^[\w .()-]{1,100}\.(jpe?g|png|webp|gif)$/i.test(nombre || '');
}

function limpiarNombre(nombre) {
  return String(nombre || '').replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 100);
}

// ---------- Listados (con memoria corta) ----------

const memo = {};

function recordado(clave, fn) {
  const ahora = Date.now();
  const m = memo[clave];
  if (m && ahora - m.cuando < LISTA_TTL_MS) return m.promesa;
  const promesa = fn().catch(err => { delete memo[clave]; throw err; });
  memo[clave] = { cuando: ahora, promesa };
  return promesa;
}

function olvidar(clave) {
  delete memo[clave];
}

async function listarTodo(bucket) {
  const objetos = [];
  let cursor;
  do {
    const r = await bucket.list({ cursor, limit: 1000, include: ['customMetadata', 'httpMetadata'] });
    objetos.push(...r.objects);
    cursor = r.truncated ? r.cursor : undefined;
  } while (cursor);
  return objetos;
}

function listaFotos(env, base) {
  return recordado('fotos', async () => {
    const objetos = await listarTodo(env.FOTOS);
    return objetos
      .filter(o => o.key.startsWith('fotos/'))
      .map(o => {
        const id = o.key.slice('fotos/'.length);
        const url = `${base}/f/${id}`;
        return {
          id,
          nombre: (o.customMetadata && o.customMetadata.nombre) || id,
          fecha: o.uploaded.getTime(),
          url,
          download: url,
          directo: url,
          thumb: o.customMetadata && o.customMetadata.thumb === '1' ? `${base}/t/${id}` : null
        };
      });
  });
}

function listaCarrusel(env, base) {
  return recordado('carrusel', async () => {
    const r = await env.FOTOS.list({ prefix: 'carrusel/', limit: 1000, include: ['customMetadata'] });
    return r.objects
      .map(o => ({ nombre: o.key.slice('carrusel/'.length), hash: (o.customMetadata && o.customMetadata.hash) || null }))
      .filter(f => nombreCarruselValido(f.nombre))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
      .map(f => ({ id: f.nombre, nombre: f.nombre, hash: f.hash, url: `${base}/c/${encodeURIComponent(f.nombre)}` }));
  });
}

function listaMensajes(env, base) {
  return recordado('mensajes', async () => {
    const objetos = await listarTodo(env.MENSAJES);
    return objetos.map(o => {
      const url = `${base}/m/${o.key}`;
      return {
        id: o.key,
        nombre: (o.customMetadata && o.customMetadata.nombre) || o.key,
        fecha: o.uploaded.toISOString(),
        mimeType: (o.httpMetadata && o.httpMetadata.contentType) || 'video/webm',
        url,
        directo: url
      };
    });
  });
}

// ---------- Servir archivos ----------

async function servir(request, bucket, key, inmutable = true) {
  const obj = await bucket.get(key, { range: request.headers, onlyIf: request.headers });
  if (obj === null) return new Response('No existe', { status: 404, headers: cors(request) });

  const h = cors(request);
  obj.writeHttpMetadata(h);
  h.set('ETag', obj.httpEtag);
  h.set('Accept-Ranges', 'bytes');
  // Que el navegador respete el Content-Type guardado y no lo adivine.
  h.set('X-Content-Type-Options', 'nosniff');
  // Los ids de galería y mensajes no se reutilizan nunca, así que el
  // navegador puede guardarlos para siempre. Las del carrusel se pueden
  // reemplazar con el mismo nombre ("1.jpg"): esas, solo una hora.
  h.set('Cache-Control', inmutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');

  if (!('body' in obj)) return new Response(null, { status: 304, headers: h });

  if (obj.range && request.headers.has('Range')) {
    let inicio, largo;
    if ('suffix' in obj.range) {
      largo = Math.min(obj.range.suffix, obj.size);
      inicio = obj.size - largo;
    } else {
      inicio = obj.range.offset || 0;
      largo = obj.range.length !== undefined ? obj.range.length : obj.size - inicio;
    }
    h.set('Content-Range', `bytes ${inicio}-${inicio + largo - 1}/${obj.size}`);
    h.set('Content-Length', String(largo));
    return new Response(obj.body, { status: 206, headers: h });
  }
  h.set('Content-Length', String(obj.size));
  return new Response(obj.body, { headers: h });
}

// ---------- Subidas ----------

async function subirFoto(request, env) {
  let form;
  try {
    form = await request.formData();
  } catch (err) {
    return json(request, { success: false, error: 'Formato inválido' }, 400);
  }
  const foto = form.get('foto');
  if (!foto || typeof foto === 'string') return json(request, { success: false, error: 'Falta la foto' }, 400);
  const ext = extensionDe(foto.type);
  if (!ext || !foto.type.startsWith('image/')) return json(request, { success: false, error: 'Tipo no permitido' }, 415);
  if (foto.size > MAX_FOTO) return json(request, { success: false, error: 'Foto demasiado grande' }, 413);

  // Fotos repetidas: el navegador manda el SHA-256 del archivo ORIGINAL y
  // acá se guarda una marca "huellas/<hash>" por foto. Se consulta la
  // marca (un HEAD, siempre al día) y no el listado, que puede tener miles
  // de fotos y vive unos segundos en memoria. Sin hash (una página vieja
  // en caché) se sube igual, sin control.
  const hash = String(form.get('hash') || '');
  const conHash = /^[0-9a-f]{64}$/.test(hash);
  if (conHash && await env.FOTOS.head('huellas/' + hash)) {
    return json(request, { success: false, repetida: true, error: 'Esa foto ya está en la galería' }, 409);
  }

  const id = nuevoId(ext);
  let conThumb = false;
  const thumb = form.get('thumb');
  if (thumb && typeof thumb !== 'string' && extensionDe(thumb.type) && thumb.type.startsWith('image/') && thumb.size <= MAX_THUMB) {
    await env.FOTOS.put('miniaturas/' + id, thumb, {
      httpMetadata: { contentType: thumb.type }
    });
    conThumb = true;
  }
  await env.FOTOS.put('fotos/' + id, foto, {
    httpMetadata: { contentType: foto.type },
    customMetadata: Object.assign(
      { nombre: limpiarNombre(form.get('nombre') || foto.name), thumb: conThumb ? '1' : '0' },
      conHash ? { hash } : {}
    )
  });
  if (conHash) await env.FOTOS.put('huellas/' + hash, id);
  // A propósito NO se olvida el listado acá (mismo criterio que addFoto()
  // en Apps Script): quien subió ve su foto al instante desde su navegador.
  return json(request, { success: true, id });
}

async function subirMensaje(request, env, url) {
  const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  const ext = extensionDe(tipo);
  if (!ext || !tipo.startsWith('video/')) return json(request, { ok: false, error: 'Tipo no permitido' }, 415);
  const largo = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (!largo) return json(request, { ok: false, error: 'Falta el video' }, 411);
  if (largo > MAX_VIDEO) return json(request, { ok: false, error: 'Video demasiado grande' }, 413);

  const id = nuevoId(ext);
  const nombre = limpiarNombre(url.searchParams.get('nombre') || id);
  await env.MENSAJES.put(id, request.body, {
    httpMetadata: { contentType: request.headers.get('Content-Type') },
    customMetadata: { nombre }
  });
  // Los mensajes son pocos: acá sí conviene que aparezcan enseguida (la
  // página de mensajes confirma la subida buscando el nombre en el listado).
  olvidar('mensajes');
  return json(request, { ok: true, id, nombre });
}

// ---------- Carrusel (solo admin) ----------

const TIPOS_CARRUSEL = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function subirCarrusel(request, env, base) {
  let form;
  try {
    form = await request.formData();
  } catch (err) {
    return json(request, { ok: false, error: 'Formato inválido' }, 400);
  }
  if (!(await claveValida(env, form.get('clave')))) return json(request, { ok: false, error: 'No autorizado' }, 403);
  const foto = form.get('foto');
  if (!foto || typeof foto === 'string') return json(request, { ok: false, error: 'Falta la foto' }, 400);
  const ext = TIPOS_CARRUSEL[foto.type];
  if (!ext) return json(request, { ok: false, error: 'Tipo no permitido' }, 415);
  if (foto.size > MAX_FOTO) return json(request, { ok: false, error: 'Foto demasiado grande' }, 413);
  // SHA-256 del archivo ORIGINAL (antes de convertirlo en el navegador):
  // elegir dos veces el mismo archivo da la misma huella aunque la
  // conversión no salga byte por byte igual.
  // Sin hash (un admin viejo en caché) se sube igual, sin control.
  const hash = String(form.get('hash') || '');
  const conHash = /^[0-9a-f]{64}$/.test(hash);

  const actuales = await env.FOTOS.list({ prefix: 'carrusel/', limit: 1000, include: ['customMetadata'] });
  if (conHash && actuales.objects.some(o => o.customMetadata && o.customMetadata.hash === hash)) {
    return json(request, { ok: false, repetida: true, error: 'Esa foto ya está en el carrusel' }, 409);
  }

  // Siguiente número después del mayor que haya. El sufijo al azar hace
  // que un nombre no se repita nunca (si se borra la última y se sube
  // otra), porque /c/ deja las fotos una hora en la caché del navegador.
  const mayor = actuales.objects.reduce((max, o) => {
    const n = parseInt(o.key.slice('carrusel/'.length), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  const nombre = `${mayor + 1}-${Date.now().toString(36)}.${ext}`;
  await env.FOTOS.put('carrusel/' + nombre, foto, { httpMetadata: { contentType: foto.type }, customMetadata: conHash ? { hash } : {} });
  olvidar('carrusel');
  return json(request, { ok: true, id: nombre, url: `${base}/c/${encodeURIComponent(nombre)}` });
}

// ---------- Borrar (solo admin) ----------

async function claveValida(env, clave) {
  if (!clave) return false;
  try {
    const res = await fetch(env.GAS_URL + '?tipo=verificarClave&clave=' + encodeURIComponent(clave));
    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    return false;
  }
}

async function borrar(request, env) {
  let params;
  try {
    params = await request.json();
  } catch (err) {
    return json(request, { ok: false, error: 'Formato inválido' }, 400);
  }
  const idOk = params.tipo === 'carrusel' ? nombreCarruselValido(params.id) : idValido(params.id);
  if (!idOk) return json(request, { ok: false, error: 'Id inválido' }, 400);
  if (!(await claveValida(env, params.clave))) return json(request, { ok: false, error: 'No autorizado' }, 403);

  if (params.tipo === 'foto') {
    // Si se borra una foto, se puede volver a subir: se va su marca.
    const meta = await env.FOTOS.head('fotos/' + params.id);
    const hash = meta && meta.customMetadata && meta.customMetadata.hash;
    await env.FOTOS.delete(['fotos/' + params.id, 'miniaturas/' + params.id].concat(hash ? ['huellas/' + hash] : []));
    olvidar('fotos');
  } else if (params.tipo === 'carrusel') {
    await env.FOTOS.delete('carrusel/' + params.id);
    olvidar('carrusel');
  } else if (params.tipo === 'mensaje') {
    await env.MENSAJES.delete(params.id);
    olvidar('mensajes');
  } else {
    return json(request, { ok: false, error: 'Tipo inválido' }, 400);
  }
  return json(request, { ok: true });
}

// ---------- Router ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const base = url.origin;
    const ruta = url.pathname;

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });

    try {
      if (request.method === 'GET' || request.method === 'HEAD') {
        if (ruta === '/fotos') {
          const fotos = await listaFotos(env, base);
          if (!url.searchParams.has('pagina')) return json(request, fotos);
          const porPagina = Math.min(Math.max(parseInt(url.searchParams.get('porPagina') || '24', 10) || 24, 1), 200);
          const pagina = Math.max(parseInt(url.searchParams.get('pagina'), 10) || 0, 0);
          const inicio = pagina * porPagina;
          return json(request, { total: fotos.length, pagina, porPagina, fotos: fotos.slice(inicio, inicio + porPagina) });
        }
        if (ruta === '/mensajes') return json(request, await listaMensajes(env, base));
        if (ruta === '/carrusel') return json(request, await listaCarrusel(env, base));

        const c = ruta.match(/^\/c\/([^/]+)$/);
        if (c) {
          const nombre = decodeURIComponent(c[1]);
          if (nombreCarruselValido(nombre)) return servir(request, env.FOTOS, 'carrusel/' + nombre, false);
        }

        const m = ruta.match(/^\/(f|t|m)\/([^/]+)$/);
        if (m && idValido(m[2])) {
          if (m[1] === 'f') return servir(request, env.FOTOS, 'fotos/' + m[2]);
          if (m[1] === 't') return servir(request, env.FOTOS, 'miniaturas/' + m[2]);
          return servir(request, env.MENSAJES, m[2]);
        }
      }

      if (request.method === 'POST') {
        if (ruta === '/fotos') return subirFoto(request, env);
        if (ruta === '/mensajes') return subirMensaje(request, env, url);
        if (ruta === '/carrusel') return subirCarrusel(request, env, base);
        if (ruta === '/borrar') return borrar(request, env);
      }

      return json(request, { error: 'No encontrado' }, 404);
    } catch (err) {
      return json(request, { error: String(err && err.message || err) }, 500);
    }
  }
};
