'use strict';
/**
 * Extrae las coordenadas (latitud/longitud) de un enlace de Google Maps.
 * Soporta: enlaces largos (/place/..., @lat,lng, !3d..!4d.., ?q=lat,lng, embed),
 * enlaces cortos (maps.app.goo.gl, goo.gl/maps) y "lat,lng" escrito a mano.
 */

const num = '-?\\d{1,3}(?:\\.\\d+)?';

function valid(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function parseCoords(text) {
  let s = String(text || '');
  try { s = decodeURIComponent(s); } catch (_) { /* se usa tal cual */ }
  const patterns = [
    [new RegExp(`!3d(${num})!4d(${num})`), 1, 2],               // pin exacto del lugar
    [new RegExp(`!2d(${num})!3d(${num})`), 2, 1],               // enlaces "embed"
    [new RegExp(`[?&](?:q|query|ll|destination|daddr)=(${num}),\\s*(${num})`), 1, 2],
    [new RegExp(`/place/(${num}),\\s*(${num})`), 1, 2],
    [new RegExp(`@(${num}),(${num})`), 1, 2],                   // centro de la vista (último recurso)
  ];
  for (const [re, iLat, iLng] of patterns) {
    const m = re.exec(s);
    if (m) {
      const lat = parseFloat(m[iLat]);
      const lng = parseFloat(m[iLng]);
      if (valid(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

function isGoogleHost(host) {
  host = host.toLowerCase();
  return (
    host === 'goo.gl' || host === 'g.co' || host === 'maps.app.goo.gl' ||
    host === 'google.com' || host.endsWith('.google.com') || /^(www\.)?google\.[a-z.]{2,6}$/.test(host)
  );
}

async function resolveMapsUrl(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;

  const direct = new RegExp(`^\\s*(${num})\\s*,\\s*(${num})\\s*$`).exec(text);
  if (direct) {
    const lat = parseFloat(direct[1]);
    const lng = parseFloat(direct[2]);
    return valid(lat, lng) ? { lat, lng } : null;
  }

  let u;
  try { u = new URL(text); } catch (_) { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;

  const found = parseCoords(text);
  if (found) return found;

  // Enlace corto: se sigue la redirección (solo hacia dominios de Google)
  if (isGoogleHost(u.hostname)) {
    try {
      const r = await fetch(text, {
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; InvitacionBot/1.0)', 'accept-language': 'es' },
        signal: AbortSignal.timeout(9000),
      });
      const fromUrl = parseCoords(r.url);
      if (fromUrl) return fromUrl;
      const body = (await r.text()).slice(0, 400000);
      return parseCoords(body.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&'));
    } catch (_) {
      return null;
    }
  }
  return null;
}

module.exports = { resolveMapsUrl, parseCoords };
