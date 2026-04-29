# Flujo UI/UX - Mapa de Red GPON

Fecha de decision: 2026-04-28

## Objetivo

Definir el flujo principal del mapa de red GPON como vista operativa de la
infraestructura fisica existente, separando claramente visualizacion, creacion,
edicion y verificacion de campo.

Este documento complementa:

```txt
docs/EDITOR_UI_UX_SPEC.md
docs/OPERATIONAL_ROLES.md
docs/GPON_FTTH_ECUADOR_RESEARCH.md
```

## Principio de producto

La app debe abrir sobre la red fisica levantada, no sobre formularios. El mapa
es la fuente visual de verdad para entender que infraestructura existe, donde
esta, como se conecta y que tan confiable es la informacion.

La experiencia debe evitar que OLTs, splitters, NAPs, fibras, reservas,
empalmes y etiquetas colapsen visualmente. La red debe revelarse por escala,
filtros y busqueda.

## Vista de red

La vista de red representa la infraestructura fisica registrada:

```txt
OLT
Splitters
NAPs
Rutas feeder
Rutas distribution
Cruces
Reservas
Empalmes
Capacidad
Estado
Calidad del dato
```

Esta vista es de lectura para todos los roles autenticados. Sirve para consultar
la red existente, buscar elementos, filtrar capas, medir distancias y revisar
advertencias.

Todos los roles pueden ver la red porque es la base comun de operacion. Ver no
implica poder modificar.

## Creacion vs edicion

Creacion y edicion son flujos distintos.

### Creacion

La creacion incorpora infraestructura que aun no existe en el sistema.

Ejemplos:

```txt
Crear una OLT nueva.
Crear splitters.
Crear NAPs.
Dibujar rutas feeder o distribution.
Importar una zona desde archivo.
Registrar una red existente por primera vez.
```

La creacion debe permitir informacion incompleta, siempre que quede marcada con
calidad de dato y advertencias no bloqueantes.

Metodos de creacion:

```txt
Importacion estructurada.
Dibujo directo en el mapa.
Plantillas o topologias base.
Levantamiento/captura de campo en fase posterior.
```

### Edicion

La edicion modifica infraestructura ya registrada.

Ejemplos:

```txt
Mover una NAP.
Corregir una ruta.
Cambiar estado.
Completar capacidad.
Actualizar calidad del dato.
Corregir codigo operativo.
Agregar notas tecnicas.
```

La edicion tiene mas riesgo que la creacion porque altera la fuente de verdad.
Debe dejar trazabilidad y restringirse por rol. Cambios criticos como mover
ubicaciones, cambiar conectividad o retirar elementos requieren mayor control.

## Metodos de carga de informacion

### 1. Importacion

Metodo recomendado cuando el operador ya tiene informacion en archivos externos:

```txt
CSV
Excel
Exportaciones GIS
Inventarios previos
Datos convertidos desde planos
```

Es el metodo mas delicado porque la informacion debe coincidir con el modelo del
sistema. El flujo recomendado es:

```txt
Subir archivo.
Mapear columnas.
Previsualizar elementos y rutas.
Validar codigos, coordenadas y relaciones.
Mostrar errores y advertencias.
Confirmar importacion.
```

La importacion no debe insertar datos criticos sin una previsualizacion clara.

### 2. Dibujo directo en mapa

Metodo principal del MVP.

Permite construir la red de forma visual:

```txt
Click para crear OLT.
Click para crear splitter.
Click para crear NAP.
Dibujar fibra entre elementos.
Marcar cruces, reservas y empalmes sobre rutas.
```

Debe mantener el principio:

```txt
Dibujar primero.
Pedir pocos datos.
Advertir sin bloquear.
Corregir despues.
```

### 3. Verificacion/correccion de campo

No se considera el metodo principal para cargar toda una red. Recorrer fisicamente
toda la infraestructura puede ser costoso, lento o impracticable.

Debe funcionar como flujo de mejora puntual:

```txt
Confirmar ubicacion real.
Corregir una NAP o splitter.
Reportar una ruta diferente.
Marcar una reserva o empalme encontrado.
Subir evidencia.
Cambiar calidad del dato a gps_captured o verified.
```

Los cambios de campo pueden empezar como propuestas pendientes de revision antes
de actualizar la red maestra.

## Roles y permisos

La UI debe separar permisos de lectura, creacion, edicion, verificacion y
operacion. No todos los roles que entienden la red deben poder modificar la red
maestra.

Matriz propuesta:

| Rol | Vista | Crear | Editar | Verificar campo | Operar incidentes | Administrar |
|---|---:|---:|---:|---:|---:|---:|
| `admin` | Si | Si | Si | Si | Si | Si |
| `network_engineer` | Si | Si | Si | Aprueba | Si tecnico | No |
| `outside_plant` | Si | No directo | No directo | Si | Limitado | No |
| `installer` | Si | No | No | Instalacion futura | No | No |
| `support` | Si | No | No | No | Si | No |

La diferencia clave es que `outside_plant` conoce y corrige la planta fisica en
campo, pero sus cambios pueden entrar como propuestas o verificaciones antes de
modificar la fuente de verdad.

### Vista

Pueden ver:

```txt
admin
network_engineer
outside_plant
installer
support
```

### Creacion directa

Pueden crear infraestructura critica:

```txt
admin
network_engineer
```

`outside_plant` puede proponerse como rol de captura/correccion de campo, pero
no necesariamente como editor directo de la red maestra.

Acciones de creacion:

```txt
Importar infraestructura.
Crear OLT.
Crear splitter.
Crear NAP.
Dibujar ruta feeder.
Dibujar ruta distribution.
Marcar cruce, reserva o empalme inicial.
Crear elementos desde plantilla/topologia.
```

### Edicion directa

Pueden editar infraestructura critica:

```txt
admin
network_engineer
```

Acciones de edicion:

```txt
Mover elementos existentes.
Corregir geometria de rutas.
Cambiar conectividad origen/destino.
Actualizar capacidad tecnica.
Cambiar estado operativo.
Corregir codigo operativo.
Actualizar calidad del dato.
Retirar/desactivar infraestructura.
```

Cambios criticos:

```txt
Mover OLT, splitter o NAP.
Cambiar extremos de una fibra.
Eliminar una ruta.
Cambiar codigo operativo.
Cambiar una ruta de feeder a distribution o viceversa.
Reducir capacidad declarada.
```

Los cambios criticos deben dejar trazabilidad y pueden requerir confirmacion
adicional en UI.

### Eliminacion

Debe evitarse como accion normal. Para red fisica conviene usar estados como
`retired` o `decommissioned`. El borrado real queda restringido a `admin` y debe
validar dependencias.

### Verificacion de campo

Rol principal:

```txt
outside_plant
```

Tambien pueden participar `admin` y `network_engineer`.

Acciones:

```txt
Confirmar ubicacion real.
Reportar ubicacion corregida.
Reportar ruta distinta a la registrada.
Agregar observacion tecnica.
Marcar reserva encontrada.
Marcar empalme encontrado.
Subir evidencia futura.
Cambiar propuesta de calidad del dato.
```

La verificacion de campo no debe confundirse con edicion directa. El flujo
recomendado es:

```txt
Capturar correccion -> guardar propuesta -> revisar -> aprobar/rechazar -> aplicar.
```

En el MVP, si no existe tabla de propuestas, la UI puede mantener
`outside_plant` en lectura y dejar el flujo de propuestas para la siguiente
fase. Esto es mas seguro que darle permisos amplios de escritura sobre la red
maestra desde el inicio.

### Operacion

Rol principal:

```txt
support
```

Acciones futuras:

```txt
Buscar cliente.
Ver NAP asociada.
Ver afectaciones por ruta, NAP o splitter.
Crear incidente.
Actualizar incidente.
Agregar notas operativas.
Consultar infraestructura en solo lectura.
```

Operacion no modifica infraestructura.

## Entrada principal

La experiencia ideal es entrar al mapa de la red levantada con zoom alejado.

Estado inicial recomendado:

```txt
Mapa centrado en el area de operacion.
Zoom alejado.
Solo OLTs visibles.
Filtros y busqueda disponibles.
Panel derecho oculto hasta seleccionar.
Advertencias globales resumidas.
```

Si existen varias redes, la seleccion de red puede resolverse con un selector
compacto en la barra superior o con la ultima red usada, evitando convertir la
lista de redes en un paso obligatorio cada vez.

## Visibilidad progresiva por zoom

La visibilidad debe resolver el colapso visual.

### Zoom lejano

Mostrar:

```txt
OLTs
Resumenes por zona si aplica
Alertas criticas globales
```

Ocultar:

```txt
Splitters
NAPs
Rutas distribution
Cruces
Reservas
Empalmes
Etiquetas detalladas
```

### Zoom medio

Mostrar:

```txt
OLTs
Rutas feeder
Splitters principales
Alertas de infraestructura
```

### Zoom cercano

Mostrar:

```txt
OLTs
Splitters
NAPs
Rutas feeder
Rutas distribution
Estados
Codigos principales
Advertencias de dato
```

### Zoom muy cercano

Mostrar:

```txt
Cruces
Reservas
Empalmes
Etiquetas completas
Longitudes
Calidad de ubicacion
Calidad de ruta
Capacidad relevante
```

Los filtros manuales pueden sobrescribir la ocultacion por zoom cuando el usuario
busca un tipo especifico de elemento.

## Busqueda

La busqueda debe operar sobre:

```txt
Codigo operativo
Alias o nombre
Tipo de elemento
Zona
Estado
Calidad del dato
```

Casos esperados:

```txt
Buscar una OLT por codigo.
Buscar una NAP especifica.
Filtrar todas las NAPs de una zona.
Encontrar elementos con ubicacion aproximada.
Encontrar NAPs saturadas o casi llenas.
```

## Codigos operativos y etiquetas

El sistema debe separar:

```txt
id interno        -> UUID/base de datos.
codigo operativo -> label tecnico estable.
alias/nombre      -> texto humano opcional.
QR/barcode        -> puente fisico hacia la app.
```

Convencion base:

```txt
{PROV}-{CIUDAD}-{ZONA}-{TIPO}-{NNN}
```

Ejemplos:

```txt
PIC-UIO-CAR-OLT-001
PIC-UIO-Z05-SPL-014
PIC-UIO-Z05-NAP-128
PIC-UIO-Z05-FDR-003
PIC-UIO-Z05-DST-021
PIC-UIO-Z05-CJS-014
PIC-UIO-Z05-RES-044
PIC-UIO-Z05-CRU-009
```

Tipos recomendados:

```txt
OLT -> OLT
Splitter -> SPL
NAP -> NAP
Feeder -> FDR
Distribution -> DST
Caja de empalme -> CJS
Reserva -> RES
Cruce -> CRU
```

Reglas:

```txt
El codigo operativo es estable.
No debe cambiar automaticamente por mover un elemento.
Cambios de zona o codigo deben ser acciones controladas.
El UUID interno no debe ser el identificador de trabajo en campo.
```

Implementacion actual:

```txt
El mapa usa code como identificador visible principal.
Los helpers de codigo viven en apps/web/lib/gpon/operative-code.ts.
La busqueda acepta tanto codigo completo como codigo compacto.
Ejemplo: PIC-UIO-Z05-NAP-128 y NAP-128 deben encontrar el mismo elemento.
```

## Etiquetas por zoom

### Zoom lejano

Mostrar:

```txt
OLT-001
```

o, si hay pocas OLTs:

```txt
PIC-UIO-CAR-OLT-001
```

### Zoom medio

Mostrar:

```txt
OLT-001
SPL-014
FDR-003
```

### Zoom cercano

Mostrar:

```txt
NAP-128
SPL-014
DST-021
```

### Zoom muy cercano

Mostrar codigos completos y metadatos utiles:

```txt
PIC-UIO-Z05-NAP-128
8/16 puertos usados
verified
```

## Nombres de modos en UI

