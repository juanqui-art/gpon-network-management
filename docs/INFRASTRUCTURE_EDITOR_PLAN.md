# Plan del Editor de Infraestructura GPON

## Alcance MVP cerrado

El alcance MVP vigente esta documentado en:

```txt
docs/MVP_SCOPE.md
```

La especificacion de UI/UX del editor esta documentada en:

```txt
docs/EDITOR_UI_UX_SPEC.md
```

Ese documento define que la primera entrega se limita al editor de
infraestructura: OLT, splitters, NAPs, rutas feeder/distribution, cruces,
reservas, empalmes, calidad de datos y advertencias no bloqueantes.

## Objetivo

Construir una herramienta visual para que un ISP pueda levantar, corregir y operar su red GPON aunque la informacion inicial este incompleta.

La vision del producto es un editor tipo mapa/canvas: similar en fluidez a Figma, pero orientado a red GPON, planta externa, capacidad y presupuesto optico.

## Principio central

```txt
Dibujar primero.
Pedir pocos datos.
Conectar automaticamente cuando sea posible.
Permitir aproximaciones.
Corregir despues.
Mostrar advertencias sin bloquear.
```

El sistema no debe exigir una red perfecta desde el inicio. Debe permitir madurar la informacion con el trabajo operativo diario.

## Separacion del producto

### 1. Infraestructura

Red fisica conocida o aproximada por el tecnico.

Elementos esenciales:

```txt
OLT
Puerto PON
Splitter
NAP
Ruta de fibra
```

Puntos relevantes sobre rutas:

```txt
Cruce de avenida
Reserva de cable
Empalme
```

Elementos no obligatorios en MVP:

```txt
Postes
Camaras
Zonas de cobertura exactas
```

Estos pueden existir en el futuro, pero no deben ser requisito para documentar la red.

### 2. Distribucion

Capa que conecta clientes a la infraestructura.

```txt
Clientes
Servicios
ONTs
Puertos de NAP
Acometidas/drop
Ubicacion del cliente
```

Un cliente puede existir sin ubicacion exacta, sin NAP conocida o sin puerto asignado.

### 3. Calidad de datos

Cada dato critico debe tener nivel de confianza.

Ubicacion:

```txt
unknown
approximate
gps_captured
verified
```

Ruta:

```txt
approximate
field_drawn
gps_captured
verified
```

Asignacion de cliente:

```txt
unassigned
zone_assigned
nap_assigned
port_assigned
drop_mapped
verified
```

## Flujo UX del editor

### Pantalla principal

```txt
Barra superior: proyecto, busqueda, modo, usuario
Toolbar: herramientas de creacion
Panel izquierdo: capas y listado
Mapa central: lienzo principal
Panel derecho: propiedades contextuales
Barra inferior: instrucciones y advertencias
```

El tecnico debe permanecer en el mapa. Los formularios largos y modales deben evitarse.

### Herramientas iniciales

```txt
Seleccionar
Mover mapa
Crear OLT
Crear splitter
Crear NAP
Dibujar fibra
Marcar cruce
Marcar reserva
Marcar empalme
Medir distancia
Eliminar
```

### Crear OLT, splitter o NAP

```txt
1. Seleccionar herramienta.
2. Click en mapa.
3. Crear elemento provisional.
4. Abrir panel derecho.
5. Pedir datos minimos.
6. Guardar y seguir trabajando.
```

Datos minimos:

```txt
OLT: codigo/nombre, estado, ubicacion, calidad de ubicacion, total de puertos PON.
Splitter: codigo, ratio, perdida de insercion, estado, calidad de ubicacion.
NAP: codigo, total de puertos, estado, calidad de ubicacion.
```

La herramienta debe permitir creacion repetida, especialmente para NAPs:

```txt
Click -> NAP-001
Click -> NAP-002
Click -> NAP-003
Esc -> salir
```

### Dibujar rutas de fibra

```txt
1. Seleccionar Dibujar fibra.
2. Click en elemento origen.
3. Clicks intermedios siguiendo la ruta aproximada.
4. Click en elemento destino.
5. Sistema calcula longitud.
6. Sistema sugiere tipo.
7. Usuario confirma datos minimos.
```

La ruta debe guardar:

```txt
Geometria
Conectividad
Datos tecnicos
Calidad del dato
```

Tipos iniciales:

```txt
feeder
distribution
other
```

`drop` entra en la fase de distribucion de clientes.

### Cruces, reservas y empalmes

Estos puntos siempre deben estar asociados a una ruta de fibra.

```txt
1. Seleccionar ruta.
2. Agregar punto relevante.
3. Elegir cruce, reserva o empalme.
4. Click sobre la ruta.
5. El sistema ajusta el punto a la ruta.
6. Completar dato minimo.
```

Datos por tipo:

```txt
Cruce: referencia, tipo de cruce, riesgo, observacion.
Reserva: longitud aproximada, estado, observacion.
Empalme: codigo, estado, perdida estimada, observacion.
```

## Validaciones

La validacion debe tener tres niveles.

### Bloqueante

Solo para errores que rompen el modelo.

```txt
Ruta sin geometria.
Elemento sin tipo.
Punto relevante sin ruta asociada.
```

### Advertencia

Datos incompletos o conexiones poco comunes.

