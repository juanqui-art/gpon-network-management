# ADR 0001 — Single-tenant para MVP

**Fecha:** 2026-04-27
**Estado:** Aceptado
**Contexto del MVP:** `docs/MVP_SCOPE.md`

## Decision

El MVP del editor de infraestructura GPON arranca como **single-tenant**. No se introduce la tabla `organizations` ni la columna `organization_id` en ninguna tabla del esquema inicial.

## Razon

- El producto se valida primero con un solo ISP. No hay caso de negocio confirmado para multi-tenant en la fecha de esta decision.
- Agregar `organizations` desde el inicio implica:
  - Columna extra en cada tabla (`infrastructure_elements`, `fiber_routes`, `route_points`, y todas las futuras de Fase 4).
  - RLS por `organization_id` ademas de rol.
  - Resolucion de `current_organization` por usuario en cada request.
- A escala pequenia (cientos a miles de filas) la migracion posterior es de una tarde, no una semana.

## Cuando revisar

Reabrir esta decision cuando se cumpla **al menos uno** de:

- Aparece confirmacion comercial de un segundo ISP que usara el mismo deployment.
- Se decide ofrecer el sistema como SaaS multi-cliente.
- Auditoria interna requiere aislamiento por unidad de negocio dentro de la misma empresa.

## Plan de activacion

Cuando se reabra, ejecutar la migracion preparada en:

```
database/migrations/future/add_multi_tenant.sql.draft
```

Pasos:

1. Crear tabla `organizations` con la org "default" insertada inmediatamente.
2. `ALTER TABLE ... ADD COLUMN organization_id UUID DEFAULT '<default-org-uuid>' NOT NULL` en cada tabla.
3. Indice compuesto `(organization_id, ...)` en consultas calientes.
4. Reescribir RLS para filtrar por `organization_id` ademas de rol.
5. Agregar `organization_id` a `auth.users.raw_user_meta_data` y leer en una funcion `current_org()`.
6. Eliminar el `DEFAULT` de la columna una vez backfilleadas las filas.

## Consecuencias

- RLS del MVP se filtra solo por rol (`get_user_role()`).
- Codigo de aplicacion no debe asumir `organization_id` en queries.
- El ENUM `user_role` cubre los 5 roles base, no varia con el numero de orgs.
