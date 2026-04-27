# Especificacion UI/UX - Editor GPON

Fecha de decision: 2026-04-27

## Objetivo

Definir como debe comportarse la interfaz del editor de infraestructura GPON
segun el modo de trabajo, el nivel de zoom y la herramienta activa.

El editor debe sentirse como un lienzo tecnico: fluido, limpio y contextual,
similar en ergonomia a herramientas como Figma, pero adaptado a GIS y planta
externa GPON.

## Principio de experiencia

```txt
Visualizacion = leer y entender la red.
Edicion       = concentrarse y construir.
Operacion    = diagnosticar afectaciones.
```

El mapa no debe mostrar siempre la misma informacion. La UI debe adaptar
paneles, capas, etiquetas y controles segun la tarea actual.

## Modos principales

### 1. Modo visualizacion

Objetivo:

```txt
Explorar la red.
Entender jerarquia.
Consultar estado.
Leer capacidad y cobertura tecnica.
```

Caracteristicas:

```txt
Mapa mas informativo.
Capas progresivas por zoom.
Etiquetas visibles segun escala.
Leyenda disponible.
Panel izquierdo enfocado en capas y busqueda.
Panel derecho aparece solo al seleccionar.
Controles de zoom visibles.
```

Acciones:

```txt
Seleccionar elemento.
Buscar elemento.
Filtrar por tipo.
Filtrar por estado.
Activar/desactivar capas.
Centrar red.
Ver detalles.
Ver advertencias.
Medir distancia.
```

### 2. Modo edicion

Objetivo:

```txt
Dibujar y corregir infraestructura con la menor friccion posible.
```

Caracteristicas:

```txt
Mapa mas limpio, como lienzo.
Menos etiquetas del mapa base.
Menos paneles flotantes permanentes.
Capas visibles segun herramienta activa.
Instrucciones claras en barra inferior.
Panel derecho contextual siempre disponible.
Panel izquierdo colapsable.
Leyenda oculta por defecto.
Controles de zoom integrados en la UI propia.
```

Acciones:

```txt
Crear OLT.
Crear splitter.
Crear NAP.
Dibujar ruta de fibra.
Marcar cruce.
Marcar reserva.
Marcar empalme.
Mover/corregir ubicacion.
Editar propiedades minimas.
Eliminar si el rol lo permite.
Cancelar accion.
Guardar cambio.
```

### 3. Modo operacion

No es parte central del MVP, pero debe quedar previsto.

Objetivo:

```txt
Consultar afectaciones, incidentes y estado de servicio.
```

Caracteristicas futuras:

```txt
Mapa orientado a estado.
Capas de incidentes y afectaciones.
Busqueda de clientes.
Infraestructura en lectura.
Panel derecho con incidente/servicio.
```

Acciones futuras:

```txt
Buscar cliente.
Ver NAP asociada.
Ver clientes afectados.
Crear incidente.
Actualizar incidente.
Consultar red en solo lectura.
```

## Visibilidad por zoom

La visibilidad progresiva aplica principalmente en **modo visualizacion**.

### Zoom lejano

Objetivo:

```txt
Entender la red a nivel ciudad/zona.
```

Mostrar:

```txt
OLTs.
Clusters o resumen por zona si aplica.
Alertas criticas globales.
```

Ocultar:

```txt
Splitters.
NAPs.
Rutas distribution.
Cruces, reservas y empalmes.
Etiquetas detalladas.
```

### Zoom medio

Objetivo:

```txt
Entender estructura principal de red.
```

Mostrar:

```txt
OLTs.
Rutas feeder.
Splitters principales.
Alertas de infraestructura.
```

Ocultar o reducir:

```txt
NAPs si saturan el mapa.
Puntos relevantes de ruta.
Etiquetas largas.
```

### Zoom cercano

Objetivo:

```txt
Leer red de distribucion.
```

Mostrar:

```txt
OLTs.
Splitters.
NAPs.
Rutas feeder.
Rutas distribution.
Estados.
Codigos principales.
Advertencias de dato.
```

### Zoom muy cercano

Objetivo:

```txt
Inspeccionar detalle tecnico.
```

Mostrar:

```txt
Cruces.
Reservas.
Empalmes.
Etiquetas completas.
Longitudes.
Calidad de ubicacion.
Calidad de ruta.
Capacidad relevante.
```

## Reglas especiales en modo edicion

En modo edicion, la herramienta activa tiene prioridad sobre las reglas de
zoom. Si una capa es necesaria para completar una accion, debe mostrarse aunque
normalmente estuviera oculta por zoom.

### Seleccionar

