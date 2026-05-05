# Alcance MVP - Editor de Infraestructura GPON

Fecha de decision: 2026-04-27

## Decision principal

El MVP se cierra como un **Editor de Infraestructura GPON en mapa**.

La especificacion de comportamiento UI/UX por modo, zoom y herramienta esta en:

```txt
docs/EDITOR_UI_UX_SPEC.md
```

La lista de tareas realizadas y pendientes esta en:

```txt
docs/MVP_TASKS.md
```

El objetivo no es construir todavia un OSS/BSS completo, ni resolver clientes,
facturacion, ONTs, ordenes de instalacion o monitoreo en tiempo real. El primer
producto usable debe permitir que un ISP documente y corrija su planta externa
desde un mapa, incluso cuando la informacion inicial sea incompleta.

Regla del MVP:

```txt
Dibujar primero.
Pedir pocos datos.
Permitir aproximaciones.
Advertir sin bloquear.
Corregir despues.
```

## Roles del sistema y encaje MVP

El sistema reconoce cinco roles base desde el inicio:

```txt
admin              -> Administrador
network_engineer   -> Ingenieria de red
outside_plant      -> Planta externa
installer          -> Instalador
support            -> Soporte / operaciones
```

El MVP se enfoca en el modo **Infraestructura**. Por eso, los roles activos en
esta primera entrega son:

```txt
admin
network_engineer
outside_plant
```

La diferencia central es:

```txt
network_engineer diseña, valida y gobierna la red.
outside_plant consulta la red y reporta/verifica lo construido en campo.
admin administra el sistema y puede intervenir todo.
```

El MVP no esta centrado todavia en:

```txt
installer
support
BSS / comercial / facturacion
```

Estos perfiles siguen siendo importantes, pero pertenecen a fases posteriores.

## Flujo funcional MVP

### 1. Entrar al mapa en modo Infraestructura

La pantalla principal es el mapa. La interfaz debe evitar modales largos y
formularios que saquen al operador del contexto geografico.

Estructura esperada:

```txt
Barra superior: proyecto, busqueda, modo, usuario
Toolbar: herramientas de creacion y edicion
Panel izquierdo: capas y listado
Mapa central: lienzo principal
Panel derecho: propiedades contextuales
Barra inferior: instrucciones, estado y advertencias
```

### 2. Crear elementos de infraestructura

Herramientas MVP:

```txt
Seleccionar
Mover mapa
Crear OLT
Crear splitter
Crear NAP
Eliminar
```

Flujo:

```txt
1. Seleccionar herramienta.
2. Click en mapa.
3. Crear elemento provisional.
4. Abrir panel derecho.
5. Completar datos minimos.
6. Guardar y seguir trabajando.
```

Datos minimos:

```txt
OLT:
- codigo / nombre
- estado
- ubicacion
- calidad de ubicacion
- total de puertos PON

Splitter:
- codigo
- ratio
- perdida de insercion
- estado
- calidad de ubicacion

NAP:
- codigo
- total de puertos
- estado
- calidad de ubicacion
```

La creacion repetida debe ser natural, especialmente para NAPs:

```txt
Click -> NAP-001
Click -> NAP-002
Click -> NAP-003
Esc -> salir
```

### 3. Dibujar rutas de fibra

Herramienta MVP:

```txt
Dibujar fibra
```

Flujo:

```txt
1. Seleccionar Dibujar fibra.
2. Click en elemento origen.
3. Clicks intermedios siguiendo la ruta.
4. Click en elemento destino.
5. Calcular longitud aproximada.
6. Completar datos minimos.
7. Guardar ruta.
```

Tipos MVP:

```txt
feeder
distribution
other
```

Notas:

```txt
drop queda fuera del MVP.
from_element_id y to_element_id pueden ser NULL.
La ruta puede ser aproximada.
```

### 4. Agregar puntos relevantes sobre rutas

Herramientas MVP:

```txt
Marcar cruce
Marcar reserva
Marcar empalme
```

Flujo:

```txt
1. Seleccionar una ruta.
2. Elegir tipo de punto relevante.
3. Click sobre la ruta.
4. Ajustar el punto a la ruta.
5. Completar dato minimo.
```

Datos minimos:

```txt
Cruce:
- referencia
- tipo de cruce
- riesgo
- observacion

Reserva:
- longitud aproximada
- estado
- observacion

Empalme:
- codigo
- estado
- perdida estimada
- observacion
```

## Modelo de datos MVP

Como la data actual es de prueba, se decide redisenar la base ahora.

El MVP es **single-tenant**: no se incluye `organizations` ni `organization_id`
en ninguna tabla. Ver `docs/adr/0001-single-tenant-mvp.md` para el plan de
activacion futura.

### infrastructure_elements

Tabla principal para OLT, splitter y NAP.

```txt
id
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

Campos tecnicos como `split_ratio`, `insertion_loss_db`,
`total_pon_ports` y `total_ports` deben ser columnas reales porque
participan en calculos, filtros y validaciones.

### fiber_routes

Tabla para rutas dibujadas y conexiones tecnicas.

```txt
id
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

`from_element_id` y `to_element_id` pueden ser NULL para soportar rutas
incompletas o aproximadas.

### route_points

Tabla para cruces, reservas y empalmes.

```txt
id
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
reference_text
properties
notes
created_by
updated_by
created_at
updated_at
```

`fiber_route_id` es obligatorio.

## Calidad de datos

El MVP debe guardar calidad/confianza del dato desde el inicio.

### Calidad de ubicacion

```txt
unknown
approximate
gps_captured
verified
```

### Calidad de ruta

```txt
approximate
field_drawn
gps_captured
verified
```

## Validaciones MVP

### Bloqueantes

Solo para errores que rompen el modelo.

```txt
Elemento sin tipo.
Ruta sin geometria.
Punto relevante sin ruta asociada.
```

### Advertencias

Datos incompletos o conexiones poco comunes.

```txt
OLT sin puertos PON definidos.
Splitter sin ratio.
NAP sin capacidad.
Ruta sin origen.
Ruta sin destino.
Ruta muy larga.
Conexion NAP -> NAP.
Ubicacion aproximada.
Ruta no verificada.
Reserva sin longitud.
Empalme sin perdida estimada.
```

Regla:

```txt
La advertencia no bloquea el trabajo.
La advertencia ayuda a mejorar el dato despues.
```

## Roles y permisos MVP

### admin

Rol de gobierno y administracion del sistema.

Puede:

```txt
Gestionar usuarios y roles.
Crear, editar y eliminar infraestructura.
Configurar catalogos y parametros tecnicos.
Corregir y validar datos.
Ver calidad de datos.
Ver auditoria.
```

### network_engineer

Rol de diseno, validacion y gobierno tecnico de la red.

Puede:

```txt
Crear y editar OLTs.
Crear y editar splitters.
Crear y editar NAPs.
Disenar rutas feeder y distribution.
Corregir rutas de infraestructura.
Validar cambios de planta externa.
Ver capacidad y presupuesto optico base.
Ver calidad de datos.
Configurar parametros tecnicos de red si la politica lo permite.
```

No debe poder por defecto:

```txt
Gestionar usuarios.
Modificar facturacion.
Cambiar precios o contratos.
Eliminar clientes comerciales.
```

### outside_plant

Rol operativo de campo para planta externa.

Puede:

```txt
Consultar infraestructura fisica.
Buscar OLT, splitter, NAP y rutas.
Reportar ubicaciones reales de campo.
Reportar rutas feeder y distribution diferentes a lo registrado.
Reportar cruces.
Reportar reservas.
Reportar empalmes.
Registrar observaciones as-built como propuesta/verificacion.
Crear incidentes tecnicos si el flujo operativo lo habilita.
```

No debe poder por defecto:

```txt
Gestionar usuarios.
Validar cambios criticos como aprobador final.
Modificar clientes comerciales.
Modificar facturacion.
Gestionar contratos.
Cambiar planes comerciales.
Cambiar parametros globales de diseno.
```

### installer

Fuera del flujo principal del MVP. Se conserva como rol base para la fase de
distribucion.

En fases posteriores podra:

```txt
Seleccionar NAP usada.
Asignar puerto de NAP.
Registrar ONT.
Capturar ubicacion GPS del cliente.
Registrar potencia optica.
Dibujar o confirmar drop/acometida.
Subir evidencia.
```

### support

Fuera del flujo principal del MVP. Se conserva como rol base para la fase de
operacion.

