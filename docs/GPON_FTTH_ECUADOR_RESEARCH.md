# Investigacion GPON/FTTH Ecuador para continuidad del proyecto

Fecha: 2026-04-28

## Proposito

Este documento consolida los hallazgos de las investigaciones compartidas sobre
topologias GPON/FTTH, parametros de diseno y practicas de despliegue en Ecuador.
Su objetivo es convertir la investigacion tecnica en criterios accionables para
continuar el desarrollo del sistema GPON Network Management System.

Fuentes base:

- `/Users/juanquizhpi/Desktop/Topologías GPON_FTTH en Ecuador.md`
- `/Users/juanquizhpi/Desktop/Despliegue GPON_FTTH Ecuador_ Parámetros Diseño.md`
- `/Users/juanquizhpi/Desktop/Arquitertura y Modelado de Datos.md`
- `/Users/juanquizhpi/Desktop/Cálculo Presupuesto Óptico FTTH Ecuador (1).md`
- `/Users/juanquizhpi/Desktop/Gestión FTTH_GPON Ecuador_ As-Built y Etiquetado.md`

## Resumen ejecutivo

El mercado ecuatoriano de internet fijo esta migrando de cobre/HFC hacia FTTH.
GPON sigue siendo la tecnologia dominante para despliegues masivos, mientras
XGS-PON gana importancia para servicios simetricos, planes multi-gigabit,
clientes empresariales y zonas de alta demanda.

Para el proyecto, esto confirma que el MVP debe priorizar una representacion
geoespacial clara de la planta externa: OLT, splitters, NAPs, rutas de fibra,
capacidad, calidad de datos y advertencias tecnicas. Las nuevas investigaciones
refuerzan dos decisiones de fondo: el sistema debe separar inventario fisico,
conectividad logica, informacion comercial y operacion; ademas, debe evolucionar
hacia una calculadora de presupuesto optico que valide si una red dibujada puede
operar con margen real. La investigacion de as-built y etiquetado agrega una
tercera decision: cada activo visible en campo debe tener un codigo operativo
consistente, trazable y verificable desde el mapa.

## Hallazgos clave para el sistema

### 1. La arquitectura base debe respetar la cadena GPON

El modelo tecnico principal se mantiene como:

```txt
OLT -> Splitter -> NAP -> ONT
```

En el MVP actual el foco esta en:

```txt
OLT -> Splitter -> NAP
```

La capa de clientes, ONTs, puertos NAP y acometidas/drop puede entrar en una fase
posterior, pero conviene que el modelo de datos actual no bloquee esa expansion.

Implicacion para el producto:

- OLT, splitter y NAP deben tener identidad tecnica estable.
- Las rutas de fibra deben guardar origen, destino, geometria y tipo de tramo.
- Las conexiones logicas deben poder evolucionar hacia puertos PON, hilos,
  splitters, puertos NAP y ONTs.

### 2. El GIS es una funcion central, no decorativa

Las investigaciones coinciden en que los sistemas GIS reducen tiempos de
respuesta, mejoran la factibilidad comercial y permiten planificar capacidad.
Para un ISP, la documentacion georreferenciada es un activo operativo.

Capas recomendadas:

| Capa | Uso en el sistema |
|---|---|
| Activos GPON | OLT, splitters, NAPs, futuros ONTs |
| Rutas de fibra | Feeder, distribution, futuro drop |
| Puntos de ruta | Cruces, reservas, empalmes |
| Capacidad | Puertos totales, usados y disponibles |
| Calidad de datos | Unknown, approximate, gps_captured, verified |
| Riesgo operativo | Cruces criticos, zonas soterradas, rutas al limite |

Implicacion para el producto:

- La app debe permitir levantar informacion incompleta y mejorarla en campo.
- La calidad del dato debe mostrarse sin bloquear el flujo de trabajo.
- Las advertencias deben guiar al usuario, no impedirle documentar.

### 3. Las topologias deben ser configurables

En Ecuador se observan tres enfoques relevantes:

| Topologia | Uso comun | Impacto tecnico |
|---|---|---|
| Division centralizada | Zonas densas, edificios, zonas ordenadas | Facil diagnostico, mas fibra de distribucion |
| Division en cascada balanceada | Expansiones urbanas/perifericas | Ahorra fibra, aumenta puntos de falla |
| Division desbalanceada en bus | Zonas rurales/suburbanas | Reduce CAPEX, exige calculo optico cuidadoso |

Implicacion para el producto:

- El splitter no debe limitarse a ratios balanceados `1:2`, `1:4`, `1:8`,
  `1:16`, `1:32` o `1:64`.
- En fases posteriores conviene soportar splitters desbalanceados como `10/90`,
  `20/80`, `30/70`, `70/30` o `85/15`.
- La topologia debe poder visualizarse como red geografica y como arbol logico.

### 4. El presupuesto optico debe convertirse en validacion del sistema

El calculo de perdida optica es una de las funciones que mas valor puede dar el
producto. La red no solo debe verse bien en el mapa; debe cumplir margenes de
potencia razonables.

Variables que deben almacenarse o derivarse:

| Variable | Descripcion |
|---|---|
| Longitud de fibra | Calculada desde la geometria PostGIS |
| Tipo de fibra | G.652.D, G.657.A1, G.657.A2 |
| Perdida por km | Segun longitud de onda y fibra |
| Perdida de splitter | Segun ratio o valor medido |
| Conectores | Cantidad y perdida estimada por par |
| Empalmes | Cantidad y perdida estimada |
| Margen de seguridad | Recomendado entre 3 dB y 5 dB |
| Clase optica | B+, C+, u otra segun equipo |

Formula conceptual:

```txt
Perdida total =
  perdida por distancia
  + perdida por splitters
  + perdida por conectores
  + perdida por empalmes
  + margen de seguridad
```

Validaciones utiles:

- Advertir si un enlace GPON queda cerca del limite de Clase B+.
- Advertir si una ruta 1:64 rural requiere Clase C+.
- Advertir si falta margen de seguridad.
- Advertir si se calcula solo downstream y no se considera upstream.
- Comparar perdida teorica con potencia RX medida en ONT cuando exista esa capa.

### 5. La capacidad debe estar presente desde el MVP

La gestion de puertos disponibles es clave para factibilidad comercial y
operacion. Aunque el MVP no implemente aun clientes, las NAPs y splitters deben
guardar datos que permitan proyectar capacidad.

Campos recomendados:

| Elemento | Campos utiles |
|---|---|
| OLT | puertos PON totales, puertos usados, clase optica, tecnologia |
| Puerto PON | tecnologia GPON/XGS-PON, split ratio objetivo, estado |
| Splitter | ratio, perdida nominal, perdida medida, tipo balanceado/desbalanceado |
| NAP | puertos totales, puertos usados, puertos reservados, estado |
| Ruta | tipo, longitud, calidad del dato, estado, riesgo |

Implicacion para el producto:

- El panel de propiedades debe mostrar capacidad usada/libre.
- Una NAP casi llena debe generar advertencia no bloqueante.
- El sistema debe permitir planificar ampliaciones antes de perder ventas por
  falta de puertos.

### 6. Los materiales influyen en reglas de validacion

La investigacion diferencia el uso recomendado de fibra:

