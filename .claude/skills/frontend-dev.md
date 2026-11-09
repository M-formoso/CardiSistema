# Frontend Developer Skill

Eres un experto desarrollador frontend especializado en el proyecto DevelopNet ERP.

## Tu Expertise

### Stack Técnico
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **Forms**: react-hook-form + Zod
- **State**: React Context + Hooks
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Lucide React

### Aplicaciones

1. **dashboard** - Panel principal (Vercel)
   - SuperAdmin: Gestión de organizaciones y sistemas
   - Cliente: Ver sistemas contratados y usarlos
   - AI Chat integrado con Tool Calling
   - Puerto: 5173 (desarrollo)
   - Deployment: Vercel

2. **web** - Landing page pública (Astro)
   - Información del producto
   - Registro de clientes

## Estructura del Dashboard

```
apps/dashboard/src/
├── pages/
│   ├── superadmin/
│   │   ├── Organizations.tsx
│   │   ├── SystemsPanel.tsx
│   │   └── Dashboard.tsx
│   ├── client/
│   │   ├── MySystemsCards.tsx
│   │   └── ClientDashboard.tsx
│   ├── billing/
│   │   ├── Invoices.tsx
│   │   ├── InvoiceDetail.tsx
│   │   └── CreateInvoice.tsx
│   ├── crm/
│   │   ├── Contacts.tsx
│   │   └── ContactDetail.tsx
│   ├── inventory/
│   │   ├── Products.tsx
│   │   ├── Warehouses.tsx
│   │   └── StockMovements.tsx
│   └── auth/
│       └── Login.tsx
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── Layout.tsx
│   └── shared/
│       ├── DataTable.tsx
│       ├── StatusBadge.tsx
│       └── ...
├── api/
│   ├── client.ts        # Axios/fetch instance
│   ├── invoices.ts
│   ├── contacts.ts
│   └── ...
├── contexts/
│   ├── AuthContext.tsx
│   ├── OrganizationContext.tsx
│   └── ThemeContext.tsx
├── lib/
│   ├── utils.ts
│   └── validations/
│       ├── invoice.ts
│       └── contact.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useInvoices.ts
│   └── ...
└── App.tsx
```

## Patrones del Proyecto

### 1. Componentes de Página

```tsx
// pages/billing/Invoices.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { invoicesApi } from '@/api/invoices';
import { DataTable } from '@/components/shared/DataTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    try {
      const data = await invoicesApi.getAll();
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  const columns = [
    { key: 'number', label: 'Número' },
    { key: 'contact.name', label: 'Cliente' },
    { key: 'total', label: 'Total', format: (v) => `$${v}` },
    { key: 'status', label: 'Estado', render: (row) => (
      <StatusBadge status={row.status} />
    )},
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Facturas</h1>
        <Button onClick={() => navigate('/invoices/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Factura
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        loading={loading}
      />
    </div>
  );
}
```

### 2. Formularios con react-hook-form + Zod

```tsx
// pages/billing/CreateInvoice.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';

const invoiceSchema = z.object({
  contactId: z.string().optional(),
  dueDate: z.date({ required_error: 'Requerido' }),
  items: z.array(z.object({
    description: z.string().min(1, 'Requerido'),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
  })).min(1, 'Agregar al menos un ítem'),
  notes: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

export function CreateInvoice() {
  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      items: [{ description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  async function onSubmit(data: InvoiceFormData) {
    try {
      await invoicesApi.create(data);
      toast.success('Factura creada');
      navigate('/invoices');
    } catch (error) {
      toast.error('Error al crear factura');
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Nueva Factura</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Vencimiento</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Items array */}
          <div className="space-y-4">
            <h3 className="font-semibold">Items</h3>
            {form.watch('items').map((_, index) => (
              <div key={index} className="grid grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name={`items.${index}.description`}
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormControl>
                        <Input placeholder="Descripción" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* quantity, unitPrice... */}
              </div>
            ))}
          </div>

          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? 'Creando...' : 'Crear Factura'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
```

### 3. Cliente API

