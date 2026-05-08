# Modelo profesional de rutas, mufas, NAPs e hilos

## Objetivo

Definir como debe evolucionar el sistema desde un mapa simple de elementos y lineas hacia una herramienta profesional de planta externa GPON/FTTH, sin sobrecargar la captura rapida.

La decision principal es separar tres niveles:

1. **Plano fisico**: lo que se dibuja en el mapa.
2. **Detalle de cable e hilos**: lo que ocurre dentro del cable.
3. **Logica optica**: como se alimentan splitters, NAPs y clientes.

## Principio de diseno

El mapa no debe dibujar cada hilo como una linea independiente.

El mapa representa el **cable fisico** y sus puntos de intervencion. La ocupacion de hilos debe mostrarse en inspectores, tablas o diagramas logicos, porque dibujar 12, 24 o 48 hilos en paralelo hace que el plano sea ilegible.

## Ruta de fibra

Una ruta de fibra representa el trayecto fisico de un cable entre puntos de la red.

Una ruta debe tener:

- Origen fisico.
- Destino fisico.
- Geometria en mapa con vertices.
- Cantidad de hilos, por ejemplo `12F`, `24F`, `48F`.
- Tipo de fibra, por ejemplo `G.652D`, `G.657A1`, `G.657A2`.
- Tipo de instalacion: aerea, subterranea, ducto, fachada.
- Longitud calculada.
- Estado: planificada, instalada, activa, danada, retirada.
- Puntos fisicos sobre el trayecto: mufa, empalme, sangrado, reserva, cruce.

La ruta no equivale a un hilo. Es el cable completo.

## Mufa o manga

Una mufa es un punto fisico donde se interviene el cable.

Puede servir para:

- Empalmar cables.
- Sangrar uno o varios hilos.
- Dejar hilos en paso sin tocarlos.
- Reservar fibra para mantenimiento o crecimiento.
- Derivar un cable hacia otra zona.
- Alojar un splitter, si el diseno lo permite.

Para el sistema, una mufa no deberia tratarse solo como un punto decorativo. Conviene modelarla como un nodo fisico seleccionable cuando:

- Tiene cables entrantes y salientes.
- Aloja splitter.
- Administra hilos.
- Tiene empalmes importantes.
- Es punto clave para trazabilidad.

## NAP

La NAP debe entenderse como un punto de acceso o distribucion hacia clientes, no necesariamente como un punto terminal.

Una NAP puede combinar dos dimensiones:

### Como se conecta al cable

- `terminal`: el cable termina ahi.
- `midspan_sangrado`: el cable pasa, se abre y se toma uno o mas hilos.
- `pass_through`: el cable pasa y queda preparado o con minima intervencion.

### Que hace con el hilo usado

- `splitter_internal`: el hilo entra a un splitter interno, por ejemplo `1:8` o `1:16`.
- `splice_only`: solo empalme o derivacion, sin splitter.
- `adapter_only`: distribucion mediante adaptadores/conectores.
- `reserved`: preparado para uso futuro.

Ejemplo comun:

```text
Cable 12F pasa por la NAP
Hilo 01 azul se sangra
Hilo 01 entra a splitter interno 1:16
16 salidas drop hacia clientes
Hilos 02-12 continuan
```

Por eso "NAP con sangrado" y "NAP con splitter interno" no son opciones excluyentes. Una describe como accede al cable; la otra describe que hace con el hilo.

## Codigo de colores de hilos

El estandar mas comun es TIA/EIA-598, con una secuencia base de 12 colores:

| Numero | Color |
| ---: | --- |
| 1 | Azul |
| 2 | Naranja |
| 3 | Verde |
| 4 | Marron |
| 5 | Gris |
| 6 | Blanco |
| 7 | Rojo |
| 8 | Negro |
| 9 | Amarillo |
| 10 | Violeta |
| 11 | Rosa |
| 12 | Aqua |

En cables mayores a 12 hilos se repite la secuencia por tubos o buffers.

Ejemplo `24F`:

```text
Tubo azul: hilos 1-12
Tubo naranja: hilos 13-24
```

El hilo 13 seria:

```text
Tubo naranja / fibra azul
```

## Ocupacion de hilos