| Tramo | Fibra recomendada | Motivo |
|---|---|---|
| Backbone / feeder | G.652.D | Baja atenuacion y enlaces largos |
| Distribucion | G.652.D o G.657.A1 | Balance entre costo y curvatura |
| Drop / interiores | G.657.A2 | Resistencia a curvaturas cerradas |

Tambien se resaltan elementos fisicos importantes: cable ADSS, cable drop,
conectores SC/APC, cajas NAP/CTO IP65/IP68, herrajes de retencion/suspension,
reservas de fibra y etiquetado.

Implicacion para el producto:

- Las rutas deberian poder registrar tipo de cable y tipo de instalacion:
  `aerial`, `duct`, `facade`, `indoor`.
- Las NAPs deberian registrar modelo, capacidad, grado IP y tipo de conector.
- Los puntos de reserva y empalme son necesarios para mantenimiento, no solo
  decoracion cartografica.

### 7. El cumplimiento regulatorio debe aparecer como capa operativa

ARCOTEL y MINTEL exigen ordenamiento, identificacion, soterramiento progresivo y
uso compartido de infraestructura. Para la app, esto puede transformarse en una
capa de cumplimiento.

Reglas candidatas:

- Cable sin codigo de operador: advertencia.
- Ruta aerea en zona marcada como soterrada: advertencia.
- Caja o cable sin etiqueta: advertencia.
- Ruta sin reserva tecnica: advertencia informativa.
- Punto critico sin observacion de riesgo: advertencia.

Estas reglas deben ser configurables porque las ordenanzas municipales y los
criterios de infraestructura compartida pueden variar por ciudad.

### 8. El as-built debe gobernar la red operativa

La red planificada rara vez coincide al 100% con la red construida. En campo
pueden aparecer postes ocupados, ductos no disponibles, rutas cambiadas,
reservas adicionales, empalmes no previstos o activos instalados en ubicaciones
ligeramente distintas.

Estados recomendados para los activos:

| Estado | Significado |
|---|---|
| `planned` | diseñado en oficina |
| `surveyed` | validado en levantamiento o replanteo |
| `in_construction` | construccion iniciada |
| `as_built_pending` | instalado, pendiente de validacion |
| `verified` | verificado en campo con evidencia |
| `operational` | activo con servicio real |
| `damaged` | requiere reparacion |
| `decommissioned` | retirado o fuera de uso |

Implicacion para el producto:

- El mapa debe distinguir diseño, construccion y red verificada.
- Los cambios de campo no deberian actualizar la red maestra sin trazabilidad.
- Las evidencias de campo deben quedar asociadas al activo, no solo a una orden
  de trabajo.

### 9. Los labels conectan GIS, campo y auditoria

La investigacion confirma que no basta con IDs internos. El sistema necesita
separar:

```txt
id interno inmutable -> clave tecnica de base de datos.
codigo operativo -> label que entiende el tecnico.
alias descriptivo -> nombre humano opcional.
QR/codigo de barras -> puente fisico hacia el sistema.
```

El codigo operativo debe ser estable, legible y compatible con zonas, nodos,
rutas y secuencias. El ID interno puede ser UUID, pero el tecnico no deberia
trabajar leyendo UUIDs en campo.

Convencion recomendada:

```txt
{PROV}-{CIUDAD}-{ZONA}-{TIPO}-{SECUENCIA}
```

Ejemplos:

| Activo | Ejemplo |
|---|---|
| NAP Quito Zona 5 | `PIC-UIO-Z05-NAP-128` |
| OLT Quito Nodo Carcelen | `PIC-UIO-CAR-OLT-01` |
| Cable feeder | `PIC-UIO-Z05-FDR-003` |
| Cable distribution | `PIC-UIO-Z05-DST-021` |
| Cierre de empalme | `PIC-UIO-Z05-CJS-014` |
| Reserva | `PIC-UIO-Z05-RES-044` |
| Cruce critico | `PIC-UIO-Z05-CRU-009` |

Para elementos jerarquicos, puede usarse un label operativo compuesto:

```txt
OLT:      PIC-UIO-CAR-OLT-01
PON:      PIC-UIO-CAR-OLT-01/PON-01-03
NAP:      PIC-UIO-Z05-NAP-128
NAP Port: PIC-UIO-Z05-NAP-128/P08
Fiber:    PIC-UIO-Z05-FDR-003/H12
```

Informacion recomendada en etiqueta fisica:

- codigo operativo del activo.
- operador o propietario.
- tipo de activo.
- zona o nodo.
- QR/codigo de barras.
- telefono o identificador NOC si aplica.

Informacion que no debe ir en etiqueta fisica:

- datos personales de clientes.
- credenciales.
- IPs de gestion.
- claves SNMP.
- informacion que cambie con frecuencia.
- topologia sensible demasiado explicita.

Regla de seguridad: el QR debe abrir una URL protegida con autenticacion. El QR
no debe exponer datos sensibles por si mismo.

## Arquitectura OSS/GIS consolidada

Un modelo OSS/GIS para FTTH/GPON combina dos mundos:

```txt
GIS -> donde estan fisicamente los activos.
OSS -> como se conectan, operan y prestan servicio esos activos.
```

La aplicacion debe comportarse como una fuente unica de verdad. Esto evita que el
ISP tenga planos CAD, hojas de calculo, reportes de clientes y datos de OLT
desconectados entre si.

### Separacion de capas del sistema

| Capa | Pregunta que responde | Ejemplos de datos |
|---|---|---|
| Red fisica | Donde esta y que activo existe? | OLT, cables, postes, camaras, NAPs, cierres, ductos |
| Red logica | Como viaja la senal? | puertos PON, hilos, empalmes, splitters, enlaces logicos |
| Red comercial | A quien se le puede vender o instalar? | clientes, direcciones, servicios, factibilidad |
| Red operacional | Que esta fallando o degradandose? | alarmas, potencia RX/TX, tickets, mantenimientos |

Esta separacion permite que el MVP empiece con planta externa sin cerrar el paso
a clientes, monitoreo, SNMP, factibilidad y auditoria.

### Entidades principales recomendadas

| Grupo | Entidades |
|---|---|
| Cabecera | Central Office / PoP, OLT, tarjetas OLT, puertos PON, ODF |
| Planta externa | cables feeder/distribution/drop, cierres, splitters, NAP/CTO |
| Soporte fisico | postes, camaras, ductos, fachadas, rutas soterradas |
| Conectividad | hilos de fibra, puertos, empalmes, patch cords, enlaces logicos |
| Cliente | cliente, direccion, ONT/ONU, roseta optica, servicio |
| Operacion | mediciones opticas, alarmas, incidentes, ordenes de trabajo |
| Gobierno | auditoria, versiones, evidencias de campo, calidad del dato |

### Relaciones que no deben perderse

El sistema debe modelar dos tipos de relaciones:

```txt
Contencion fisica:
Nodo contiene OLT.
OLT contiene tarjetas.
Tarjeta contiene puertos PON.
Cable contiene hilos.
Cierre contiene empalmes.
NAP contiene puertos.

Conectividad logica:
Puerto PON -> hilo feeder -> splitter -> hilo distribution -> NAP -> puerto NAP -> drop -> ONT.
```

