import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CotizacionTipoBlue,
  FuenteCotizacion,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Cotizaciones del dólar.
 *
 * Patrón tomado de `sistemaCocGuana/backend/src/cotizaciones/cotizaciones.service.ts`
 * y adaptado:
 * - Fuente primaria: dolarapi.com (blue del día, formato JSON simple).
 * - Respaldo: Ámbito (si dolarapi falla).
 * - Histórico (para la migración 2026): argentinadatos.com.
 * - Snapshot diario al iniciar el día (cron 00:05 ARG).
 * - Cache in-memory 15 min para no martillar la API.
 * - Fallback a la última CotizacionDolar de BD si todas las fuentes fallan.
 */

type CotizacionSnapshot = {
  tipo: CotizacionTipoBlue;
  fuente: FuenteCotizacion;
  compra: number;
  venta: number;
  fecha: string; // ISO
};

type Resumen = {
  cotizaciones: CotizacionSnapshot[];
  actualizadoAt: string;
  fuentePrimaria: FuenteCotizacion;
};

const CACHE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class CotizacionesService {
  private readonly logger = new Logger(CotizacionesService.name);
  private cache: { data: Resumen; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Devuelve el blue del día. Usa cache; si expiró, va a dolarapi; si falla,
   * cae a Ámbito; si ambas fallan, al cache anterior; si no hay cache,
   * levanta ServiceUnavailable.
   */
  async getBlueHoy(): Promise<Resumen> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) return this.cache.data;

    const primera = await this.fetchDolarapi();
    const cotizaciones: CotizacionSnapshot[] = [];
    let fuentePrimaria: FuenteCotizacion = FuenteCotizacion.DOLARAPI;

    if (primera) {
      cotizaciones.push(primera);
    } else {
      const respaldo = await this.fetchAmbito();
      if (respaldo) {
        cotizaciones.push(respaldo);
        fuentePrimaria = FuenteCotizacion.AMBITO;
      }
    }

    if (cotizaciones.length === 0) {
      if (this.cache) {
        this.logger.warn('Ambas APIs fallaron — devuelvo cache anterior');
        return this.cache.data;
      }
      throw new ServiceUnavailableException(
        'No se pudo obtener la cotización del dólar (dolarapi y Ámbito fallaron)',
      );
    }

    const data: Resumen = {
      cotizaciones,
      actualizadoAt: new Date().toISOString(),
      fuentePrimaria,
    };
    this.cache = { data, expiresAt: now + CACHE_TTL_MS };
    return data;
  }

  /**
   * Hace upsert idempotente de la cotización del día en CotizacionDolar.
   * Se corre desde el cron y desde `POST /cotizaciones/snapshot`.
   */
  async snapshotHoy() {
    const resumen = await this.getBlueHoy();
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    const guardadas: Array<{ fuente: string; compra: number; venta: number }> = [];
    for (const c of resumen.cotizaciones) {
      await this.prisma.cotizacionDolar.upsert({
        where: {
          fecha_tipo_fuente: { fecha: hoy, tipo: c.tipo, fuente: c.fuente },
        },
        update: {
          compra: new Prisma.Decimal(c.compra),
          venta: new Prisma.Decimal(c.venta),
        },
        create: {
          fecha: hoy,
          tipo: c.tipo,
          fuente: c.fuente,
          compra: new Prisma.Decimal(c.compra),
          venta: new Prisma.Decimal(c.venta),
        },
      });
      guardadas.push({ fuente: c.fuente, compra: c.compra, venta: c.venta });
    }
    return { fecha: hoy.toISOString().split('T')[0], guardadas };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'snapshotDolarDiario' })
  async cronSnapshotDiario() {
    try {
      const r = await this.snapshotHoy();
      this.logger.log(`Snapshot diario OK · ${r.guardadas.length} filas · ${r.fecha}`);
    } catch (err) {
      this.logger.error(
        `Snapshot diario falló: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Última cotización histórica de BD (prioridad para congelar cotización
   * en un movimiento cuando la API no responde).
   */
  async ultimaCotizacion(tipo: CotizacionTipoBlue = 'BLUE') {
    return this.prisma.cotizacionDolar.findFirst({
      where: { tipo },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    });
  }

  listHistoricas(desde?: Date, hasta?: Date, limit = 60) {
    return this.prisma.cotizacionDolar.findMany({
      where: {
        fecha: {
          gte: desde,
          lte: hasta,
        },
      },
      orderBy: [{ fecha: 'desc' }],
      take: limit,
    });
  }

  // ------- helpers privados -------

  private async fetchDolarapi(): Promise<CotizacionSnapshot | null> {
    const url = this.config.get<string>('DOLARAPI_URL') ?? 'https://dolarapi.com/v1/dolares/blue';
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        this.logger.warn(`dolarapi respondió ${res.status}`);
        return null;
      }
      const json = (await res.json()) as {
        compra?: number;
        venta?: number;
        fechaActualizacion?: string;
      };
      if (typeof json.venta !== 'number') return null;
      return {
        tipo: 'BLUE',
        fuente: FuenteCotizacion.DOLARAPI,
        compra: typeof json.compra === 'number' ? json.compra : json.venta,
        venta: json.venta,
        fecha: json.fechaActualizacion ?? new Date().toISOString(),
      };
    } catch (err) {
      this.logger.warn(
        `No se pudo traer dolarapi: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private async fetchAmbito(): Promise<CotizacionSnapshot | null> {
    const url =
      this.config.get<string>('AMBITO_URL') ??
      'https://mercados.ambito.com/dolar/informal/variacion';
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Sistema Cardi)',
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) {
        this.logger.warn(`Ámbito respondió ${res.status}`);
        return null;
      }
      const json = (await res.json()) as { compra?: string; venta?: string; fecha?: string };
      const venta = parseNumeroAr(json.venta);
      if (venta == null) return null;
      const compra = parseNumeroAr(json.compra) ?? venta;
      return {
        tipo: 'BLUE',
        fuente: FuenteCotizacion.AMBITO,
        compra,
        venta,
        fecha: json.fecha ?? new Date().toISOString(),
      };
    } catch (err) {
      this.logger.warn(
        `No se pudo traer Ámbito: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }
}

function parseNumeroAr(s: string | number | undefined | null): number | null {
  if (s == null) return null;
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const limpio = s.replace(/\./g, '').replace(',', '.').trim();
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}