```txt
NAP sin capacidad.
Splitter sin ratio.
Ruta sin origen o destino.
OLT sin puertos PON definidos.
Conexion NAP -> NAP.
Ruta muy larga.
```

### Informativa

Calidad o madurez del dato.

```txt
Ubicacion aproximada.
Ruta no verificada.
Reserva sin longitud.
Empalme sin detalle tecnico.
```

Regla:

```txt
El sistema no castiga la informacion incompleta.
La registra, la marca y ayuda a mejorarla.
```

## Modelo de datos propuesto

Como el proyecto es nuevo y la data actual es de prueba, se recomienda redisenar la base de datos ahora.

### organizations

```txt
id
name
slug
created_at
updated_at
```

### infrastructure_elements

Tabla principal para OLT, splitter y NAP.

```txt
id
organization_id
type
code
name
status
location
location_quality

pon_standard
total_pon_ports

split_ratio
insertion_loss_db

total_ports

properties
notes
created_by
updated_by
created_at
updated_at
```

Datos tecnicos como `split_ratio`, `insertion_loss_db`, `total_pon_ports` y `total_ports` deben ser columnas reales porque participan en calculos, filtros y validaciones.

### fiber_routes

Tabla para rutas dibujadas y conexiones tecnicas.

```txt
id
organization_id
code
type
status
from_element_id
to_element_id
geometry
route_quality
installation_type
fiber_type
fiber_count
length_meters
attenuation_db_per_km
connector_loss_db
splice_loss_db
total_loss_db
properties
notes
created_by
updated_by
created_at
updated_at
```

`from_element_id` y `to_element_id` pueden ser NULL para permitir rutas incompletas o aproximadas.

### route_points

Tabla para cruces, reservas y empalmes.

```txt
id
organization_id
fiber_route_id
type
code
status
location
location_quality
position_on_route_m
reserve_length_m
splice_loss_db
crossing_type
risk_level
properties
notes
created_by
updated_by
created_at
updated_at
```

`fiber_route_id` debe ser obligatorio.

### Distribucion futura

```txt
customers
service_plans
services
nap_ports
onts
drop_routes
```

`drop_routes` puede modelarse como `fiber_routes.type = 'drop'`.

## Presupuesto optico

El analisis tecnico del proyecto confirma que el presupuesto optico es una parte central.

Formula base:

```txt
P_recibida =
P_transmitida
- perdida_fibra
- perdida_splitters
- perdida_empalmes
- perdida_conectores
```

Campos necesarios:

```txt
fiber_routes.length_meters
fiber_routes.attenuation_db_per_km
fiber_routes.splice_loss_db
fiber_routes.connector_loss_db
infrastructure_elements.split_ratio
infrastructure_elements.insertion_loss_db
route_points.splice_loss_db
```

Perdidas de referencia para splitters:

```txt
1:2  -> ~3.5 dB
1:4  -> ~7.2 dB
1:8  -> ~10.5 dB
1:16 -> ~13.8 dB
1:32 -> ~17.1 dB
1:64 -> ~20.5 dB
```

Rango operativo GPON mencionado en la investigacion:

```txt
-8 dBm a -28 dBm
```

## Factibilidad de cliente futura

La fase de distribucion debe permitir evaluar si un cliente puede instalarse.

Reglas iniciales:

```txt
Cliente factible si hay NAP cercana.
Cliente factible si la NAP tiene puerto disponible.
Cliente factible si el drop no excede una distancia limite.
Cliente factible si el presupuesto optico mantiene margen.
```

Referencia inicial:

```txt
Distancia drop sugerida: 300 m
```

## Orden de implementacion recomendado

### Fase 1: Base de datos nueva

```txt
001_initial_schema.sql
002_rls_policies.sql
003_seed_ecuador.sql
004_map_functions.sql
```

### Fase 2: Tipos y mapa

```txt
Actualizar lib/types/gpon.ts
Actualizar components/map/types.ts
Actualizar RPCs de mapa
Adaptar MapView al nuevo modelo
```

### Fase 3: Editor de infraestructura

```txt
Toolbar de herramientas
Crear OLT/splitter/NAP
Dibujar fibra
Agregar cruces/reservas/empalmes
Panel de propiedades editable
Validaciones suaves
```

### Fase 4: Distribucion

```txt
Clientes
NAP ports
ONTs
Asignacion cliente -> NAP -> puerto
Acometidas/drop
Ubicacion progresiva
```

### Fase 5: Calidad de datos

```txt
Clientes sin NAP
NAPs sin capacidad
Rutas sin destino
Reservas sin longitud
Empalmes sin perdida estimada
Elementos con ubicacion aproximada
```

## MCP y skills recomendados

Para trabajar directamente con Supabase desde Codex:

```bash
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=TU_PROJECT_REF&read_only=true&features=database,docs"
codex mcp login supabase
codex mcp list
```

Cuando se quiera permitir escritura en Supabase de desarrollo, quitar `read_only=true`.

Para documentacion oficial de OpenAI:

```bash
codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp
```

## Proximo paso sugerido

Iniciar un nuevo chat con este documento como contexto y pedir:

```txt
Usa docs/INFRASTRUCTURE_EDITOR_PLAN.md como referencia.
Redisenemos las migraciones de base de datos y adaptemos los tipos TypeScript para el nuevo modelo del editor de infraestructura GPON.
```
