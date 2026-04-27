# Investigacion de roles operativos para GPON

## Objetivo

Documentar los hallazgos externos sobre roles reales en operadores FTTH/GPON y traducirlos a decisiones de producto, datos y permisos para el sistema.

Este documento complementa:

```txt
docs/OPERATIONAL_ROLES.md
docs/INFRASTRUCTURE_EDITOR_PLAN.md
ANALISIS_TECNICO.md
```

## Hallazgo principal

El sistema no debe modelar un unico rol generico llamado `technician`.

En una operacion real de fibra/telecom, las responsabilidades se reparten entre perfiles distintos:

```txt
Ingenieria de red
Planta externa
Construccion / empalme / as-built
Instalacion FTTH
NOC / soporte operativo
Administracion / gobierno
```

Para el MVP conviene usar pocos roles base, pero con nombres claros y extensibles.

## Fuentes consultadas

### Seguridad y autorizacion

- Supabase Row Level Security:
  https://supabase.com/docs/guides/database/postgres/row-level-security
- PostgreSQL Row Security Policies:
  https://www.postgresql.org/docs/15/ddl-rowsecurity.html
- NIST RBAC:
  https://www.nist.gov/publications/role-based-access-control-rbac-features-and-motivations
- OWASP Least Privilege:
  https://owasp.org/www-community/controls/Least_Privilege_Principle

### OSS/BSS y procesos telecom

- Microsoft OSS/BSS:
  https://www.microsoft.com/en-us/ai/telecommunications/resources/discover-oss-bss-solutions
- TM Forum eTOM:
  https://www.tmforum.org/oda/process-framework-etom/
- TM Forum Open API Conformance:
  https://www.tmforum.org/oda/conformance/open-api-conformance/
- TMF621 Trouble Ticket Management:
  https://www.tmforum.org/resources/specifications/tmf621-trouble-ticket-management-api-rest-specification-r19-0-0/

### Roles y operacion de fibra

- Outside Plant Engineer:
  https://www.fieldengineer.com/skills/outside-plant-engineer
- Outside Plant Technician:
  https://jobs.faahq.org/career/outside-plant-technician
- OSP Telecom Engineer:
  https://pactelsolutions.net/outside-plant-osp-telecom-engineer/
- Fiber Technician OSP:
  https://jobs.broadbandnation.org/job/426376/fiber-technician-osp/
- FTTH Installation:
  https://www.thefoa.org/tech/ref/appln/FTTH-install.html
- Fiber Drop Installation:
  https://dgtlinfra.com/fiber-optic-cable-installation-process/
- NOC Technician:
  https://mycellularone.com/careers/noc-technician/
- Telecom NOC / Trouble Ticketing:
  https://tacira.net/assurance/services/network-operational-center.html
- Fiber As-Built Documentation:
  https://draftech.com/services/as-built-documentation.html
- Telecom Field Operations:
  https://www.esri.com/en-us/industries/telecommunications/initiatives/field-operations
- Network Manager Telecom:
  https://www.iqgeo.com/product/network-manager-telecom

## Roles reales encontrados

### OSP Engineer / Outside Plant Engineer

Responsable de diseno, planificacion y documentacion de la planta externa.

Actividades tipicas:

```txt
Disenar rutas de fibra
Definir arquitectura ODN
Preparar planos y documentacion
Coordinar permisos y construccion
Validar as-built
Revisar capacidad, costos y expansion
```

En el sistema se traduce mejor como:

```txt
network_engineer
```

### OSP Technician / Fiber Technician / Splicer

Responsable de trabajo fisico en planta externa.

Actividades tipicas:

```txt
Instalar y mantener fibra
Empalmar cables
Trabajar con cierres y reservas
Probar con OTDR o medidores
Reportar desviaciones de campo
Actualizar documentacion fisica
```

En el sistema se traduce mejor como:

```txt
outside_plant
```

### FTTH Installer / Premises Technician

Responsable de conectar al cliente final.