Una decision importante es conectar **puertos con puertos**, no solo equipos con
equipos. Esto permite hacer trazados reales, encontrar clientes afectados por un
corte, calcular potencia por ruta y auditar empalmes.

### Modelado geografico con PostGIS

Recomendaciones de almacenamiento:

| Tipo | Geometria | Uso |
|---|---|---|
| OLT, NAP, splitter, poste, camara | `POINT` | activos puntuales |
| Cables y ductos | `LINESTRING` | rutas fisicas |
| Zonas de cobertura o soterramiento | `POLYGON` | analisis espacial |

SRID recomendado:

- Guardar y renderizar en `4326` porque GPS y Mapbox trabajan naturalmente en
  latitud/longitud.
- Transformar a UTM `32717` o `32718` para mediciones en metros cuando se
  necesiten calculos de longitud mas precisos en Ecuador.

Reglas tecnicas relevantes:

- La longitud de un cable no debe depender solo del dibujo: debe sumar
  `reservation_m` por reservas de fibra.
- Los cables no deberian quedar huerfanos: sus extremos deben estar cerca de un
  nodo, NAP, cierre, poste o camara.
- Todas las columnas geograficas deben usar indices `GIST`.
- Codigos como `arcotel_code`, seriales de ONT, IPs de OLT y IDs externos deben
  tener indices B-tree o unicos segun el caso.

### Tablas candidatas por fase

MVP de infraestructura:

| Tabla | Proposito |
|---|---|
| `network_nodes` | nodos, PoP, sitios tecnicos |
| `network_equipment` | OLT, splitter, NAP u otros activos visibles |
| `fiber_routes` | cables feeder/distribution con geometria |
| `route_points` | cruces, reservas, empalmes |
| `audit_logs` | trazabilidad basica de cambios |

Fase logica:

| Tabla | Proposito |
|---|---|
| `olt_cards` | tarjetas dentro de OLT |
| `pon_ports` | puertos PON y clase optica |
| `fiber_strands` | hilos dentro de cada cable |
| `device_ports` | puertos genericos de OLT, ODF, splitter, NAP |
| `logical_links` | conexiones puerto a puerto |
| `splice_connections` | fusiones entre hilos |

Fase comercial/operacional:

| Tabla | Proposito |
|---|---|
| `customers` | clientes y ubicacion |
| `onts` | ONTs, seriales, estado y potencia |
| `services` | planes o servicios activos |
| `optical_measurements` | RX/TX, OTDR, mediciones de campo |
| `incidents` | fallas, cortes y afectacion |
| `work_orders` | cambios de campo y validacion as-built |

## Presupuesto optico consolidado

El presupuesto optico debe convertirse en una validacion tecnica del sistema. La
pregunta central es:

```txt
La potencia que sale del puerto PON llega hasta la ONT/NAP con margen suficiente?
```

### Clases opticas relevantes

| Tecnologia | Clase | Rango de perdida aproximado | Uso esperado |
|---|---|---|---|
| GPON | B+ | 13 a 28 dB | despliegue comun urbano |
| GPON | C+ | 17 a 32 dB | mayor distancia o split alto |
| GPON | C++/C+++ | 20 a 35+ dB | casos exigentes o rurales |
| XGS-PON | N1 | 14 a 29 dB | similar a B+ |
| XGS-PON | N2 | 16 a 31 dB | similar a C |
| XGS-PON | E1 | 18 a 33 dB | similar a C+ |
| XGS-PON | E2 | 20 a 35 dB | alto presupuesto |

La investigacion recomienda usar valores conservadores en Ecuador por humedad,
radiacion UV, variaciones termicas, redes aereas y reparaciones frecuentes.

### Formula de perdida total

```txt
Perdida total =
  perdida por fibra
  + perdida por splitters
  + perdida por conectores/adaptadores
  + perdida por empalmes
  + perdida por filtros WDM/coexistencia si aplica
  + perdidas adicionales
  + margen de seguridad
```

Margen recomendado:

```txt
3 dB a 5 dB
```

### Coeficientes de atenuacion recomendados

| Longitud de onda | Uso | Valor conservador para Ecuador |
|---|---|---|
| 1270 nm | upstream XGS-PON | 0.45 dB/km |
| 1310 nm | upstream GPON | 0.40 dB/km |
| 1490 nm | downstream GPON | 0.30 dB/km |
| 1550 nm | video overlay / RF | 0.25 dB/km |
| 1577 nm | downstream XGS-PON | 0.28 dB/km |

Regla importante: validar tambien upstream. Un enlace puede parecer correcto en
1490 nm y fallar en 1310 nm por mayor atenuacion.

### Modelo canonico usado por la aplicacion

La calculadora del sistema debe trabajar con un escenario conservador de peor
caso. En el codigo actual, la referencia tecnica vive en
`apps/web/lib/gpon/optical-budget.ts` y el diagrama unifilar acumula perdidas en
`components/map/logical-diagram/layout-engine.ts`.

Formula canonica:

```txt
Perdida total =
  (longitud_fibra_km * atenuacion_db_km)
  + suma_perdidas_splitters
  + (cantidad_conectores * 0.5 dB)
  + (cantidad_empalmes * 0.1 dB)
  + margen_seguridad
```

Valores por defecto:

| Parametro | Valor aplicado | Motivo |
|---|---:|---|
| Factor de trenzado / reserva GIS | 1.02x | evita subestimar longitud real del cable |
| Conector/adaptador | 0.5 dB por evento | valor de campo conservador |
| Empalme de fusion | 0.1 dB por evento | valor de diseño conservador |
| Margen de seguridad | 3.0 dB | envejecimiento, reparaciones, suciedad y temperatura |
| Longitud de onda base | 1490 nm | downstream GPON para visualizacion inicial |

Regla importante: el calculo debe evolucionar a doble validacion `1490 nm`
downstream y `1310 nm` upstream. El upstream suele ser mas exigente por su
mayor atenuacion (`0.40 dB/km`) y por la recepcion en rafagas en la OLT.

### Perdidas tipicas de splitters balanceados

| Splitter | Perdida tipica |
|---|---|
| 1:2 | 3.5 dB |
| 1:4 | 7.2 dB |
| 1:8 | 10.5 dB |
| 1:16 | 13.8 dB |
| 1:32 | 17.0 dB |
| 1:64 | 20.5 dB |
| 1:128 | 24.0 dB |

### Splitters desbalanceados para redes en bus

| Ratio | Perdida local | Perdida cascada |
|---|---|---|
| 5/95 | 14.1 dB | 0.4 dB |
| 10/90 | 11.0 dB | 0.6 dB |
| 15/85 | 9.6 dB | 1.1 dB |
| 20/80 | 7.9 dB | 1.4 dB |
| 30/70 | 6.0 dB | 2.0 dB |
| 40/60 | 4.7 dB | 2.7 dB |
| 50/50 | 3.6 dB | 3.6 dB |

En una topologia de bus, la calculadora debe sumar las perdidas de cascada de
las cajas anteriores y la perdida local de la caja donde se conecta el cliente.

### Semaforo tecnico propuesto

| Estado | Criterio | Interpretacion |
|---|---|---|
| Verde | margen restante mayor a 3 dB | enlace saludable |
| Amarillo | margen entre 1 y 3 dB | funciona, pero es vulnerable |
| Rojo | margen menor a 1 dB o fuera de sensibilidad | requiere rediseño |
| Gris | datos incompletos | no se puede calcular con confianza |