La ocupacion de hilos debe ser una vista logica asociada a la ruta, no una geometria adicional en el mapa.

Ejemplo para cable `12F`:

| Hilo | Color | Estado | Uso |
| ---: | --- | --- | --- |
| 1 | Azul | Usado | Splitter 1:4 en Mufa 01 |
| 2 | Naranja | En paso | Sangrado NAP 02 |
| 3 | Verde | En paso | Sangrado NAP 03 |
| 4 | Marron | Reservado | Futuro crecimiento |
| 5-12 | Varios | Disponible | Sin asignacion |

Estados sugeridos:

- `available`: disponible.
- `used`: usado.
- `reserved`: reservado.
- `pass_through`: en paso.
- `spliced`: empalmado.
- `damaged`: danado.

## Complejidad por niveles

### Nivel 1: Basico

Facil de implementar.

- Crear elementos.
- Crear rutas fisicas.
- Editar vertices.
- Registrar `fiber_count`, tipo de fibra e instalacion.
- Mostrar longitud.

### Nivel 2: Intermedio

Moderado.

- Generar tabla de hilos segun `fiber_count`.
- Aplicar codigo de colores.
- Marcar estados de hilos.
- Mostrar resumen de ocupacion por ruta.

### Nivel 3: Profesional

Complejo.

- Modelar sangrados reales.
- Empalmes hilo a hilo.
- Splitters internos en mufa o NAP.
- Continuidad de hilos entre tramos.
- Trazabilidad desde OLT hasta NAP/cliente.
- Presupuesto optico por rama.

## Recomendacion

No implementar el nivel profesional completo de inmediato.

Si conviene preparar el modelo para no bloquearlo despues:

- Toda ruta debe soportar `fiber_count`.
- Mufa debe existir como nodo o punto fisico seleccionable.
- NAP debe soportar acceso `terminal`, `midspan_sangrado` y `pass_through`.
- El sistema debe separar cable fisico, hilo logico y ruta optica.

La captura rapida debe seguir siendo simple. El detalle profesional debe aparecer al editar una ruta, mufa o NAP.

## Lista inicial de tareas

### Fase 1: Captura fisica limpia

- [ ] Mantener captura rapida enfocada en crear OLT, Splitter, NAP y rutas.
- [ ] Crear rutas de fibra localmente entre elementos.
- [ ] Permitir insertar y mover vertices de rutas en captura.
- [ ] Agregar `fiber_count` por defecto a rutas nuevas, inicialmente `12`.
- [ ] Permitir editar `fiber_count`, tipo de fibra e instalacion desde el inspector de ruta.
- [ ] Mostrar etiqueta simple en ruta: codigo + `12F`.

### Fase 2: Puntos fisicos sobre rutas

- [ ] Definir si `mufa` sera nuevo tipo de elemento o nuevo tipo de route point.
- [ ] Agregar punto fisico `mufa`.
- [ ] Agregar punto fisico `sangrado`.
- [ ] Agregar punto fisico `reserva`.
- [ ] Agregar punto fisico `cruce`.
- [ ] Permitir click derecho sobre ruta para agregar punto fisico.

### Fase 3: Tabla de hilos

- [ ] Implementar helper para generar colores TIA/EIA-598 por cantidad de hilos.
- [ ] Crear vista simple de ocupacion de hilos en inspector de ruta.
- [ ] Mostrar hilos disponibles, usados, reservados y en paso.
- [ ] Permitir asignar estado basico a un hilo.
- [ ] Registrar uso descriptivo por hilo.

### Fase 4: NAP y mufa profesionales

- [ ] Agregar propiedades de NAP: `cable_access_type` y `distribution_type`.
- [ ] Permitir NAP con sangrado y splitter interno al mismo tiempo.
- [ ] Permitir splitter interno en mufa.
- [ ] Modelar continuidad de hilos despues de sangrado.
- [ ] Relacionar hilo usado con splitter o NAP.

### Fase 5: Logica optica

- [ ] Crear diagrama logico desde asignaciones de hilos.
- [ ] Calcular presupuesto optico por rama.
- [ ] Validar split ratio total.
- [ ] Alertar rutas o ramas con presupuesto ajustado o deficiente.
- [ ] Trazar camino desde OLT hasta NAP/cliente.
