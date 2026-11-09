# Reglas de Git — Sistema Cardi

## IMPORTANTE: Leer antes de cualquier push

### Flujo obligatorio

```
develop  ──────────────────►  main (producción)
   │                              │
   │  Todos los cambios           │  SOLO con confirmación
   │  van aquí primero            │  explícita de Mateo
   │                              │
   └──────────────────────────────┘
```

### Reglas

1. **SIEMPRE hacer push a `develop` primero**
   ```bash
   git push origin develop
   ```
   Mateo prueba en staging y después se mergea. **Pushear y mergear no van en el mismo turno.**

2. **NUNCA hacer push/merge a `main` sin permiso explícito**
   - Antes de tocar `main`, PREGUNTAR:
     - "¿Querés que haga el merge/PR a main?"
     - "¿Paso los cambios a producción?"
   - Solo proceder con confirmación explícita ("sí", "dale", "ok").

3. **Build local obligatorio antes de cada push**
   ```bash
   pnpm build && pnpm type-check && pnpm lint && pnpm test
   ```

4. **Commits en español, chicos y descriptivos.** Un commit = un cambio lógico.

5. **Worktrees (Orca): crearlos fuera de `/tmp`** (los procesos de macOS los limpian).

### Railway (Deployments)

| Rama | Ambiente | Proyecto Railway |
|------|----------|------------------|
| `main` | Producción | sistemaCardi (prod) |
| `develop` | Staging | sistemaCardi (staging) |

### Proceso para producción

1. Cambios en `develop`.
2. Mateo prueba en staging.
3. Mateo confirma.
4. Merge a `main` y push.
5. Verificar deploy en Railway.

### Comandos

```bash
# Siempre seguro
git add <archivos específicos>
git commit -m "mensaje descriptivo"
git push origin develop

# REQUIERE CONFIRMACIÓN DE MATEO
git checkout main
git merge develop
git push origin main
```

### Qué NO hacer

- `git push --force` a `main` o `develop` sin OK.
- `git commit -A` o `git add .` sin revisar qué se stagea (hay `migracion/originales/` con datos sensibles del cliente).
- `--no-verify` para saltar hooks sin OK.
- Amendar commits ya pusheados.
- Commitear `.env`, `uploads/`, `migracion/originales/` ni ningún archivo con datos reales del cliente.
