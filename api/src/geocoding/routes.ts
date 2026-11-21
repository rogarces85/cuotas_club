import { Hono } from 'hono';
import { requireSession } from '../middleware/auth.js';
import { env } from '../env.js';

/**
 * Validación de direcciones para el formulario de socios.
 *
 * - Si existe `GOOGLE_MAPS_API_KEY`, se usa Google Geocoding (más preciso en
 *   Chile, requiere tarjeta y clave).
 * - Si no, se usa Nominatim de OpenStreetMap: gratis, sin clave y suficiente
 *   para confirmar que una dirección existe. Se respeta su política de uso:
 *   1 consulta por segundo como máximo y User-Agent identificable.
 *
 * Nunca bloquea el alta: si el proveedor falla, la API responde 502 con un
 * mensaje claro y la persona puede guardar la dirección igual.
 */

export const geocoding = new Hono();

geocoding.use('*', requireSession);

type Proveedor = 'google' | 'nominatim';

type Sugerencia = {
  direccion: string;
  detalle: string;
  lat: number | null;
  lng: number | null;
  precision: string | null;
};

type RespuestaCache = {
  expira: number;
  proveedor: Proveedor;
  sugerencias: Sugerencia[];
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 250;
const cache = new Map<string, RespuestaCache>();
let ultimaConsultaNominatim = 0;

function guardarEnCache(clave: string, valor: RespuestaCache): void {
  if (cache.size >= CACHE_MAX) {
    const ahora = Date.now();
    for (const [k, v] of cache) {
      if (v.expira <= ahora) cache.delete(k);
    }
    while (cache.size >= CACHE_MAX) {
      const primera = cache.keys().next().value;
      if (primera === undefined) break;
      cache.delete(primera);
    }
  }
  cache.set(clave, valor);
}

function recortar(valor: string, max = 255): string {
  return valor.length > max ? valor.slice(0, max - 1).trimEnd() + '…' : valor;
}

async function buscarGoogle(
  consulta: string,
  limite: number,
  clave: string,
): Promise<Sugerencia[]> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', consulta);
  url.searchParams.set('components', 'country:CL');
  url.searchParams.set('region', 'cl');
  url.searchParams.set('language', 'es');
  url.searchParams.set('key', clave);

  const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`Google respondió ${res.status}`);

  const datos = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: {
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number }; location_type?: string };
    }[];
  };

  if (datos.status !== 'OK' && datos.status !== 'ZERO_RESULTS') {
    throw new Error(datos.error_message ?? datos.status ?? 'Error de Google Geocoding');
  }

  return (datos.results ?? []).slice(0, limite).map((r) => ({
    direccion: recortar(r.formatted_address ?? consulta),
    detalle: r.formatted_address ?? consulta,
    lat: r.geometry?.location?.lat ?? null,
    lng: r.geometry?.location?.lng ?? null,
    precision: r.geometry?.location_type ?? null,
  }));
}

type NominatimResultado = {
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  addresstype?: string;
  address?: Record<string, string>;
};

async function buscarNominatim(consulta: string, limite: number): Promise<Sugerencia[]> {
  // Política de uso de Nominatim: máximo una consulta por segundo.
  const espera = Math.max(0, 1000 - (Date.now() - ultimaConsultaNominatim));
  if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
  ultimaConsultaNominatim = Date.now();

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('countrycodes', 'cl');
  url.searchParams.set('accept-language', 'es');
  url.searchParams.set('limit', String(limite));
  url.searchParams.set('q', consulta);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'cuotas-club-osorno-runners/0.1 (tesoreriaor@gmail.com)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) throw new Error(`OpenStreetMap respondió ${res.status}`);

  const datos = (await res.json()) as NominatimResultado[];

  return datos.map((r) => {
    const a = r.address ?? {};
    const calle = a.road ?? a.pedestrian ?? a.footway ?? a.path ?? null;
    const numero = a.house_number ?? null;
    const linea1 = calle ? [calle, numero].filter(Boolean).join(' ') : null;
    const partes = [
      linea1,
      a.suburb ?? a.neighbourhood ?? a.quarter,
      a.city ?? a.town ?? a.village ?? a.municipality,
      a.state,
      a.country,
    ].filter((p): p is string => Boolean(p));

    const direccion = partes.length > 0 ? partes.join(', ') : (r.display_name ?? consulta);

    return {
      direccion: recortar(direccion),
      detalle: r.display_name ?? direccion,
      lat: r.lat ? Number(r.lat) : null,
      lng: r.lon ? Number(r.lon) : null,
      precision: r.addresstype ?? r.type ?? null,
    };
  });
}

// GET /api/geocoding/buscar?q=...&limit=5 — sugerencias de dirección en Chile.
geocoding.get('/buscar', async (c) => {
  const consulta = (c.req.query('q') ?? '').trim();
  if (consulta.length < 4) {
    return c.json({ error: 'Escribe al menos 4 caracteres de la dirección' }, 400);
  }
  if (consulta.length > 160) {
    return c.json({ error: 'La dirección es demasiado larga (máx. 160 caracteres)' }, 400);
  }

  const limite = Math.min(Math.max(Number(c.req.query('limit') ?? 5) || 5, 1), 8);
  const clave = `${consulta.toLowerCase()}|${limite}`;

  const enCache = cache.get(clave);
  if (enCache && enCache.expira > Date.now()) {
    return c.json({ proveedor: enCache.proveedor, resultados: enCache.sugerencias });
  }

  const apiKey = env.googleMapsApiKey;
  const proveedor: Proveedor = apiKey ? 'google' : 'nominatim';

  try {
    const sugerencias = apiKey
      ? await buscarGoogle(consulta, limite, apiKey)
      : await buscarNominatim(consulta, limite);

    guardarEnCache(clave, {
      expira: Date.now() + CACHE_TTL_MS,
      proveedor,
      sugerencias,
    });

    return c.json({ proveedor, resultados: sugerencias });
  } catch (err) {
    console.error(`[geocoding] falló ${proveedor}:`, err);
    return c.json(
      {
        error: 'No se pudo validar la dirección en este momento. Puedes guardarla igual.',
        proveedor,
      },
      502,
    );
  }
});
