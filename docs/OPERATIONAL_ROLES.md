# Roles Operativos del Sistema GPON

## Objetivo

Definir los perfiles reales que interactuan con el sistema y separar sus responsabilidades. El sistema no debe asumir que "el tecnico" es una sola persona con conocimiento completo de infraestructura, clientes, puertos, instalaciones y datos comerciales.

La investigacion externa y la justificacion de roles se documentan en:

```txt
docs/OPERATIONAL_ROLE_RESEARCH.md
```

La regla base es:

```txt
Ingenieria de red diseña y valida.
Planta externa documenta y corrige lo construido.
Instalador conecta y actualiza datos tecnicos del cliente.
Soporte consulta y opera incidentes.
Administrador valida y gobierna.
```

## Roles base recomendados

Los roles de autorizacion del sistema deben usar nombres cortos y estables:

```txt
admin
network_engineer
outside_plant
installer
support
```

No se recomienda usar un rol generico `technician`, porque mezcla planta
externa, instalacion, soporte y responsabilidades comerciales.

Para el MVP del editor de infraestructura participan principalmente:

```txt
admin
network_engineer
outside_plant
```

`installer` y `support` se conservan como roles base, pero su flujo principal
entra en fases posteriores.

## 1. Ingenieria de red

### Responsabilidad

Diseñar, validar y gobernar tecnicamente la red GPON.

Este perfil conoce mejor:

```txt
Arquitectura ODN
Diseno de rutas feeder y distribucion
Capacidad de OLTs, splitters y NAPs
Presupuesto optico
Expansion de red
Calidad del inventario
Reglas tecnicas de diseno
```

No necesariamente ejecuta:

```txt
Empalmes en campo
Instalaciones de cliente
Registro de ONT en domicilio
Atencion diaria de reclamos
Facturacion
```

### Modulo principal

```txt
Editor de infraestructura
Calidad de datos
Presupuesto optico
```

### Permisos sugeridos

Puede:

```txt
Crear y editar OLTs
Crear y editar splitters
Crear y editar NAPs
Disenar rutas feeder y distribucion
Corregir rutas de infraestructura
Validar cambios de planta externa
Ver capacidad
Ver presupuesto optico
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

Rol interno:

```txt
network_engineer
```

## 2. Tecnico de planta externa

### Responsabilidad

Mantener la infraestructura fisica de la red GPON.

Este perfil conoce mejor:

```txt
OLT
Splitters
Rutas feeder
Rutas de distribucion
NAPs
Empalmes
Reservas de cable
Cruces criticos
Referencias fisicas de la ruta
```

No necesariamente conoce:

```txt
Clientes conectados
Puertos ocupados en cada NAP
Datos comerciales
ONT instalada en cada cliente
```

### Modulo principal

```txt
Editor de infraestructura
```

### Permisos sugeridos

Puede:

```txt
Crear y editar OLTs
Crear y editar splitters
Crear y editar NAPs
Dibujar rutas de fibra
Editar rutas feeder y distribucion
Marcar cruces de avenida
Marcar reservas de cable
Marcar empalmes
Corregir ubicaciones de infraestructura
Agregar observaciones tecnicas de planta externa
```

No deberia poder por defecto:

```txt
Cambiar planes comerciales
Eliminar clientes
Modificar facturacion
Gestionar contratos
Administrar usuarios
```

Rol interno:

```txt
outside_plant
```

## 3. Tecnico instalador

### Responsabilidad

Completar y confirmar la informacion tecnica de una instalacion de cliente.

Este perfil conoce mejor:

```txt
NAP usada en campo
Puerto usado de la NAP
Direccion real o referencia del cliente
Ubicacion GPS del cliente
ONT instalada
Serial de la ONT
Potencia optica medida
Acometida/drop realizada
Observaciones de instalacion
```

No necesariamente conoce:

```txt
Toda la ruta feeder
Todos los splitters aguas arriba
Topologia completa de la red
Presupuesto optico completo
Clientes de otras NAPs
```

### Modulo principal

```txt
Instalacion / distribucion
```

### Flujo ideal

```txt
1. Ver orden de instalacion asignada.
2. Abrir cliente pendiente.
3. Ver NAPs cercanas o sugeridas.
4. Seleccionar la NAP realmente usada.
5. Seleccionar el puerto usado.
6. Registrar o escanear ONT.
7. Capturar ubicacion GPS del cliente.
8. Confirmar direccion o referencia fisica.
9. Registrar potencia optica.
10. Dibujar o confirmar acometida/drop si aplica.
11. Subir foto o evidencia.
12. Marcar instalacion como completada.
```

### Permisos sugeridos

Puede:

```txt
Ver infraestructura existente
Ver clientes u ordenes asignadas
Actualizar ubicacion tecnica del cliente
Confirmar direccion o referencia
Asignar NAP usada
Asignar puerto de NAP
Registrar ONT instalada
Actualizar serial/modelo de ONT
Registrar potencia optica
Dibujar o confirmar drop
Subir evidencia de instalacion
Agregar observaciones tecnicas
Cambiar estado operativo de la instalacion
```

No deberia poder por defecto:

```txt
Crear o eliminar clientes comerciales
Cambiar plan contratado
Modificar precio o facturacion
Eliminar servicios
Editar OLTs
Editar splitters
Editar rutas feeder o distribucion
Cambiar capacidad de NAPs
Administrar usuarios
```

Rol interno:

```txt
installer
```

### Campos de cliente que puede actualizar

```txt
address_reference
location
location_quality
nap_id
nap_port_id
installation_notes
technical_notes
```

### Campos de cliente que no debe actualizar

```txt
full_name
id_number
billing_data
plan_id
price
contract_data
```

## 4. Soporte / operaciones

### Responsabilidad

Consultar servicios, identificar afectaciones y gestionar incidentes.

Este perfil conoce mejor:

```txt
Clientes
Reclamos
Estado del servicio
Incidentes activos
Historial operativo
```

No necesariamente conoce:

```txt
Detalle de rutas fisicas
Empalmes
Reservas
Presupuesto optico
```

### Modulo principal

```txt
Operacion / incidentes
```

### Permisos sugeridos

Puede:

```txt
Buscar clientes
Ver NAP asociada
Ver estado del servicio
Ver afectaciones por NAP o ruta
Crear incidentes
Actualizar estado de incidentes
Agregar notas de soporte
Consultar informacion de red en modo lectura
```

No deberia poder por defecto:

```txt
Editar infraestructura
Editar rutas de fibra
Cambiar capacidad tecnica
Asignar puertos de NAP
Modificar presupuesto optico
Eliminar elementos de red
```

Rol interno:

```txt
support
```

## 5. Administrador

### Responsabilidad

Gobernar el sistema, gestionar usuarios, configurar reglas globales y auditar la informacion.

### Modulos principales

```txt
Administracion
Calidad de datos
Ingenieria
Reportes
```

### Permisos sugeridos

Puede:

```txt
Gestionar usuarios y roles
Crear y editar toda la infraestructura
Editar clientes y servicios segun politica interna
Configurar parametros tecnicos
Aprobar o corregir cambios
Ver auditoria
Ver calidad de datos
Ver presupuesto optico
Ver reportes de capacidad
Gestionar catalogos
```

Rol interno:

```txt
admin
```

## Modos de interfaz por rol

### Modo Infraestructura

Principal para `network_engineer` y `outside_plant`.

En el MVP este es el modo principal del producto.

```txt
Mapa
Toolbar de dibujo
Panel de propiedades
Rutas de fibra
Cruces
Reservas
Empalmes
Validaciones de infraestructura
```

### Modo Instalacion

Principal para instaladores.

```txt
Ordenes asignadas
Cliente pendiente
NAPs cercanas
Puertos disponibles
Registro de ONT
GPS del cliente
Potencia optica
Evidencias
Confirmacion de instalacion
```

### Modo Operacion

Principal para soporte.

```txt
Busqueda de clientes
Estado de servicio
NAP asociada
Clientes afectados
Incidentes
Notas operativas
```

### Modo Calidad de Datos

Principal para `admin` y `network_engineer`.

```txt
Clientes sin NAP
Clientes sin ubicacion
NAPs sin capacidad
Rutas sin destino
Reservas sin longitud
Empalmes sin perdida estimada
Elementos con ubicacion aproximada
```

## Principio de permisos

El instalador y soporte ayudan a mejorar la informacion, pero no deben modificar la infraestructura critica salvo permisos especiales.

```txt
Actualizar informacion tecnica de campo: permitido.
Modificar estructura fisica de red: restringido.
Modificar informacion comercial: restringido.
```

Esta separacion reduce errores, hace la UI mas simple por perfil y refleja mejor la operacion real de un ISP.
