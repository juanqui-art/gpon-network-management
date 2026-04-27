# Tareas MVP - Editor de Infraestructura GPON

Fecha de actualizacion: 2026-04-27

## Realizado

### Documentacion

- [x] Cerrar alcance MVP como Editor de Infraestructura GPON.
- [x] Documentar roles base del sistema.
- [x] Encajar roles con el MVP.
- [x] Documentar especificacion UI/UX por modo, zoom y herramienta.

### Modelo y tipos

- [x] Definir tipos frontend para `InfrastructureElement`.
- [x] Definir tipos frontend para `FiberRoute`.
- [x] Definir tipos frontend para `RoutePoint`.
- [x] Mantener aliases transicionales para no romper la UI anterior.

### RPCs de lectura

- [x] Crear `infrastructure_elements_for_map()`.
- [x] Crear `fiber_routes_for_map()`.
- [x] Crear `route_points_for_map()`.
- [x] Adaptar la pagina del mapa para consumir los 3 datasets.

### UI shell del editor

- [x] Agregar modo `Visualizar / Editar`.
- [x] Mover toolbar de edicion a la parte inferior.
- [x] Crear panel izquierdo con tabs: `Capas`, `Elementos`, `Calidad`.
- [x] Crear panel derecho contextual.
- [x] Crear controles de mapa propios.
- [x] Ocultar leyenda permanente en modo edicion.
- [x] Ajustar layout para reducir solapes entre paneles y zoom.

### Render de mapa

- [x] Renderizar elementos OLT / splitter / NAP.
- [x] Renderizar rutas de fibra.
- [x] Renderizar puntos relevantes: cruce / reserva / empalme.
- [x] Agregar popup y seleccion para rutas.
- [x] Agregar popup y seleccion para puntos relevantes.
- [x] Actualizar realtime para tablas MVP:
  - [x] `infrastructure_elements`
  - [x] `fiber_routes`
  - [x] `route_points`

### Panel contextual

- [x] Mostrar propiedades de elemento.
- [x] Mostrar propiedades de ruta.
- [x] Mostrar propiedades de punto relevante.
- [x] Mostrar estado sin seleccion.
- [x] Mostrar draft de elemento.
- [x] Mostrar draft de ruta.

### Crear elementos

- [x] Herramienta Crear OLT.
- [x] Herramienta Crear splitter.
- [x] Herramienta Crear NAP.
- [x] Crear marker provisional al hacer click en el mapa.
- [x] Editar datos minimos antes de guardar.
- [x] Crear RPC `create_infrastructure_element_draft()`.
- [x] Guardar OLT / splitter / NAP en `infrastructure_elements`.
- [x] Refrescar mapa despues de guardar.

### Dibujar fibra

- [x] Seleccionar origen desde un elemento.
- [x] Agregar vertices intermedios sobre el mapa.
- [x] Seleccionar destino desde otro elemento.
- [x] Dibujar linea temporal.
- [x] Calcular longitud aproximada.
- [x] Crear draft de ruta.
- [x] Editar datos minimos de ruta antes de guardar.
- [x] Crear RPC `create_fiber_route_draft()`.
- [x] Guardar ruta en `fiber_routes`.

### Validacion tecnica

- [x] `pnpm check`.
- [x] `pnpm exec tsc --noEmit`.
- [x] Corregir lectura de variables `NEXT_PUBLIC_*` en cliente.

## Pendiente

### Puntos relevantes sobre rutas

- [ ] Herramienta Marcar cruce.
- [ ] Herramienta Marcar reserva.
- [ ] Herramienta Marcar empalme.
- [ ] Detectar click sobre una ruta segun herramienta activa.
- [ ] Ajustar punto visualmente a la ruta.
- [ ] Crear draft de `RoutePoint`.
- [ ] Editar datos minimos por tipo:
  - [ ] Cruce: referencia, tipo, riesgo, observacion.
  - [ ] Reserva: longitud aproximada, estado, observacion.
  - [ ] Empalme: codigo, estado, perdida estimada, observacion.
- [ ] Crear RPC `create_route_point_draft()`.
- [ ] Guardar en `route_points`.

### Mejoras de creacion

- [ ] Permitir creacion repetida de NAPs con autosave.
- [ ] Generar codigos secuenciales desde base de datos.
- [ ] Validar codigo duplicado antes de guardar.
- [ ] Mostrar errores de RLS/autorizacion con mensajes amigables.
- [ ] Evitar guardar si falta geometria o tipo.

### Edicion de entidades existentes

- [ ] Editar OLT existente.
- [ ] Editar splitter existente.
- [ ] Editar NAP existente.
- [ ] Editar ruta existente.
- [ ] Editar punto relevante existente.
- [ ] Crear RPCs o acciones de update.
- [ ] Refrescar mapa despues de actualizar.

### Eliminacion

- [ ] Definir confirmacion contextual.
- [ ] Mostrar dependencias antes de eliminar.
- [ ] Eliminar elemento segun rol.
- [ ] Eliminar ruta segun rol.
- [ ] Eliminar punto relevante segun rol.
- [ ] Restringir delete a `admin` por RLS.

### Capas y filtros

- [ ] Hacer funcionales los toggles de capas.
- [ ] Separar filtros por elementos, rutas y puntos.
- [ ] Aplicar visibilidad progresiva por zoom en modo visualizacion.
- [ ] Aplicar visibilidad por herramienta activa en modo edicion.
- [ ] Agregar busqueda de elementos.

### UX de dibujo

- [ ] Agregar vertices visibles en ruta temporal.
- [ ] Permitir deshacer ultimo vertice.
- [ ] Permitir finalizar ruta con Enter.
- [ ] Permitir cancelar ruta con Esc.
- [ ] Mostrar distancia parcial en barra inferior.
- [ ] Agregar snapping visual a elementos.
- [ ] Agregar snapping de punto relevante a ruta.

### Calidad de datos

- [ ] Panel de calidad con advertencias reales.
- [ ] NAP sin capacidad.
- [ ] Splitter sin ratio.
- [ ] OLT sin puertos PON.
- [ ] Ruta sin origen/destino.
- [ ] Ruta no verificada.
- [ ] Elemento con ubicacion aproximada.
- [ ] Reserva sin longitud.
- [ ] Empalme sin perdida estimada.

### Roles y permisos

- [ ] Leer rol actual desde JWT/app metadata.
- [ ] Adaptar UI por rol:
  - [ ] `admin`
  - [ ] `network_engineer`
  - [ ] `outside_plant`
- [ ] Ocultar acciones no permitidas.
- [ ] Mantener RLS como seguridad real.

### Pulido visual

- [ ] Reemplazar letras de toolbar por iconos.
- [ ] Agregar tooltips consistentes.
- [ ] Mejorar responsive/mobile.
- [ ] Ajustar contraste y densidad de paneles.
- [ ] Revisar solapes en distintas resoluciones.

## Proximo paso recomendado

Implementar puntos relevantes sobre rutas:

```txt
Marcar cruce
Marcar reserva
Marcar empalme
```

Este paso cierra la parte principal del MVP de infraestructura:

```txt
OLT / splitter / NAP
Rutas de fibra
Cruces / reservas / empalmes
```