Mostrar:

```txt
Elementos visibles por zoom.
Rutas visibles por zoom.
Seleccion resaltada.
```

Panel derecho:

```txt
Propiedades del elemento seleccionado.
```

### Crear OLT

Mostrar:

```txt
Mapa base limpio.
OLTs existentes.
Zonas o referencias principales.
```

Ocultar:

```txt
NAPs.
Puntos relevantes.
Incidentes no criticos.
Leyenda.
```

Barra inferior:

```txt
Click en el mapa para crear una OLT provisional.
Esc para cancelar.
```

### Crear splitter

Mostrar:

```txt
OLTs.
Rutas feeder.
Splitters cercanos.
```

Resaltar:

```txt
Posibles rutas feeder de conexion.
```

Barra inferior:

```txt
Click en el mapa para crear un splitter.
Completa ratio y perdida en el panel derecho.
```

### Crear NAP

Mostrar:

```txt
Splitters.
Rutas distribution.
NAPs cercanas.
```

Ocultar:

```txt
OLTs lejanas si no aportan contexto.
Puntos relevantes no relacionados.
```

Barra inferior:

```txt
Click para crear NAP. Repite clicks para crear varias. Esc para salir.
```

### Dibujar fibra

Mostrar:

```txt
Elementos conectables.
Rutas existentes relevantes.
Vertices temporales.
Linea temporal.
Distancia acumulada.
```

Resaltar:

```txt
Origen seleccionado.
Destino al pasar el cursor.
Snap a elementos cercanos.
```

Barra inferior:

```txt
Click origen -> vertices -> click destino. Enter finaliza. Esc cancela.
```

Panel derecho:

```txt
Tipo de ruta.
Origen.
Destino.
Longitud calculada.
Calidad de ruta.
Datos tecnicos minimos.
```

### Marcar cruce

Mostrar:

```txt
Rutas de fibra.
Cruces existentes.
```

Ocultar:

```txt
Elementos no relacionados si saturan.
```

Regla:

```txt
El punto debe asociarse a una ruta.
El click debe ajustarse visualmente a la linea.
```

### Marcar reserva

Mostrar:

```txt
Rutas de fibra.
Reservas existentes.
```

Panel derecho:

```txt
Longitud aproximada.
Estado.
Observacion.
```

### Marcar empalme

Mostrar:

```txt
Rutas de fibra.
Empalmes existentes.
```

Panel derecho:

```txt
Codigo.
Estado.
Perdida estimada.
Observacion.
```

### Medir distancia

Mostrar:

```txt
Linea temporal de medicion.
Vertices de medicion.
Distancia parcial.
Distancia total.
```

No debe crear datos persistentes.

### Eliminar

Mostrar:

```txt
Elementos eliminables segun rol.
Confirmacion contextual.
Dependencias o advertencias.
```

Regla:

```txt
Eliminar debe ser restringido por RLS y rol.
La UI solo reduce errores; no reemplaza permisos de base.
```

## Paneles

### Barra superior

Debe ser compacta. Una sola barra.

Contenido:

```txt
Proyecto / organizacion.
Busqueda global.
Selector de modo.
Rol actual.
Estado de cambios.
Usuario / salir.
```

No debe duplicar un segundo encabezado grande dentro del canvas.

### Toolbar de herramientas

Debe ser compacta, iconica y persistente en modo edicion.

Grupos:

```txt
Navegacion: seleccionar, mover.
Elementos: OLT, splitter, NAP.
Rutas: fibra, cruce, reserva, empalme.
Revision: medir, eliminar.
```

Reglas:

```txt
Usar iconos con tooltip.
Mostrar estado activo claro.
No depender solo de letras como iconos finales.
Permitir atajos de teclado.
```

### Panel izquierdo

Debe funcionar como navegacion/capas, no como panel de propiedades.

Tabs recomendados:

```txt
Capas.
Elementos.
Calidad.
```

Capas:

```txt
OLT.
Splitters.
NAPs.
Rutas feeder.
Rutas distribution.
Cruces.
Reservas.
Empalmes.
```

Elementos:

```txt
Busqueda.
Listado jerarquico.
Filtros compactos.
Seleccion y centrado.
```

Calidad:

```txt
Datos incompletos.
Ubicaciones aproximadas.
Rutas sin destino.
NAPs sin capacidad.
Splitters sin ratio.
Empalmes sin perdida.
```

### Panel derecho

Es el panel de propiedades contextuales.

Debe aparecer al seleccionar o crear algo.

Estados:

```txt
Sin seleccion.
Elemento seleccionado.
Ruta seleccionada.
Punto relevante seleccionado.
Creacion provisional.
```