```typescript
// api/client.ts
import axios from 'axios';

// Conexión directa al billing-service (Railway)
const API_URL = import.meta.env.VITE_API_URL || 'https://billing-production-xxxx.railway.app';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// api/invoices.ts
import { apiClient } from './client';

export const invoicesApi = {
  async getAll() {
    const { data } = await apiClient.get('/invoices');
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get(`/invoices/${id}`);
    return data;
  },

  async create(invoice: CreateInvoiceDto) {
    const { data } = await apiClient.post('/invoices', invoice);
    return data;
  },

  async update(id: string, invoice: UpdateInvoiceDto) {
    const { data } = await apiClient.patch(`/invoices/${id}`, invoice);
    return data;
  },

  async delete(id: string) {
    await apiClient.delete(`/invoices/${id}`);
  },
};
```

### 4. Auth Context

```tsx
// contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  organizationId: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Cargar usuario del localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  async function login(email: string, password: string) {
    const { data } = await apiClient.post('/auth/login', { email, password });
    setUser(data.user);
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }

  const isSuperAdmin = user?.role === 'ADMIN' && !user?.organizationId;

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isSuperAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

### 5. Componentes UI (shadcn/ui)

```tsx
// components/ui/button.tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
```

### 6. Renderizado Condicional por Rol

```tsx
// components/layout/Sidebar.tsx
import { useAuth } from '@/hooks/useAuth';

export function Sidebar() {
  const { user, isSuperAdmin } = useAuth();

  return (
    <aside className="w-64 bg-card border-r">
      <nav>
        {isSuperAdmin && (
          <>
            <NavItem to="/superadmin/dashboard" icon={LayoutDashboard}>
              Dashboard
            </NavItem>
            <NavItem to="/superadmin/organizations" icon={Building2}>
              Empresas
            </NavItem>
            <NavItem to="/superadmin/systems" icon={Package}>
              Panel de Sistemas
            </NavItem>
          </>
        )}

        {user?.organizationId && (
          <>
            <NavItem to="/client/systems" icon={Grid}>
              Mis Sistemas
            </NavItem>
            <NavItem to="/billing/invoices" icon={FileText}>
              Facturación
            </NavItem>
            <NavItem to="/crm/contacts" icon={Users}>
              CRM
            </NavItem>
          </>
        )}
      </nav>
    </aside>
  );
}
```

## Componentes Reutilizables

### DataTable Component

```tsx
// components/shared/DataTable.tsx
interface Column {
  key: string;
  label: string;
  format?: (value: any) => string;
  render?: (row: any) => ReactNode;
}

interface DataTableProps {
  columns: Column[];
  data: any[];
  loading?: boolean;
  onRowClick?: (row: any) => void;
}

export function DataTable({ columns, data, loading, onRowClick }: DataTableProps) {
  if (loading) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            {columns.map(col => (
              <th key={col.key} className="px-4 py-3 text-left font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              onClick={() => onRowClick?.(row)}
              className="border-b hover:bg-muted/50 cursor-pointer"
            >
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3">
                  {col.render
                    ? col.render(row)
                    : col.format
                      ? col.format(row[col.key])
                      : row[col.key]
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## Mejores Prácticas

1. **Tipado**: Siempre usar TypeScript con tipos explícitos
2. **Validación**: Zod para validar formularios
3. **UI**: shadcn/ui para componentes base
4. **Estilos**: Tailwind CSS con design system (CSS variables)
5. **Routing**: React Router v6 con protección de rutas
6. **Estado**: Context API para global, useState para local
7. **Loading**: Mostrar estados de carga
8. **Errores**: Mostrar mensajes de error con toast/alert
9. **Accesibilidad**: Usar componentes Radix UI (accesibles)

## Comandos

```bash
# Desarrollo
pnpm --filter dashboard dev

# Build
pnpm --filter dashboard build

# Lint
pnpm --filter dashboard lint

# Type check
pnpm --filter dashboard type-check
```

## Recursos

- **Tailwind CSS**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com
- **React Hook Form**: https://react-hook-form.com
- **Zod**: https://zod.dev
- **Recharts**: https://recharts.org

---

Cuando recibas una tarea de frontend:
1. Identifica la aplicación (dashboard o web)
2. Determina el módulo/página afectada
3. Valida permisos por rol
4. Usa componentes shadcn/ui
5. Implementa formularios con validación Zod
6. Prueba en el navegador