El margen se calcula despues de descontar el margen de seguridad. Por tanto, un
margen verde significa que el enlace todavia conserva mas de 3 dB adicionales
despues de la reserva de diseño.

### Zonas operativas de potencia RX

Cuando exista informacion de ONT/ONU o medicion en campo, el sistema debe
comparar la potencia absoluta en dBm con estas zonas:

| Zona | Rango RX aproximado | Interpretacion |
|---|---:|---|
| Saturacion | mayor a -8 dBm | riesgo de saturar receptor; sugerir atenuador |
| Optima | -15 a -22 dBm | maxima estabilidad y baja BER |
| Aceptable | -23 a -26 dBm | opera, pero con margen reducido |
| Critica | -27 a -28 dBm | riesgo de microcortes ante suciedad o temperatura |
| LOS | menor a -29 dBm | perdida de señal / alarma LOS probable |

### Datos requeridos para la calculadora

| Dato | Fuente |
|---|---|
| longitud de ruta | geometria PostGIS + reservas |
| tecnologia | puerto PON: GPON/XGS-PON |
| clase optica | B+, C+, N1, N2, E1, E2 |
| tipo de fibra | G.652.D, G.657.A1, G.657.A2 |
| splitters | ratio, tipo, perdida nominal o medida |
| conectores/adaptadores | cantidad y perdida estimada |
| empalmes | cantidad y perdida estimada/medida |
| filtros WDM | perdida adicional en coexistencia GPON/XGS-PON |
| margen objetivo | 3 a 5 dB por defecto |
| potencia TX/RX medida | telemetria OLT/ONT o medicion de campo |
| puerto PON | necesario para distancia diferencial y capacidad |

### Advertencias que debe emitir el sistema

- Falta tecnologia o clase optica del puerto PON.
- Splitter sin ratio o sin perdida definida.
- Ruta sin longitud calculable.
- Margen menor a 3 dB.
- Enlace fuera de presupuesto.
- Potencia estimada demasiado alta para la ONT, posible saturacion.
- Red GPON/XGS-PON con filtro de coexistencia sin perdida adicional considerada.
- Distancia mayor al limite logico/ranging del equipo.
- Diferencia entre ONU mas cercana y mas lejana del mismo PON mayor a 20 km.
- Calculo hecho solo en downstream.
- Potencia RX en zona critica, LOS o saturacion cuando existan mediciones.

### Escenarios de referencia para pruebas

Estos escenarios deben convertirse en fixtures o pruebas unitarias para evitar
regresiones en la calculadora:

| Escenario | Entradas | Perdida esperada | Veredicto |
|---|---|---:|---|
| Rural 1 nivel 1:8 | 15 km, 4 conectores, 12 empalmes, margen 3 dB | 22.7 dB | viable en B+ |
| Urbano 2 niveles 1:4 + 1:16 | 8 km, 6 conectores, 15 empalmes, margen 3 dB | 31.7 dB | B+ falla; C+ muy justo |
| Bus desbalanceado | taps 90/10, 85/15, 80/20, etc. | depende del tap | requiere perdida cascada + perdida local |

### Ejemplos de referencia

| Escenario | Perdida estimada | Clase sugerida | Lectura |
|---|---:|---|---|
| Urbano GPON 1:64 con 3.5 km | 25.03 dB | C+ | margen amplio |
| Rural GPON bus 10/90 con 12 km | 23.05 dB | B+ minimo, C+ recomendado | viable con control de crecimiento |
| MDU GPON 1:32 | 19.77 dB | B+ | muy holgado |

Estos ejemplos deben usarse como semillas para pruebas unitarias o fixtures de
validacion cuando se implemente la calculadora.

## Banco de casos de referencia — 6 escenarios reales de Ecuador

A continuacion se documentan seis escenarios reales de despliegue en Ecuador,
diseñados bajo parametros estrictos para servir como seeds de validacion para
calculadoras de presupuesto optico. Cada caso incluye equipos reales,
distancias geograficas medidas, y calculos detallados que pueden replicarse
en pruebas unitarias.

### CASO 1: Red urbana densa — Edificios residenciales en el Norte de Quito

**Contexto:** Sector La Carolina - Iñaquito, Quito. Alta densidad poblacional
con edificios de gran altura (risers verticales). Despliegue en condominios
residenciales y oficinas.

**Topología:** Star (División centralizada en el subsuelo del edificio).

**EQUIPOS:**
- OLT: Huawei SmartAX MA5800-X7, Clase B+, potencia TX +2.5 dBm
- Splitter nivel 1: 1:32, pérdida de inserción 17.0 dB
- Splitter nivel 2 (si aplica): N/A
- NAP: Caja de terminal interna de 32 puertos, conectores SC/APC

**RUTAS:**
- Feeder: 850 metros, fibra G.652D, instalación subterránea en ductos existentes
- Distribución: 150 metros, fibra G.652D, vertical (riser)
- Drop (si aplica): 40 metros, fibra G.657A2, desde el NAP en el piso hasta el ONT del usuario

**PÉRDIDAS DETALLADAS:**
- Fibra feeder: 0.26 dB (850m × 0.30 dB/km × 1.02)
- Fibra distribución: 0.05 dB (150m × 0.30 dB/km × 1.02)
- Fibra drop: 0.01 dB (40m × 0.22 dB/km × 1.02)
- Splitter(es): 17.0 dB (Nivel 1: 1:32)
- Conectores: 3.5 dB (7 eventos: ODF-OLT, Entrada Splitter, Salida Splitter, NAP-Piso, Roseta, ONT, Patchcord intermedio × 0.5 dB)
- Margen de seguridad: 3.0 dB
- **TOTAL: 23.82 dB**

**PRESUPUESTO OLT:**
- Clase: B+
- Budget máximo: 28.0 dB
- Margen resultante: 4.18 dB
- **Veredicto: VERDE > 3dB**

**NOTAS:** En este escenario de distancias extremadamente cortas, la pérdida es
dominada casi en su totalidad por el splitter 1:32 y los conectores. El enlace
es perfectamente viable con SFP Clase B+. El upstream (1310nm) operará con un
margen similar, ya que la atenuación adicional de la fibra a esa longitud de
onda solo añade ~0.05 dB en una distancia tan corta, lo cual es despreciable
frente al presupuesto total.

---

### CASO 2: Red urbana estándar — Barrio residencial en Guayaquil (Urdesa)

**Contexto:** Sector Urdesa Central, Guayaquil. Densidad media, viviendas
unifamiliares de 1 a 2 pisos. Despliegue aéreo sobre postería de servicios
públicos.

**Topología:** Tree (División 1:16 distribuida).

**EQUIPOS:**
- OLT: ZTE ZXA10 C320, Clase B+, potencia TX +3.0 dBm
- Splitter nivel 1: 1:16, pérdida de inserción 13.8 dB
- Splitter nivel 2 (si aplica): N/A
- NAP: Caja NAP exterior IP65 de 16 puertos, conector SC/APC

**RUTAS:**
- Feeder: 2,100 metros, fibra G.652D, instalación aérea ADSS
- Distribución: 450 metros, fibra G.652D, aérea ADSS
- Drop (si aplica): 180 metros, fibra G.657A1, cable plano (drop) hasta el cliente