Sin seleccion:

```txt
Resumen del proyecto.
Calidad general.
Ultimos cambios.
```

Elemento:

```txt
Codigo.
Nombre.
Tipo.
Estado.
Calidad de ubicacion.
Campos tecnicos por tipo.
Notas.
Advertencias.
Acciones permitidas.
```

Ruta:

```txt
Codigo.
Tipo.
Estado.
Origen.
Destino.
Longitud.
Calidad de ruta.
Tipo de fibra.
Perdidas.
Notas.
Advertencias.
```

Punto relevante:

```txt
Tipo.
Ruta asociada.
Ubicacion.
Posicion sobre ruta.
Campos tecnicos por tipo.
Observacion.
```

### Barra inferior

Debe ser la guia de accion.

Contenido:

```txt
Herramienta activa.
Instruccion contextual.
Distancia temporal si aplica.
Coordenadas del cursor.
Zoom actual.
Atajos importantes.
Advertencias no bloqueantes.
```

Ejemplos:

```txt
Crear NAP: Click para crear. Repite para crear varias. Esc cancela.
Dibujar fibra: Click origen -> vertices -> destino. Enter finaliza.
Marcar empalme: Selecciona una ruta y haz click sobre la fibra.
```

### Leyenda

No debe ser flotante permanente en modo edicion.

Opciones:

```txt
Moverla al tab Capas.
Mostrarla como popover desde un boton.
Mostrarla solo en modo visualizacion.
```

### Controles de mapa

Los controles nativos de Mapbox no encajan visualmente con el editor final.

Se recomienda crear controles propios:

```txt
Zoom in.
Zoom out.
Centrar red.
Reset norte.
Ajustar a seleccion.
Ubicacion actual futura.
```

Reglas:

```txt
Mismo estilo que toolbar.
No competir con panel derecho.
No ocupar la esquina superior derecha si ahi vive el selector de modo/usuario.
```

Ubicacion recomendada:

```txt
Inferior derecha, encima de la barra inferior.
```

## Matriz de acciones por rol en MVP

### admin

Modos:

```txt
Visualizacion.
Edicion.
Calidad.
```

Acciones:

```txt
Todas las acciones de infraestructura.
Eliminar.
Corregir datos.
Ver auditoria.
Gestionar configuracion.
```

### network_engineer

Modos:

```txt
Visualizacion.
Edicion.
Calidad.
```

Acciones:

```txt
Crear/editar OLT.
Crear/editar splitter.
Crear/editar NAP.
Dibujar/corregir rutas.
Validar datos.
Ver capacidad.
Ver presupuesto optico base.
Revisar calidad.
```

Restricciones:

```txt
No gestiona usuarios.
No modifica BSS/comercial.
Eliminar puede requerir permiso especial.
```

### outside_plant

Modos:

```txt
Visualizacion.
Edicion.
```

Acciones:

```txt
Crear/corregir elementos fisicos.
Dibujar rutas segun campo.
Marcar cruce.
Marcar reserva.
Marcar empalme.
Registrar observaciones as-built.
Reportar incidente tecnico.
```

Restricciones:

```txt
No valida cambios criticos como aprobador final.
No cambia parametros globales de diseno.
No modifica BSS/comercial.
Eliminar restringido.
```

### installer

Fuera del flujo principal del MVP.

Modo futuro:

```txt
Instalacion.
```

### support

Fuera del flujo principal del MVP.

Modo futuro:

```txt
Operacion.
```

## Prioridad de implementacion UI

### Prioridad 1

```txt
Unificar top bar.
Definir selector de modo.
Separar panel izquierdo en Capas / Elementos / Calidad.
Crear panel derecho contextual.
Mover leyenda fuera del canvas permanente.
```

### Prioridad 2

```txt
Definir visibilidad por zoom para visualizacion.
Definir visibilidad por herramienta para edicion.
Reemplazar controles Mapbox por controles propios.
Mejorar toolbar con iconos y tooltips.
```

### Prioridad 3

```txt
Estados de dibujo de fibra.
Snapping visual.
Creacion repetida de NAPs.
Medicion temporal.
Advertencias contextuales.
```

## Criterio de exito UX

El editor cumple su objetivo cuando:

```txt
En visualizacion, la red se entiende sin saturacion.
En edicion, el mapa se siente como lienzo limpio.
Cada herramienta muestra solo lo necesario.
El panel derecho siempre responde a la seleccion.
Las advertencias ayudan sin bloquear.
Los controles del mapa parecen parte del producto.
```
