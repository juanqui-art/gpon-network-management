# Criterios de Split Ratio GPON

Fecha: 2026-05-06

## Proposito

Documentar un criterio practico para decidir entre `1:32`, `1:64` y `1:128`
en el diseno de la red GPON dentro del sistema. Este documento no busca solo
describir el limite teorico del estandar, sino establecer una posicion de
ingenieria mas cercana a la operacion real.

## Resumen corto

- `1:32` debe tratarse como el estandar recomendado.
- `1:64` debe tratarse como el maximo normal o estandar alto.
- `1:128` no es solo teorico, pero debe tratarse como un caso excepcional,
  agresivo y de mayor riesgo operativo.

## Punto clave

En GPON, aumentar el split ratio permite conectar mas abonados a un mismo
puerto PON, pero a cambio:

- disminuye el margen optico disponible;
- aumenta la sensibilidad a empalmes, conectores sucios y reparaciones;
- crece la sobresuscripcion del ancho de banda compartido;
- se vuelve mas importante la calidad de construccion y mantenimiento.

Por eso, la pregunta correcta no es solo "el estandar lo permite?", sino
"conviene operarlo asi en una red real?".

## Que dice el estandar

La referencia de ITU-T G.984.1 establece que:

- ratios de hasta `1:64` son realistas para la capa fisica;
- la capa de transmision debe considerar ratios de hasta `1:128`.

Interpretacion practica:

- `1:128` existe dentro del universo GPON;
- pero `1:64` aparece como la referencia mas realista a nivel fisico.

## Que se observa en practica

La documentacion tecnica consultada y la practica de despliegue FTTH muestran
una pauta bastante estable:

- `1:32` y `1:64` son los ratios mas habituales;
- `1:128` se usa cuando el operador quiere maximizar la capacidad por puerto
  PON y acepta un diseno mas exigente;
- mientras mas alto es el ratio, mas importante se vuelve controlar
  distancia, perdidas, calidad de empalmes y patron real de consumo.

## Evaluacion por ratio

### 1:32

Es la opcion mas sana para una red base GPON.

Ventajas:

- mejor margen optico;
- mejor tolerancia a degradacion del enlace;
- menor riesgo de saturacion por ancho de banda compartido;
- mas flexible para crecimiento desordenado o correcciones en campo;
- mas facil de sostener sin una ingenieria demasiado fina.

Cuando usarlo:

- como configuracion por defecto del sistema;
- en redes nuevas;
- en escenarios con incertidumbre alta;
- cuando se quiere priorizar robustez operativa.

Clasificacion recomendada en la app:

- `recomendado`

### 1:64

Es un ratio alto, pero aun razonable para GPON.

Ventajas:

- mejora el aprovechamiento del puerto PON;
- reduce costo por abonado frente a `1:32`;
- sigue siendo una meta comunmente aceptada en disenos GPON.

Riesgos:

- menor margen optico;
- mayor sensibilidad a empalmes adicionales, conectores deficientes y
  reparaciones;
- mas presion sobre la capacidad compartida, sobre todo en upstream.

Cuando usarlo:

- cuando la zona, distancia y presupuesto optico lo soportan;
- cuando se quiere un mejor equilibrio entre eficiencia y prudencia;
- como techo practico de referencia.

Clasificacion recomendada en la app:

- `permitido con validacion`

### 1:128

No es una fantasia ni un dato puramente academico. Puede operar, pero ya entra
en una zona agresiva de diseno.

Ventajas:

- maximiza el retorno por puerto PON;
- permite conectar mas usuarios sin agregar mas puertos OLT;
- puede ser atractivo para zonas densas y modelos comerciales de alta
  sobresuscripcion.

Riesgos:

- margen optico mucho mas delicado;
- mayor probabilidad de quedar al limite tras reparaciones o crecimiento;
- mas sensibilidad al trafico real de hora pico;
- mayor dependencia de distancias cortas y construccion muy limpia;
- peor tolerancia a decisiones fisicas poco realistas.

Cuando podria aceptarse:

- zonas urbanas muy densas;
- distancias cortas;
- red con perdidas bien controladas;
- operador dispuesto a exprimir el puerto PON;
- escenario con buena disciplina de mantenimiento.

Cuando no conviene:

- zonas rurales o periurbanas largas;
- red aerea desordenada;
- topologias con demasiadas etapas de split;
- incertidumbre alta de demanda;
- necesidad de red robusta y facil de operar.

Clasificacion recomendada en la app:

- `excepcional`
- `alto_riesgo`

## Capacidad compartida: lectura simple

GPON clasico ofrece aproximadamente:

- `2.5 Gbps` downstream
- `1.25 Gbps` upstream

Si se reparte de forma totalmente uniforme:

- `1:32` implica mas ancho de banda potencial por usuario;
- `1:64` implica un reparto mas exigente;
- `1:128` implica un reparto aun mas ajustado y dependiente de la
  sobresuscripcion.

En la realidad, no todos los usuarios transmiten al mismo tiempo, por lo que
`1:128` puede funcionar comercialmente. Sin embargo, eso no significa que sea
la mejor base de ingenieria.

## Criterio recomendado para el sistema

Para mantener una postura realista y prudente:

- `1:32` debe ser el valor por defecto;
- `1:64` debe estar soportado como maximo normal;
- `1:128` debe existir, pero con advertencias fuertes y nunca como default.

## Reglas sugeridas para validacion futura

La app deberia poder marcar advertencias cuando:

- el split total es `1:64` o superior;
- el split total es `1:128`;
- la distancia aumenta junto con ratios altos;
- la topologia tiene multiples niveles de split;
- la red fisica concentra demasiadas acometidas en un solo punto;
- el presupuesto optico queda con poco margen.

## Decision de diseno propuesta

Para esta app personal, la linea base recomendada es:

- `1:32` como estandar recomendado;
- `1:64` como limite practico aceptable;
- `1:128` como opcion posible pero agresiva, no recomendada como base general.

## Fuentes

Fuentes internas del proyecto:

- `docs/GPON_FTTH_ECUADOR_RESEARCH.md`
- `docs/TOPOLOGIES.md`
- `docs/OLT_REFERENCE.md`

Fuentes tecnicas externas consultadas el `2026-05-06`:

- ITU-T G.984.1 - General characteristics:
  [https://www.itu.int/rec/dologin_pub.asp?id=T-REC-G.984.1-200303-S%21%21PDF-E&lang=e&type=items](https://www.itu.int/rec/dologin_pub.asp?id=T-REC-G.984.1-200303-S%21%21PDF-E&lang=e&type=items)
- ITU-T G.984.2 - PMD layer specification:
  [https://www.itu.int/ITU-T/recommendations/rec.aspx?id=14000&lang=en](https://www.itu.int/ITU-T/recommendations/rec.aspx?id=14000&lang=en)
- Calix GPON overview:
  [https://www.calix.com/technologies/gpon.html](https://www.calix.com/technologies/gpon.html)