**PÉRDIDAS DETALLADAS:**
- Fibra feeder: 0.64 dB (2100m × 0.30 dB/km × 1.02)
- Fibra distribución: 0.14 dB (450m × 0.30 dB/km × 1.02)
- Fibra drop: 0.04 dB (180m × 0.22 dB/km × 1.02)
- Splitter(es): 13.8 dB (Nivel 1: 1:16)
- Conectores: 3.0 dB (6 eventos × 0.5 dB)
- Margen de seguridad: 3.0 dB
- **TOTAL: 20.62 dB**

**PRESUPUESTO OLT:**
- Clase: B+
- Budget máximo: 28.0 dB
- Margen resultante: 7.38 dB
- **Veredicto: VERDE > 3dB**

**NOTAS:** Este es el escenario más común en Ecuador. La viabilidad con Clase B+
es amplia, permitiendo incluso degradaciones por falta de limpieza en conectores
sin afectar el servicio. En Guayaquil, se debe prestar atención a la corrosión
galvánica en herrajes ADSS, pero el presupuesto óptico es robusto.

---

### CASO 3: Red periurbana — Zona de expansión urbana en Manta

**Contexto:** Urbanización vía Barbasquillo, Manta. Baja densidad inicial,
viviendas modernas dispersas. Distancias feeder más extensas.

**Topología:** Tree (División 1:8).

**EQUIPOS:**
- OLT: Huawei MA5800-X15, Clase B+, potencia TX +2.0 dBm
- Splitter nivel 1: 1:8, pérdida de inserción 10.5 dB
- Splitter nivel 2 (si aplica): N/A
- NAP: Caja NAP de 8 puertos para poste, SC/APC

**RUTAS:**
- Feeder: 4,800 metros, fibra G.652D, instalación aérea
- Distribución: 1,200 metros, fibra G.652D, aérea
- Drop (si aplica): 220 metros, fibra G.657A1

**PÉRDIDAS DETALLADAS:**
- Fibra feeder: 1.47 dB (4800m × 0.30 dB/km × 1.02)
- Fibra distribución: 0.37 dB (1200m × 0.30 dB/km × 1.02)
- Fibra drop: 0.05 dB (220m × 0.22 dB/km × 1.02)
- Splitter(es): 10.5 dB (Nivel 1: 1:8)
- Conectores: 3.5 dB (7 eventos, incluyendo puentes en cajas de distribución × 0.5 dB)
- Margen de seguridad: 3.0 dB
- **TOTAL: 18.89 dB**

**PRESUPUESTO OLT:**
- Clase: B+
- Budget máximo: 28.0 dB
- Margen resultante: 9.11 dB
- **Veredicto: VERDE > 3dB**

**NOTAS:** A pesar de que la distancia total supera los 6 km, el bajo ratio de
split (1:8) compensa la atenuación de la fibra. Este diseño es escalable; si la
densidad aumenta, se podría migrar a un split 1:32 sin exceder los 28 dB de la
Clase B+, aunque el margen se reduciría a ~2.6 dB (Veredicto Amarillo).

---

### CASO 4: Red rural — Parroquia Eugenio Espejo, Otavalo

**Contexto:** Zona rural del cantón Otavalo, Imbabura. Población dispersa en
laderas. Migración de radioenlaces a fibra óptica.

**Topología:** Tree (División 1:8).

**EQUIPOS:**
- OLT: Mikrotik CCR1016 (con SFP GPON Clase C+), potencia TX +4.5 dBm
- Splitter nivel 1: 1:8, pérdida de inserción 10.5 dB
- Splitter nivel 2 (si aplica): N/A (Migración directa)
- NAP: 8 puertos conectorizados, instalación aérea ADSS

**RUTAS:**
- Feeder: 9,500 metros, fibra G.652D, ADSS 12 hilos vano 120m
- Distribución: 2,200 metros, fibra G.652D, aérea
- Drop (si aplica): 250 metros, fibra G.657A2

**PÉRDIDAS DETALLADAS:**
- Fibra feeder: 2.91 dB (9500m × 0.30 dB/km × 1.02)
- Fibra distribución: 0.67 dB (2200m × 0.30 dB/km × 1.02)
- Fibra drop: 0.06 dB (250m × 0.22 dB/km × 1.02)
- Splitter(es): 10.5 dB (1:8)
- Conectores: 4.0 dB (8 eventos por interconexiones en zonas de difícil acceso × 0.5 dB)
- Margen de seguridad: 3.0 dB
- **TOTAL: 21.14 dB**

**PRESUPUESTO OLT:**
- Clase: C+ (Mínima recomendada para rural)
- Budget máximo: 32.0 dB
- Margen resultante: 10.86 dB
- **Veredicto: VERDE > 3dB**

**NOTAS:** Aunque con Clase B+ (28 dB) el enlace sería viable (Margen 6.86 dB),
el operador prefiere Clase C+ para mitigar la alta tasa de empalmes de reparación
debidos a desprendimientos de tierra o caídas de árboles comunes en la zona alta
de Otavalo. El upstream a 1310nm presenta una atenuación de fibra de 4.63 dB, lo
que requiere que la ONT esté en óptimas condiciones de limpieza.

---

### CASO 5: Red rural extensa — Comunidad dispersa en la Amazonía (Napo)

**Contexto:** Provincia de Napo. Zona dispersa con riesgo de pérdida de línea de
vista (LOS) para radio. Despliegue de largo alcance desde cabecera parroquial.

**Topología:** Star (División 1:4 para priorizar distancia).

**EQUIPOS:**
- OLT: Huawei SmartAX MA5801-FL16, Clase C++, potencia TX +6.5 dBm
- Splitter nivel 1: 1:4, pérdida de inserción 7.2 dB
- Splitter nivel 2 (si aplica): N/A
- NAP: Caja NAP de 8 puertos IP68, conectores reforzados

**RUTAS:**
- Feeder: 17,200 metros, fibra G.652D, ADSS de alta resistencia
- Distribución: 1,800 metros, fibra G.652D
- Drop (si aplica): 350 metros (Acometida rural larga)

**PÉRDIDAS DETALLADAS:**
- Fibra feeder: 5.26 dB (17200m × 0.30 dB/km × 1.02)
- Fibra distribución: 0.55 dB (1800m × 0.30 dB/km × 1.02)
- Fibra drop: 0.08 dB (350m × 0.22 dB/km × 1.02)
- Splitter(es): 7.2 dB (Nivel 1: 1:4)
- Conectores: 3.0 dB (6 eventos × 0.5 dB)
- Margen de seguridad: 4.0 dB (Extra por ambiente selvático)
- **TOTAL: 20.09 dB**

**PRESUPUESTO OLT:**
- Clase: C++
- Budget máximo: 35.0 dB
- Margen resultante: 14.91 dB
- **Veredicto: VERDE > 3dB**