Los modos actuales pueden mapearse asi:

```txt
view   -> Vista
design -> Crear
edit   -> Editar
```

Modos futuros:

```txt
Verificacion
Operacion
Calidad
```

---

## Flujo Actual de Creación (con Zonas - 2026-04-29)

### Paso 1: Crear red nueva
```
/networks → [+ Crear red]
├─ Nombre: "Quito Z05"
├─ Topología: [Blanco] (pendiente: selector de templates)
└─ Sistema crea network + seed de zonas (Z01, Z05, Z10)
```

### Paso 2: Entrar al editor
```
/networks/[id]
├─ Carga zonas: Z01, Z05, Z10
├─ NetworkEditorShell → MapView (pasa zones como prop)
└─ Usuario en Modo VISTA
```

### Paso 3: Crear elemento en modo CREAR
```
Toolbar → [Crear] → Herramienta: NAP
Click en mapa
├─ defaultZone = "Z01" (primera zona)
├─ Draft genera: PIC-UIO-Z01-NAP-001
├─ Panel abre con:
│  ├─ Zona: [Z01 ▼]
│  ├─ Código: PIC-UIO-Z01-NAP-001
│  ├─ Nombre: (editable)
│  ├─ Puertos: 8
│  └─ [Guardar] [Cancelar]
```

### Paso 4: Cambiar zona (NUEVO ✨)
```
User cambia Zona: [Z05 ▼]
├─ onChange event
├─ Calcula nextSequence([elementos en Z05])
├─ Regenera código: PIC-UIO-Z05-NAP-001
├─ Panel actualiza en tiempo real
└─ User puede guardar con nueva zona
```

### Paso 5: Guardar
```
[Guardar] → createInfrastructureElement()
├─ Inserta: code = "PIC-UIO-Z05-NAP-001"
├─ Elemento aparece en mapa
└─ Se puede crear siguiente elemento en misma o diferente zona
```

### Características implementadas:
- ✅ Zonas predefinidas por red (BD)
- ✅ Selector de zona en panel de draft
- ✅ Regeneración automática de código
- ✅ Cálculo de secuencia por (zona + tipo)
- ✅ Almacenamiento del código final con zona

### Características pendientes:
- ⏳ Generación de topología desde template (Star/Tree/Cascade)
- ⏳ Batch creation de elementos relacionados
- ⏳ Validación de código único por red
- ⏳ Cambio de zona en MODO EDITAR con confirmación

## Decisiones Implementadas

### ✅ Decisión #3: Códigos por zona (RESUELTA - 2026-04-29)

**Decisión:** Manual con asistencia automática.

**Implementación:**

1. **Zonas predefinidas por red**: Cada red tiene zonas (Z01, Z05, Z10, etc.)
   - Base de datos: tabla `network_zones`
   - Seed automático: 3 zonas por red nueva
   - Editable: admin puede crear/renombrar zonas

2. **Selector de zona en UI**: Panel de edición de draft muestra dropdown
   - Usuario elige zona: [Z05 ▼]
   - Código regenera automáticamente: PIC-UIO-Z05-NAP-128 → PIC-UIO-Z10-NAP-129
   - Secuencia se calcula por (zona + tipo)

3. **Flujo de creación**:
   ```
   Click crear NAP
   ├─ defaultZone = primera zona (Z01)
   ├─ Código: PIC-UIO-Z01-NAP-001
   ├─ Panel abre con selector de zona
   ├─ Usuario cambia a Z05
   └─ Código regenera: PIC-UIO-Z05-NAP-001
   ```

4. **Datos almacenados**: `infrastructure_elements.code` = código final con zona

Documentación técnica: `database/migrations/010_network_zones.sql` + `011_network_zones_rpc.sql`

---

## Decisiones Pendientes

```txt
1. Confirmar si la entrada principal usa ultima red, red por defecto o selector.
2. Definir cuando una importacion crea borradores vs datos activos.
4. Definir estados exactos para propuestas de campo y aprobaciones.
5. (NUEVO) ¿Topologías predefinidas generan automáticamente desde templates?
```