Actividades tipicas:

```txt
Instalar drop/acometida
Seleccionar punto de acceso o NAP real
Conectar ONT/NID/router
Registrar serial de ONT
Medir potencia optica
Confirmar ubicacion del cliente
Subir evidencia de instalacion
```

En el sistema se traduce mejor como:

```txt
installer
```

### NOC Technician / Network Operations

Responsable de monitoreo, alarmas, incidentes y coordinacion operativa.

Actividades tipicas:

```txt
Monitorear red
Responder alarmas
Abrir y actualizar tickets
Coordinar con campo
Escalar problemas
Confirmar restauracion de servicio
```

En el sistema se traduce mejor como:

```txt
support
```

### GIS / Network Inventory / As-built Specialist

Responsable de mantener el mapa y los registros reales de red.

Actividades tipicas:

```txt
Mantener inventario GIS
Actualizar rutas reales
Registrar splice records
Reconciliar diseno vs construido
Controlar calidad de datos
```

Para el MVP puede ser una capacidad de `network_engineer` o `admin`.
En el futuro podria convertirse en rol separado:

```txt
gis_inventory
```

### Administrator / Engineering Governance

Responsable de gobierno, auditoria, usuarios, roles y reglas del sistema.

Actividades tipicas:

```txt
Gestionar usuarios y roles
Ver auditoria
Configurar catalogos
Validar cambios criticos
Definir politicas internas
Administrar calidad de datos
```

En el sistema se traduce mejor como:

```txt
admin
```

## Roles recomendados para el sistema

Desde cero, los roles base recomendados son:

```txt
admin
network_engineer
outside_plant
installer
support
```

No se recomienda usar:

```txt
technician
```

porque mezcla planta externa, instalacion, soporte y conocimiento comercial en un solo perfil.

## Nombres visibles en UI

```txt
admin              -> Administrador
network_engineer   -> Ingenieria de red
outside_plant      -> Planta externa
installer          -> Instalador
support            -> Soporte / operaciones
```

## Decision de autorizacion

Los roles de autorizacion no deben guardarse en:

```txt
auth.users.raw_user_meta_data
```

Supabase advierte que `raw_user_meta_data` puede ser actualizado por el usuario autenticado. Para autorizacion, la opcion correcta es:

```txt
auth.users.raw_app_meta_data.role
```

La funcion SQL de rol debe leer desde:

```sql
auth.jwt() -> 'app_metadata' ->> 'role'
```

## Modelo RBAC recomendado

RBAC debe basarse en:

```txt
Usuario -> Rol -> Capacidades -> Acciones sobre recursos
```

No conviene asignar permisos sueltos directamente a cada usuario como primera opcion.

Las capacidades internas sugeridas son:

```txt
manage_users
manage_network_design
edit_outside_plant
approve_network_changes
edit_installations
manage_incidents
view_customers
manage_commercial
view_audit
view_data_quality
```

## Matriz inicial de permisos

### admin

Puede:

```txt
Gestionar usuarios y roles
Crear, editar y eliminar infraestructura
Gestionar clientes, servicios y planes
Ver auditoria
Configurar catalogos
Ver y corregir calidad de datos
Gestionar incidentes
```

### network_engineer

Puede:

```txt
Crear y editar OLTs
Crear y editar puertos PON
Crear y editar splitters
Crear y editar NAPs
Dibujar y corregir rutas feeder/distribution
Validar cambios de planta externa
Ver capacidad y presupuesto optico
Ver calidad de datos
Crear o actualizar incidentes tecnicos
```

No deberia poder por defecto:

```txt
Gestionar usuarios
Modificar facturacion
Cambiar precios o contratos
Eliminar clientes comerciales
```

### outside_plant

Puede:

```txt
Crear y editar infraestructura fisica
Corregir ubicaciones de OLT, splitter, NAP y rutas
Marcar cruces, reservas y empalmes
Registrar observaciones de campo
Actualizar datos as-built
Crear incidentes tecnicos
```

