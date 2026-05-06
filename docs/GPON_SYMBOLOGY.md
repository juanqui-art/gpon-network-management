# Simbologia visual GPON

## Objetivo

Definir una simbologia coherente para representar la red GPON en el mapa operativo del sistema. La meta es que el usuario pueda leer rapidamente la topologia, identificar equipos, distinguir tipos de fibra y detectar estados o incidentes sin que el basemap compita visualmente con la infraestructura del proyecto.

## Hallazgos principales

No existe una simbologia universal unica para redes GPON/FTTH en mapas web. En la practica, los operadores, herramientas GIS/CAD y sistemas de planta externa usan convenciones parecidas, pero adaptadas al contexto de operacion.

La estructura visual debe respetar la arquitectura tecnica:

```txt
OLT -> Splitter -> NAP -> ONT
```

En redes FTTH/GPON tambien es habitual distinguir los segmentos de fibra segun su funcion:

```txt
Feeder -> Distribution -> Drop
```

Los planos tecnicos de fibra suelen representar activos como OLT, divisores opticos, cajas de empalme, terminales de acceso, cierres, postes, ductos y acometidas. Para una aplicacion web operativa, conviene simplificar esa simbologia CAD en iconos mas legibles y consistentes con GIS.

## Criterio visual adoptado

El mapa base y la interfaz usan una escala de grises oscura. Por eso, la red GPON debe ser la capa con color.

```txt
Basemap + UI = grises neutros
Red GPON + estados = color operativo
```

La decision principal es separar dos dimensiones:

```txt
Color principal = tipo de activo GPON
Estado operativo = anillo, badge, halo o pulso
Incidente = badge adicional por severidad
```

Esto evita que un equipo cambie visualmente de categoria cuando cambia de estado. Por ejemplo, una ONT sigue siendo verde aunque este fuera de linea; el problema se indica con el anillo o badge de estado.

## Simbologia de equipos

| Elemento | Funcion | Forma/icono | Color |
|---|---|---|---|
| OLT | Nodo central o agregador GPON | Rack/cuadrado tecnico | `#38bdf8` |
| Splitter | Division optica pasiva | Rombo/derivacion | `#a78bfa` |
| NAP | Punto de acceso/terminal de distribucion | Caja/terminal | `#f59e0b` |
| ONT | Equipo final del cliente | Circulo/punto cliente | `#34d399` |
| Amplifier | Equipo especial si aplica | Marcador tecnico | `#fde047` |
| WDM | Multiplexacion optica si aplica | Marcador tecnico | `#22d3ee` |

## Simbologia de fibra

| Segmento | Funcion | Estilo recomendado |
|---|---|---|
| Feeder | Tramo troncal desde OLT hacia distribucion | Azul `#38bdf8`, linea mas gruesa |
| Distribution | Tramo desde splitter/distribucion hacia NAP | Violeta `#a78bfa`, grosor medio |
| Drop | Acometida desde NAP hacia ONT | Verde `#34d399`, linea fina y punteada |

La jerarquia de grosor ayuda a leer capacidad e importancia: feeder mas fuerte, distribucion intermedia, drop mas ligera.

## Estados operativos

| Estado | Color | Representacion |
|---|---|---|
| Online | `#34d399` | Anillo sutil |
| Alarm | `#fb4d6d` | Anillo fuerte, badge y pulso |
| Offline | `#858585` | Anillo gris y badge |
| Maintenance | `#f59e0b` | Anillo ambar y badge |
| Decommissioned | `#5c5d5f` | Anillo gris oscuro |
| Unknown | `#a4a4a4` | Anillo neutro |

El estado no debe reemplazar el color del tipo de equipo. Debe aparecer como senal secundaria para conservar la lectura topologica.

## Incidentes

Los incidentes se muestran como un badge adicional sobre el marcador. Su color depende de la severidad:

| Severidad | Color |
|---|---|
| Critical | `#fb4d6d` |
| High | `#f59e0b` |
| Medium | `#fde047` |
| Low | `#38bdf8` |

Cuando un equipo tiene incidente activo, el badge de incidente debe tener mas prioridad visual que los metadatos secundarios, pero sin ocultar la forma principal del equipo.

## Relacion con el estilo Mapbox

El estilo actual importa `mapbox://styles/mapbox/standard` y usa configuracion oscura:

```json
{
  "theme": "monochrome",
  "lightPreset": "night",
  "showPointOfInterestLabels": false,
  "showTransitLabels": false,
  "show3dObjects": false,
  "showRoadLabels": true,
  "showPlaceLabels": true
}
```

La captura del mapa confirma una paleta basada casi totalmente en grises. Por eso los colores GPON deben reservarse para capas propias: equipos, fibra, estados e incidentes.

## Implementacion actual

La implementacion actual esta en:

- `apps/web/components/map/readonly-map-viewer.tsx`
- `apps/web/components/map/network-editor-map.tsx`
- `apps/web/components/map/equipment-layers.ts`
- `apps/web/components/map/equipment-panel.tsx`
- `apps/web/app/globals.css`

En el mapa:

- El color principal del marcador viene del tipo de equipo.
- El anillo representa el estado operativo.
- El badge superior representa incidentes activos.
- La leyenda separa equipos, estados y fibra.
- Las fibras usan color y grosor segun su tipo.

En el panel:

- La franja superior usa el color del tipo de equipo.
- El punto de estado usa el color operativo.
- Los detalles mantienen la paleta gris del basemap.

## Referencias consultadas

- Mapbox Style Specification: https://docs.mapbox.com/style-spec/
- Mapbox Standard style: https://docs.mapbox.com/mapbox-gl-js/guides/styles/set-a-style/
- The Fiber Optic Association, FTTH references: https://www.thefoa.org/
- Telecomate, GPON FTTH network components: https://www.telecomate.com/ftth-network-based-on-gpon/
- Electrical Symbols, fiber optic symbols: https://www.electrical-symbols.com/electric-electronic-symbols/fiber-optic-symbols.htm
- CADprofi telecommunication map symbols: https://www.cadprofi.com/online-help/en/electrical_maps_pilars.htm

## Regla de diseno

Si se agrega un nuevo activo o capa, primero debe clasificarse en una de estas dimensiones:

```txt
Que es?      -> tipo de activo o segmento
Como esta?   -> estado operativo
Que pasa?    -> incidente, alerta o evento
```

Cada dimension debe tener una representacion visual distinta. Esto mantiene el mapa legible cuando la red crezca.