**NOTAS:** La distancia total de 19.35 km se acerca al límite físico del protocolo
GPON estándar (20 km). Aunque el presupuesto óptico es excelente gracias a la
Clase C++ y al split bajo (1:4), el ingeniero debe verificar el Logical Reach.
Si una ONT estuviera a 100m y esta a 19.35 km, el diferencial de ~19.2 km está
al límite del diferencial de 20 km permitido por la mayoría de fabricantes para
el sincronismo de tramas. El upstream es crítico: la pérdida de fibra a 1310nm
es de 7.51 dB, lo que podría acercar la señal de subida a la sensibilidad del
receptor de la OLT si hay conectores sucios.

---

### CASO 6: Red en cascada de 2 niveles — Sector Puembo, Quito

**Contexto:** San José de Puembo, Quito. Topología de árbol con splitters en
cascada para optimizar el uso de fibra feeder en una zona con postería saturada.

**Topología:** Cascade (División 1:4 en FDH + 1:8 en NAP para un total de 1:32).

**EQUIPOS:**
- OLT: Huawei MA5800-X7, Clase B+, potencia TX +3.0 dBm
- Splitter nivel 1: 1:4 (en Gabinete FDH), pérdida 7.2 dB
- Splitter nivel 2 (si aplica): 1:8 (en Caja NAP), pérdida 10.5 dB
- NAP: 8 puertos conectorizados, SC/APC

**RUTAS:**
- Feeder: 4,500 metros, fibra G.652D, aérea ADSS
- Distribución: 1,100 metros, fibra G.652D, aérea
- Drop (si aplica): 120 metros, fibra G.657A1

**PÉRDIDAS DETALLADAS:**
- Fibra feeder: 1.38 dB (4500m × 0.30 dB/km × 1.02)
- Fibra distribución: 0.34 dB (1100m × 0.30 dB/km × 1.02)
- Fibra drop: 0.03 dB (120m × 0.22 dB/km × 1.02)
- Splitter(es): 17.7 dB (7.2 dB + 10.5 dB)
- Conectores: 4.0 dB (8 eventos, debido al empalme mecánico y patchcords en FDH × 0.5 dB)
- Margen de seguridad: 3.0 dB
- **TOTAL: 26.45 dB**

**PRESUPUESTO OLT:**
- Clase: B+
- Budget máximo: 28.0 dB
- Margen resultante: 1.55 dB
- **Veredicto: AMARILLO 1-3dB**

**NOTAS:** Este diseño en cascada es arriesgado para Clase B+. El margen de
1.55 dB es insuficiente para la realidad operativa de Ecuador, donde las
reparaciones de fibra añaden empalmes de fusión y conectores mecánicos de
urgencia. Se recomienda encarecidamente el uso de módulos Clase C+ para este
escenario, lo que elevaría el margen a 5.55 dB (Veredicto Verde). El upstream
(1310nm) es el punto de falla más probable aquí, ya que la atenuación de la
fibra a 1310nm suma 2.17 dB, dejando el presupuesto de subida casi en el límite
de la sensibilidad de la OLT.

---

### Tabla resumen comparativa de presupuesto óptico

| Atributo | Caso 1<br/>Urb. Densa | Caso 2<br/>Urb. Estándar | Caso 3<br/>Periurbana | Caso 4<br/>Rural | Caso 5<br/>Rural Extensa | Caso 6<br/>Cascada |
|---|---:|---:|---:|---:|---:|---:|
| **Ratio Split Total** | 1:32 | 1:16 | 1:8 | 1:8 | 1:4 | 1:32 |
| **Distancia Física (km)** | 1.04 | 2.73 | 6.21 | 11.95 | 19.35 | 5.72 |
| **Clase Óptica OLT** | B+ | B+ | B+ | C+ | C++ | B+ |
| **Pérdida Splitters (dB)** | 17.00 | 13.80 | 10.50 | 10.50 | 7.20 | 17.70 |
| **Pérdida Fibra (dB)** | 0.32 | 0.82 | 1.89 | 3.64 | 5.89 | 1.75 |
| **Pérdida Conectores (dB)** | 3.50 | 3.00 | 3.50 | 4.00 | 3.00 | 4.00 |
| **Margen Seguridad (dB)** | 3.00 | 3.00 | 3.00 | 3.00 | 4.00 | 3.00 |
| **Pérdida Total (dB)** | 23.82 | 20.62 | 18.89 | 21.14 | 20.09 | 26.45 |
| **Margen Resultante (dB)** | 4.18 | 7.38 | 9.11 | 10.86 | 14.91 | 1.55 |
| **Veredicto** | VERDE | VERDE | VERDE | VERDE | VERDE | AMARILLO |
| **Viabilidad B+** | Sí | Sí | Sí | Sí | N/A (Usa C++) | Al límite |

---

### Análisis técnico consolidado

#### La superioridad del canal de subida como factor limitante

Un hallazgo recurrente en los cálculos es que, si bien el canal de bajada
(1490 nm) suele presentar valores "en verde", el canal de subida (1310 nm) es
el primero en colapsar en redes rurales de gran extensión (Caso 5) o en cascada
(Caso 6). El coeficiente de atenuación de 0.35-0.38 dB/km a 1310 nm frente al
de 0.30 dB/km a 1490 nm genera una disparidad que puede superar los 2 dB en
distancias mayores a 15 km.

Si a esto añadimos que los láseres de las ONT suelen tener menor potencia de
emisión que los transceptores SFP de la OLT, el ingeniero de redes debe validar
siempre el presupuesto de subida como el factor limitante real de la red.

#### El dilema del ratio de splitteo y la capacidad de la OLT

El estándar ITU-T G.984 permite un ratio de división máximo de 1:128, pero la
práctica común en Ecuador, por parte de operadores como CNT y Netlife, es
limitarlo a 1:64 o incluso 1:32 para asegurar un ancho de banda por usuario que
sea competitivo comercialmente. Desde la perspectiva del presupuesto óptico,
pasar de un split 1:32 a 1:64 implica una penalización inmediata de ~3.5 dB
(de 17.0 a 20.5 dB). Como se observa en el Caso 6, esta diferencia es la que a
menudo empuja un diseño desde el rango viable (Verde) hacia el rango crítico
(Rojo) si no se actualiza la clase óptica del SFP.

#### Limitaciones del protocolo frente a la física de la luz

Es vital distinguir entre el alcance físico y el alcance lógico de una red GPON.
La física permite que una red con Clase C++ y un split de 1:4 llegue a los 20 km
con un margen amplio (Caso 5), pero el protocolo GPON introduce el concepto de
"compensación de rango" o Ranging. La OLT mide el tiempo de respuesta de cada
ONT para sincronizar las ráfagas de datos en el upstream; si la diferencia entre
la ONT más cercana y la más lejana supera los 20 km (o el límite configurado en
el puerto PON), el sistema no podrá sincronizarlas a pesar de que la potencia
óptica recibida sea excelente.

En Ecuador, donde la red a menudo se expande de forma orgánica, es común
encontrar diseños que violan esta norma, resultando en ONTs que "no sincronizan"
inexplicablemente.

---

### Recomendaciones finales de campo

El análisis detallado de la casuística ecuatoriana permite concluir que la
robustez de una red FTTH no depende solo de la potencia bruta de los equipos
activos, sino de la disciplina en el manejo de la planta externa pasiva. Los
escenarios rurales y de larga distancia presentan los mayores desafíos no solo
por la atenuación, sino por las restricciones temporales del protocolo GPON.

**Recomendaciones finales para la ingeniería de redes en la región:**