En fases posteriores podra:

```txt
Buscar clientes.
Ver estado del servicio.
Consultar ONT, NAP y afectaciones relacionadas.
Crear y actualizar incidentes.
Consultar infraestructura en modo lectura.
```

## Fuera de alcance del MVP

Queda fuera de esta fase:

```txt
Clientes.
ONTs.
Servicios comerciales.
Planes comerciales.
Facturacion.
Puertos reales de NAP.
Asignacion cliente -> NAP -> puerto.
Acometidas/drop.
Ordenes de instalacion.
Evidencias/fotos.
Monitoreo SNMP/API de OLT.
Presupuesto optico completo extremo a extremo.
Postes.
Camaras.
Zonas de cobertura exactas.
Aprobaciones complejas.
Reportes avanzados.
```

Estos elementos se mantienen como direccion futura, no como requisito para
cerrar el primer producto usable.

## Presupuesto optico en MVP

El MVP ya calcula una primera version del presupuesto optico en rutas y en el
diagrama unifilar readonly. El calculo extremo a extremo hasta ONT/drop queda
para la fase de distribucion, pero la base de ingenieria debe mantenerse desde
ahora.

Referencia canonica: `docs/GPON_FTTH_ECUADOR_RESEARCH.md#presupuesto-optico-consolidado`.

Campos que se guardan desde ahora:

```txt
fiber_routes.length_meters
fiber_routes.attenuation_db_per_km
fiber_routes.splice_loss_db
fiber_routes.connector_loss_db
fiber_routes.total_loss_db
infrastructure_elements.split_ratio
infrastructure_elements.insertion_loss_db
route_points.splice_loss_db
```

Valores activos en la calculadora:

```txt
factor_longitud = 1.02x
conector = 0.5 dB
empalme = 0.1 dB
margen_seguridad = 3.0 dB
longitud_onda_base = 1490 nm
```

Perdidas de referencia para splitters:

```txt
1:2  -> ~3.5 dB
1:4  -> ~7.2 dB
1:8  -> ~10.5 dB
1:16 -> ~13.8 dB
1:32 -> ~17.0 dB
1:64 -> ~20.5 dB
```

Rango operativo GPON de referencia:

```txt
Saturacion: > -8 dBm
Optimo:     -15 a -22 dBm
Aceptable:  -23 a -26 dBm
Critico:    -27 a -28 dBm
LOS:        < -29 dBm
```

## Orden de implementacion

### Fase 1 - Base de datos ✅ COMPLETADA (2026-04-27)

```txt
[x] Drop esquema legacy.
[x] Crear infrastructure_elements.
[x] Crear fiber_routes.
[x] Crear route_points.
[x] RLS para los 5 roles (admin, network_engineer, outside_plant, installer, support).
[x] Seed dev minimo Quito.
[x] Regenerar lib/types/gpon.ts.
```

### Fase 2 - Tipos y RPCs

```txt
Actualizar lib/types/gpon.ts.
Actualizar components/map/types.ts.
Crear RPCs para elementos, rutas y puntos.
Adaptar MapPage al nuevo modelo.
```

### Fase 3 - Mapa como visor

```txt
Renderizar OLT, splitter y NAP.
Renderizar rutas feeder/distribution/other.
Renderizar cruces, reservas y empalmes.
Mostrar panel contextual de lectura.
Mostrar advertencias simples.
```

### Fase 4 - Editor MVP

```txt
Toolbar de herramientas.
Crear OLT/splitter/NAP con click.
Dibujar ruta de fibra.
Agregar cruce/reserva/empalme.
Editar propiedades minimas.
Eliminar si el rol lo permite.
```

## Criterio de cierre MVP

El MVP esta cerrado cuando `network_engineer`, con permisos de escritura directa,
puede:

```txt
1. Entrar al mapa.
2. Crear una OLT.
3. Crear splitters.
4. Crear NAPs.
5. Dibujar rutas entre elementos.
6. Marcar cruces, reservas y empalmes.
7. Guardar datos incompletos con calidad/confianza.
8. Ver advertencias sin que el sistema bloquee el trabajo.
```

La fase siguiente empieza cuando se agregue:

```txt
Clientes.
NAP ports.
ONTs.
Drops.
Ordenes de instalacion.
Factibilidad de cliente.
```