No deberia poder por defecto:

```txt
Cambiar planes comerciales
Editar contratos
Administrar usuarios
Modificar facturacion
Editar datos comerciales del cliente
```

### installer

Puede:

```txt
Ver infraestructura existente
Ver ordenes o instalaciones asignadas
Seleccionar NAP usada
Asignar puerto de NAP
Registrar ONT
Registrar serial/modelo de ONT
Registrar potencia optica
Capturar ubicacion GPS del cliente
Dibujar o confirmar drop/acometida
Subir evidencia
Agregar notas tecnicas de instalacion
Completar instalacion
Crear incidentes tecnicos
```

No deberia poder por defecto:

```txt
Editar OLTs
Editar splitters
Editar rutas feeder/distribution
Cambiar capacidad de NAPs
Crear o eliminar clientes comerciales
Cambiar planes, precios o contratos
Administrar usuarios
```

### support

Puede:

```txt
Buscar clientes
Ver estado del servicio
Ver ONT, NAP y afectaciones relacionadas
Crear incidentes
Actualizar estado y notas de incidentes
Consultar infraestructura en modo lectura
```

No deberia poder por defecto:

```txt
Editar infraestructura
Asignar puertos NAP
Registrar instalaciones
Modificar presupuesto optico
Cambiar planes o facturacion
Eliminar elementos de red
Administrar usuarios
```

## Separacion OSS/BSS

La investigacion confirma que conviene separar:

```txt
OSS: red, inventario, provision, incidentes, alarmas, calidad operacional
BSS: clientes, productos, contratos, facturacion, pagos
```

Aplicado al sistema:

```txt
Infraestructura y red       -> OSS
Instalaciones y ONTs        -> OSS / fulfillment
Incidentes y afectaciones   -> OSS / assurance
Clientes y servicios        -> BSS + OSS compartido
Planes, precios, contratos  -> BSS
Usuarios, roles, auditoria  -> gobierno
```

## Implicacion para el modelo de datos

No conviene mezclar datos comerciales y tecnicos en una misma tabla si roles distintos deben escribir partes distintas.

Evitar una tabla `customers` con todos estos campos mezclados:

```txt
full_name
id_number
plan_id
price
address_reference
location
nap_id
nap_port_id
installation_notes
technical_notes
```

Mejor separar dominios:

```txt
customers
customer_contacts
service_plans
services
installations
installation_measurements
installation_evidence
equipment
equipment_ports
network_connections
incidents
audit_log
```

Esto permite que `installer` escriba en instalaciones sin tener permiso amplio sobre datos comerciales.

## Recomendacion de RLS

Todas las tablas expuestas en `public` deben tener RLS activo desde la primera migracion.

La estrategia base:

```txt
Default deny.
SELECT explicito por dominio.
INSERT/UPDATE/DELETE segun rol y capacidad.
DELETE muy restringido.
Auditoria para cambios criticos.
```

Funciones SQL sugeridas:

```sql
current_app_role()
has_role(text[])
is_admin()
can_manage_network_design()
can_edit_outside_plant()
can_edit_installations()
can_manage_incidents()
can_view_customers()
can_manage_commercial()
can_view_audit()
```

## Decision de producto

La UI debe adaptarse al rol, pero no ser la barrera principal de seguridad.

```txt
UI: reduce errores y simplifica experiencia.
RLS: garantiza seguridad real.
Auditoria: permite trazabilidad y gobierno.
```

## Recomendacion final

Para construir desde cero:

```txt
1. Rehacer migraciones con roles operativos desde el inicio.
2. Guardar rol en raw_app_meta_data.
3. Separar modelo OSS/BSS.
4. Crear tablas tecnicas para instalaciones.
5. Activar RLS en todas las tablas publicas.
6. Crear helpers SQL de rol/capacidad.
7. Adaptar UI por modo operativo.
8. Agregar auditoria para cambios de red, servicio e incidentes.
```