1. **Priorización de la Clase C+:** En escenarios suburbanos y rurales, el
   sobrecosto de un transceptor Clase C+ frente a uno B+ es insignificante
   comparado con el costo operativo de despachar una cuadrilla para limpiar un
   conector o rehacer un empalme que degradó el margen de 1 dB a cero.

2. **Uso de Fibra G.657 en Última Milla:** La adopción masiva de fibras
   insensibles a curvaturas reduce drásticamente las fallas en el hogar del
   cliente, donde los radios de curvatura suelen ser ignorados por los usuarios
   finales.

3. **Mantenimiento Preventivo de Conectores:** La suciedad es el "enemigo
   silencioso" de las redes GPON. Un conector con polvo en una caja NAP exterior
   puede añadir fácilmente 2 dB de pérdida, invalidando cualquier cálculo teórico
   previo.

4. **Validación del Upstream:** Todo proyecto de ingeniería debe incluir
   explícitamente el cálculo a 1310 nm. Una red que funciona perfectamente en el
   downstream puede presentar problemas crónicos de "latencia" o "caídas" debido
   a que las ráfagas de subida están operando en el umbral de sensibilidad de la
   OLT.

5. **Verificación de Logical Reach:** Antes de dar por válido un diseño de largo
   alcance (>10 km), confirmar que el diferencial entre ONT más cercana y más
   lejana no supera el límite de sincronismo del equipo (típicamente 20 km).

## As-built, etiquetado y operacion de campo

El modulo as-built debe permitir que el sistema compare lo diseñado con lo
realmente instalado. Esta comparacion es critica para reducir documentacion
desactualizada, errores de mantenimiento y tiempos de reparacion.

### Flujo operativo recomendado

```txt
1. Ingenieria diseña la red en el mapa.
2. Supervisor genera orden de trabajo.
3. Tecnico descarga tarea y mapa del sector.
4. Tecnico instala o inspecciona activo.
5. Tecnico captura GPS, fotos, label, QR y mediciones.
6. Sistema compara diseño vs as-built.
7. Supervisor aprueba o rechaza cambios.
8. Red maestra se actualiza con version y auditoria.
```

### Evidencias por activo

| Activo | Evidencias minimas |
|---|---|
| OLT | rack/nodo, etiqueta, tarjeta/puerto, foto, responsable |
| Splitter | ubicacion, ratio, etiqueta, caja contenedora, foto |
| NAP/CTO | codigo visible, puertos, foto cerrada y abierta, GPS |
| Cierre de empalme | codigo, bandeja, tabla de empalmes, foto |
| Ruta de fibra | trazado GPS o corregido, tipo de cable, metraje, reservas |
| Reserva | longitud, forma de instalacion, foto, ubicacion |
| Cruce | tipo de cruce, riesgo, foto, observacion |
| Drop/ONT | puerto NAP, serial ONT, potencia RX, foto si aplica |

### Modo movil para tecnicos

El modo movil debe ser `offline-first` porque muchas zonas de trabajo no tendran
conectividad estable.

Capacidades esperadas:

- descarga previa de ordenes y activos cercanos.
- captura GPS.
- fotos georreferenciadas.
- escaneo QR/codigo de barras.
- formularios cortos por tipo de activo.
- registro de potencia optica medida.
- firma o evidencia de entrega cuando aplique.
- sincronizacion posterior con deteccion de conflictos.

### Comparacion diseño vs as-built

El sistema debe detectar:

- activos instalados fuera de tolerancia geografica.
- rutas modificadas o con longitud distinta.
- NAP sin etiqueta o con etiqueta no coincidente.
- labels duplicados.
- empalmes no previstos.
- reservas agregadas sin longitud.
- puertos ocupados no documentados.
- activos escaneados que no corresponden a la orden.
- mediciones opticas alejadas del valor teorico.

### Ordenes de trabajo

Tipos recomendados:

| Tipo | Uso |
|---|---|
| instalacion | instalar activo, NAP, splitter, ruta o cliente |
| reparacion | atender corte, empalme dañado o potencia baja |
| mantenimiento | inspeccion preventiva o limpieza |
| auditoria | verificar etiquetas, ubicacion y estado |
| expansion | agregar capacidad o extender red |
| regularizacion | corregir inventario heredado |
| reemplazo_label | reponer etiqueta fisica o QR |

Estados recomendados:

```txt
created -> assigned -> in_field -> pending_review -> approved/rejected -> closed
```

Tablas candidatas:

| Tabla | Proposito |
|---|---|
| `asset_labels` | codigo operativo, QR, estado de etiqueta |
| `label_sequences` | control de secuencias por zona/tipo |
| `label_print_jobs` | etiquetas pendientes de impresion |
| `work_orders` | orden principal |
| `work_order_tasks` | tareas por activo |
| `field_evidence` | fotos, GPS, QR, observaciones |
| `asset_versions` | versionado antes/despues |
| `inspection_results` | checklist de campo |
| `change_requests` | cambios pendientes de aprobar |

### Validaciones automaticas recomendadas

- NAP sin foto.
- NAP sin codigo operativo.
- NAP con label duplicado.
- Cable sin codigo de ruta.
- Ruta sin origen/destino.
- Empalme sin perdida medida.
- Reserva sin longitud.
- Activo movido mas de X metros respecto al diseño.
- Etiqueta escaneada no coincide con activo seleccionado.
- Codigo operativo no cumple la convencion.
- QR escaneado pertenece a otro proyecto/zona.

### UX recomendada

Para tecnico de campo:

- lista de tareas del dia.
- boton grande para escanear QR.
- captura rapida de foto, GPS y observacion.
- formularios por activo con pocos campos obligatorios.
- indicador claro de pendiente de sincronizar.

Para supervisor:

- bandeja de cambios pendientes.
- comparacion mapa antes/despues.
- fotos y mediciones al lado del activo.
- aprobar, rechazar o pedir correccion.

Para ingenieria:

- diferencias entre LLD y as-built.
- cambios de longitud y presupuesto optico recalculado.
- impacto de cambios sobre capacidad y clientes futuros.

## Recomendaciones para continuar el proyecto

### Corto plazo: dentro del MVP

1. Mantener el alcance del editor en infraestructura: OLT, splitters, NAPs,
   rutas feeder/distribution, cruces, reservas y empalmes.
2. Mostrar calidad de datos en mapa y panel: aproximado, capturado por GPS o
   verificado.
3. Agregar advertencias basicas de capacidad: NAP llena, NAP casi llena,
   splitter sin ratio, ruta sin origen/destino.
4. Preparar el modelo para calculo optico aunque la UI inicial solo muestre
   valores estimados.
5. Documentar cada activo como inventario tecnico, no solo como marcador visual.
6. Guardar `reservation_m` en rutas para no subestimar la longitud real de fibra.
7. Registrar `optical_class`, `technology` y `split_ratio` como base de futuras
   validaciones.
8. Definir desde el inicio `code` o `label` operativo unico para OLT, splitter,
   NAP y rutas.
9. Preparar el modelo para evidencias de campo aunque el MVP no tenga modo movil
   completo.

### Mediano plazo: fase de ingenieria

