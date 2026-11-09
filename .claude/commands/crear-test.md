# Crear Tests

Crea tests para AgroFácil usando Jest (backend NestJS) o Vitest (frontend React).

## Parámetros
- **$ARGUMENTS**: Módulo o componente a testear (ej: `"calculos.service"`, `"LoteForm"`)

---

## Backend (Jest + Supertest)

### Estructura
```
backend/src/modules/{modulo}/tests/
├── {modulo}.service.spec.ts     # Unit con PrismaService mockeado
└── {modulo}.controller.spec.ts  # E2E con Postgres de test

backend/test/
├── jest-e2e.json
└── setup-e2e.ts                 # base de datos de test
```

### Unit test de Service

```typescript
// src/modules/lotes/tests/lotes.service.spec.ts
import { Test } from '@nestjs/testing';
import { LotesService } from '../lotes.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Logger } from 'nestjs-pino';

describe('LotesService', () => {
  let service: LotesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LotesService,
        {
          provide: PrismaService,
          useValue: {
            lote: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation((arr) => Promise.all(arr)),
          },
        },
        { provide: Logger, useValue: { log: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    service = module.get(LotesService);
    prisma = module.get(PrismaService);
  });

  describe('crear', () => {
    it('crea un lote con cuentaId del contexto', async () => {
      (prisma.lote.create as jest.Mock).mockResolvedValue({ id: 'uuid-1', nombre: 'Lote 4', superficieHa: 80 });

      const result = await service.crear({ nombre: 'Lote 4', superficieHa: 80, establecimientoId: 'est-1' }, 'user-1');

      expect(result.id).toBe('uuid-1');
      expect(prisma.lote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ nombre: 'Lote 4', superficieHa: 80 }),
      });
    });
  });

  describe('obtenerPorId', () => {
    it('lanza NotFoundException si el lote no existe', async () => {
      (prisma.lote.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.obtenerPorId('no-existe')).rejects.toThrow('Lote no-existe no encontrado');
    });
  });
});
```

### Test del módulo de cálculos (el corazón del producto)

```typescript
// src/modules/calculos/tests/calculos.service.spec.ts
import { CalculosService } from '../calculos.service';
import Decimal from 'decimal.js';

describe('CalculosService', () => {
  const service = new CalculosService();

  describe('punto de equilibrio', () => {
    it('calcula el rinde de indiferencia en qq/ha', () => {
      // costo_total_ha = 800 USD/ha, precio = 30 USD/tn => 3 USD/qq
      // rinde_equilibrio = 800 / 3 = 266.67 qq/ha
      const resultado = service.calcularPuntoEquilibrio({
        costoTotalHa: new Decimal(800),
        precioUsdTn: new Decimal(30),
      });
      expect(resultado.toDecimalPlaces(2).toNumber()).toBeCloseTo(266.67, 2);
    });
  });

  describe('agregaciones', () => {
    it('NO promedia promedios — recalcula sobre superficie agregada', () => {
      // Lote A: 100 ha, margen total 30000 -> 300 USD/ha
      // Lote B: 200 ha, margen total 80000 -> 400 USD/ha
      // Promedio incorrecto: (300+400)/2 = 350
      // Correcto: (30000+80000) / (100+200) = 366.67
      const resultado = service.agregar([
        { superficieHa: new Decimal(100), margenNeto: new Decimal(30000) },
        { superficieHa: new Decimal(200), margenNeto: new Decimal(80000) },
      ]);
      expect(resultado.margenNetoHa.toDecimalPlaces(2).toNumber()).toBeCloseTo(366.67, 2);
    });
  });
});
```

### E2E del Controller

```typescript
// test/lotes.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('LotesController (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'test@agrofacil.dev', password: 'test123' });
    token = login.body.accessToken;
  });

  it('GET /lotes requiere auth', () => request(app.getHttpServer()).get('/api/v1/lotes').expect(401));

  it('POST /lotes crea un lote', () =>
    request(app.getHttpServer())
      .post('/api/v1/lotes')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Lote 1', superficieHa: 80, establecimientoId: 'uuid-establecimiento' })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
        expect(res.body.nombre).toBe('Lote 1');
      }));

  it('aísla por tenant: otra cuenta no ve mis lotes', async () => {
    const otroLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'otra@agrofacil.dev', password: 'test123' });

    const res = await request(app.getHttpServer())
      .get('/api/v1/lotes')
      .set('Authorization', `Bearer ${otroLogin.body.accessToken}`);

    expect(res.body.items).toHaveLength(0);
  });

  afterAll(async () => await app.close());
});
```

---

## Frontend (Vitest + Testing Library)

### Setup

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react
```

### `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

### Test de Componente

```typescript
// src/components/lotes/__tests__/LoteForm.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { LoteForm } from '../LoteForm';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <BrowserRouter>{children}</BrowserRouter>
  </QueryClientProvider>
);

describe('LoteForm', () => {
  it('valida que la superficie sea > 0', async () => {
    render(<LoteForm mode="crear" />, { wrapper });

    await userEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(screen.getByText(/debe ser mayor a 0/i)).toBeInTheDocument();
    });
  });
});
```

### Test de utils (cálculos)

```typescript
// src/utils/__tests__/formatters.test.ts
import { describe, it, expect } from 'vitest';
import { formatearQqHa, formatearUsd, precioUsdPorQq } from '../formatters';

describe('formatters', () => {
  it('formatea qq/ha con separador AR', () => {
    expect(formatearQqHa(45.7)).toBe('45,7 qq/ha');
  });

  it('formatea USD con separador AR', () => {
    expect(formatearUsd(12345.67)).toMatch(/12\.345,67/);
  });

  it('precioUsdPorQq = precio_usd_tn / 10', () => {
    expect(precioUsdPorQq(30)).toBe(3);
  });
});
```

---

## Comandos

```bash
# Backend
cd backend
npm run test                    # unit tests
npm run test:e2e                # e2e con Supertest
npm run test:cov                # cobertura
npm run test -- lotes           # filtrar por nombre

# Frontend
cd frontend
npm run test                    # vitest watch
npm run test -- --run           # vitest sin watch
npm run test:cov
```

## Tests obligatorios en AgroFácil
- ✅ Toda fórmula de `calculos.service` (punto de equilibrio, margen, agregaciones) tiene test con casos numéricos verificados a mano.
- ✅ Todo endpoint con cambio de estado tiene test e2e que valida tenant isolation.
- ✅ El parser de voz/foto tiene tests con audios/textos de ejemplo (mockeando la API de Claude).

## Ejemplo de uso
```
/crear-test calculos.service
/crear-test LoteForm
/crear-test ia-carga.service
```
