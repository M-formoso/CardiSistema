import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Key, Loader2, Plus, Power, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  usuariosService,
  type CreateUsuarioInput,
  type Rol,
  type Usuario,
} from '@/services/usuariosService';
import { formatearFechaHora } from '@/lib/formatters';

const ROL_VARIANTE: Record<Rol, 'default' | 'success' | 'muted'> = {
  ADMIN: 'default',
  CARGA: 'success',
  CONSULTA: 'muted',
};

const ROL_DESC: Record<Rol, string> = {
  ADMIN: 'Acceso total, incluye gestión de usuarios',
  CARGA: 'Puede cargar movimientos, cheques, liquidaciones, etc.',
  CONSULTA: 'Solo lectura — ve datos pero no modifica',
};

export function UsuariosPage() {
  const qc = useQueryClient();
  const [openNuevo, setOpenNuevo] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [reseteando, setReseteando] = useState<Usuario | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => usuariosService.list(),
  });

  const toggleActivoMut = useMutation({
    mutationFn: (u: Usuario) =>
      u.activo ? usuariosService.desactivar(u.id) : usuariosService.activar(u.id),
    onSuccess: () => {
      toast.success('Estado actualizado');
      qc.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo cambiar',
      ),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted">Quién puede entrar al sistema y con qué nivel.</p>
        </div>
        <Button onClick={() => setOpenNuevo(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nuevo usuario
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último cambio</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted py-8">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && list.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted py-8">
                  Sin usuarios.
                </TableCell>
              </TableRow>
            )}
            {list.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs">{u.username}</TableCell>
                <TableCell className="font-medium">{u.nombre}</TableCell>
                <TableCell className="text-xs text-muted">{u.email ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={ROL_VARIANTE[u.rol]}>{u.rol}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.activo ? 'success' : 'muted'}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted">
                  {formatearFechaHora(u.updatedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar"
                      onClick={() => setEditando(u)}
                    >
                      <UserCog className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Resetear contraseña"
                      onClick={() => setReseteando(u)}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={u.activo ? 'Desactivar' : 'Activar'}
                      onClick={() => {
                        if (
                          u.activo &&
                          !confirm(`¿Desactivar al usuario "${u.username}"?`)
                        )
                          return;
                        toggleActivoMut.mutate(u);
                      }}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NuevoUsuarioDialog
        open={openNuevo}
        onOpenChange={setOpenNuevo}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ['usuarios'] });
          setOpenNuevo(false);
        }}
      />
      {editando && (
        <EditarUsuarioDialog
          usuario={editando}
          onClose={() => setEditando(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['usuarios'] });
            setEditando(null);
          }}
        />
      )}
      {reseteando && (
        <ResetPasswordDialog
          usuario={reseteando}
          onClose={() => setReseteando(null)}
          onDone={() => setReseteando(null)}
        />
      )}
    </div>
  );
}

// ======================================================================

function NuevoUsuarioDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [username, setUsername] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Rol>('CARGA');
  const [password, setPassword] = useState('');

  const m = useMutation({
    mutationFn: () => {
      const input: CreateUsuarioInput = {
        username: username.trim().toLowerCase(),
        nombre: nombre.trim(),
        email: email.trim() || undefined,
        rol,
        password,
      };
      return usuariosService.create(input);
    },
    onSuccess: () => {
      toast.success(`Usuario "${username}" creado — ya puede ingresar`);
      setUsername('');
      setNombre('');
      setEmail('');
      setRol('CARGA');
      setPassword('');
      onCreated();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo crear',
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            Elegí el username y una contraseña inicial. Avisale al usuario para que la cambie en su
            primer login.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!username.trim() || !nombre.trim() || password.length < 8) {
              return toast.error('Username, nombre y contraseña (mín. 8) son obligatorios');
            }
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Usuario *</Label>
              <Input
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))
                }
                placeholder="dani"
                autoCapitalize="none"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Rol *</Label>
              <Select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
                <option value="ADMIN">ADMIN</option>
                <option value="CARGA">CARGA</option>
                <option value="CONSULTA">CONSULTA</option>
              </Select>
              <p className="text-[11px] text-muted">{ROL_DESC[rol]}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nombre completo *</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Daniela Pérez"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Email (opcional)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dani@cardi.local"
            />
          </div>
          <div className="space-y-2">
            <Label>Contraseña inicial *</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 8 caracteres"
              minLength={8}
              required
            />
            <p className="text-[11px] text-muted">
              Compartila con el usuario de forma segura. Debería cambiarla en su primer login.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ======================================================================

function EditarUsuarioDialog({
  usuario,
  onClose,
  onSaved,
}: {
  usuario: Usuario;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [email, setEmail] = useState(usuario.email ?? '');
  const [rol, setRol] = useState<Rol>(usuario.rol);

  const m = useMutation({
    mutationFn: () =>
      usuariosService.update(usuario.id, {
        nombre: nombre.trim(),
        email: email.trim() || null,
        rol,
      }),
    onSuccess: () => {
      toast.success('Usuario actualizado');
      onSaved();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{usuario.username}</span> — el username no se puede cambiar.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Nombre completo *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <Select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
              <option value="ADMIN">ADMIN</option>
              <option value="CARGA">CARGA</option>
              <option value="CONSULTA">CONSULTA</option>
            </Select>
            <p className="text-[11px] text-muted">{ROL_DESC[rol]}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ======================================================================

function ResetPasswordDialog({
  usuario,
  onClose,
  onDone,
}: {
  usuario: Usuario;
  onClose: () => void;
  onDone: () => void;
}) {
  const [password, setPassword] = useState('');

  const m = useMutation({
    mutationFn: () => usuariosService.resetPassword(usuario.id, password),
    onSuccess: () => {
      toast.success(
        `Contraseña reseteada. Avisale a ${usuario.nombre} para que ingrese con la nueva.`,
      );
      onDone();
    },
    onError: (e) =>
      toast.error(
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
          'No se pudo',
      ),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetear contraseña</DialogTitle>
          <DialogDescription>
            Asignále una nueva contraseña a <span className="font-mono">{usuario.username}</span>.
            Las sesiones activas se cierran automáticamente.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (password.length < 8) return toast.error('Mínimo 8 caracteres');
            m.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 8 caracteres"
              minLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resetear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