1. Implementar calculadora de presupuesto optico por ruta OLT -> NAP.
2. Modelar puertos PON y puertos NAP.
3. Soportar splitters balanceados y desbalanceados.
4. Crear vista de arbol logico para complementar el mapa.
5. Agregar comparacion entre perdida teorica y mediciones reales.
6. Modelar hilos de fibra y conexiones puerto a puerto.
7. Implementar trazado recursivo de red con CTEs en PostgreSQL.
8. Implementar ordenes de trabajo con aprobacion de cambios as-built.
9. Agregar QR/codigo de barras para activos de campo.

### Largo plazo: OSS operativo

1. Integrar ONTs y clientes.
2. Registrar niveles RX/TX, estado online/offline e historial de potencia.
3. Integrar SNMP, TR-069, APIs de OLT o archivos exportados por proveedor.
4. Crear mantenimiento predictivo con degradacion progresiva por NAP, splitter o
   ruta.
5. Incorporar factibilidad comercial: direccion -> NAP cercana -> puerto libre.

## Investigaciones adicionales recomendadas

Estas investigaciones pueden aportar valor directo al proyecto:

### 1. Modelo de datos OSS/GIS para FTTH

Estado: investigacion inicial consolidada en este documento.

Siguiente paso: comparar el modelo propuesto con herramientas como QGIS, ArcGIS
Utility Network, GE Smallworld, NetBox, Nautobot, Odoo ISP o sistemas OSS de
fibra.

Preguntas clave:

- Como representar hilos, puertos, cajas, splitters y rutas sin hacer el MVP
  demasiado pesado?
- Que entidades son obligatorias para factibilidad y mantenimiento?
- Como separar red fisica, red logica y servicios de cliente?

### 2. Calculo optico GPON/XGS-PON

Estado: investigacion inicial consolidada en este documento.

Siguiente paso: convertir las tablas de perdida, clases opticas y reglas de
semaforo tecnico en datos configurables del sistema.

Resultado esperado para el proyecto:

- Una tabla parametrizable de perdidas.
- Una calculadora interna.
- Reglas de advertencia por presupuesto optico.

### 3. As-built, operacion de campo y etiquetado

Estado: investigacion inicial consolidada en este documento.

Siguiente paso: convertir la convencion de labels y el flujo de aprobacion
as-built en tablas, validaciones y pantallas del sistema.

Resultado esperado:

- codigos operativos unicos por zona/tipo.
- evidencias de campo por activo.
- ordenes de trabajo con aprobacion antes de actualizar la red maestra.
- QR protegido por autenticacion.

### 4. Normativa ecuatoriana y municipal

Ampliar investigacion de ARCOTEL, MINTEL, empresas electricas y ordenanzas de
Quito, Guayaquil, Cuenca y ciudades objetivo.

Resultado esperado:

- Checklist de cumplimiento.
- Campos obligatorios por activo.
- Capa de zonas soterradas o zonas restringidas.

### 5. Operacion de campo para tecnicos

Estado: cubierto parcialmente por la investigacion as-built.

Siguiente paso: validar el flujo con tecnicos reales o casos de campo concretos.

Resultado esperado:

- App movil o modo movil del editor.
- Formularios cortos para campo.
- Evidencias por activo: foto, medicion, observacion, responsable y fecha.

### 6. Integracion con equipos OLT/ONT

Investigar proveedores comunes en Ecuador: Huawei, ZTE, FiberHome, Nokia,
VSOL, C-DATA u otros usados por ISPs regionales.

Resultado esperado:

- Campos comunes de OLT, tarjetas, puertos PON y ONTs.
- Estrategia de integracion por SNMP, API, Telnet/SSH controlado o importacion
  de archivos.
- Normalizacion de estados y niveles opticos.

### 7. Analisis de capacidad y sobresuscripcion

Investigar ratios comerciales reales, DBA, split ratios, perfiles de velocidad,
concurrencia y calidad de experiencia.

Resultado esperado:

- Indicadores por puerto PON.
- Alertas por saturacion comercial.
- Simulacion de crecimiento por sector.

### 8. Geocodificacion y cobertura comercial

Investigar fuentes de direcciones, catastros, OpenStreetMap, barrios,
manzanas, predios y geocodificacion local.

Resultado esperado:

- Busqueda de direccion.
- Factibilidad automatica por cercania a NAP.
- Zonas de cobertura por poligono o radio operativo.

### 9. Mantenimiento predictivo

Investigar uso de historicos de potencia, eventos de ONT, trazas OTDR y clima
para anticipar fallas.

Resultado esperado:

- Deteccion de degradacion por zona.
- Priorizacion de visitas tecnicas.
- Alertas por patron: varias ONTs degradadas en una misma NAP.

### 10. Seguridad, roles y auditoria

Investigar permisos por rol para equipos de ingenieria, planta externa,
instaladores, soporte y administradores.

Resultado esperado:

- Reglas de edicion por rol.
- Historial de cambios geoespaciales.
- Aprobacion de cambios criticos en red.

### 11. UX de mapas tecnicos para telecomunicaciones

Investigar patrones de herramientas GIS, CAD y editores tipo Figma aplicados a
planta externa.

Resultado esperado:

- Mejor toolbar del editor.
- Paneles de propiedades mas rapidos.
- Simbologia consistente por activo, estado, incidente y calidad de datos.

## Backlog tecnico sugerido

| Prioridad | Item | Valor |
|---|---|---|
| Alta | Calidad de datos visible | Permite documentar red incompleta sin perder trazabilidad |
| Alta | Capacidad NAP usada/libre | Soporta factibilidad y expansion |
| Alta | Calculo de longitud PostGIS | Base para presupuesto optico |
| Alta | Reserva de fibra en rutas | Evita subestimar atenuacion real |
| Alta | Clase optica y tecnologia PON | Base para validar GPON/XGS-PON |
| Alta | Codigo operativo unico | Conecta mapa, campo y auditoria |
| Alta | Evidencias as-built | Reduce drift entre diseño y realidad |
| Alta | Advertencias no bloqueantes | Mejora calidad sin frenar al tecnico |
| Media | Puertos PON y puertos NAP | Acerca el MVP a operacion real |
| Media | Calculadora optica | Diferenciador tecnico del sistema |
| Media | Modelo de hilos y puertos | Permite trazado real de senal |
| Media | Auditoria de cambios | Reduce drift entre mapa y campo |
| Media | Ordenes de trabajo | Controla instalacion, reparacion y validacion |
| Media | QR/codigo de barras | Agiliza inspeccion y evita errores de captura |
| Media | Splitters desbalanceados | Alinea el sistema con despliegues rurales/suburbanos |
| Media | Vista arbol logico | Ayuda a entender topologia fuera del mapa |
| Baja | Integracion OLT/ONT | Fase OSS posterior |
| Baja | Predictivo con IA | Requiere historicos operativos |

## Criterio de producto recomendado

El proyecto debe crecer en este orden:

```txt
1. Documentar infraestructura en mapa.
2. Definir labels/codigos operativos y calidad de datos.
3. Validar capacidad y evidencias as-built.
4. Calcular viabilidad optica.
5. Conectar clientes, ONTs y acometidas.
6. Integrar monitoreo real.
7. Automatizar diagnostico y mantenimiento.
```

Este orden mantiene el producto construible: primero crea una fuente confiable de
verdad geoespacial y luego agrega logica operativa encima.
