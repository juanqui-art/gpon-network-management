# AGENTS.md

La documentación del proyecto para agentes vive en **[`CLAUDE.md`](CLAUDE.md)** — léelo completo antes de cambiar código.
Este archivo existe solo para herramientas que buscan `AGENTS.md`; no dupliques contenido aquí (se desincroniza).

Reglas que no se pueden pasar por alto:

- **Next.js 16** (`apps/web`): `proxy.ts`, no `middleware.ts`; `await` en `cookies()`, `headers()` y `params`. Lee `apps/web/node_modules/next/dist/docs/` antes de escribir código Next.js (ver `apps/web/AGENTS.md`).
- **Roles**: el rol se lee de `auth.users.app_metadata.role`. Nunca de `raw_user_meta_data` (el usuario puede editarlo → escalada de privilegios).
- **RLS es la capa de autorización**: los RPCs de escritura son `SECURITY INVOKER`. No los cambies a `SECURITY DEFINER` sin chequear el rol explícitamente dentro.
- **Service keys** (`SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_KEY`): solo en server o en el colector, nunca en código cliente.
- **Migraciones**: el repo no reconstruye la BD todavía (falta `networks`). Ver la advertencia en `CLAUDE.md` § Base de datos.
- **Lint/format**: Biome (`pnpm check`), no ESLint ni Prettier. Gestor: pnpm.
