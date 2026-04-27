# Análisis técnico integral de

# infraestructuras GPON en Ecuador:

# Arquitectura, despliegue y modelado de

# redes de próxima generación (2024–2026)

La evolución de las telecomunicaciones en el Ecuador durante el último quinquenio ha
estado marcada por una transición agresiva desde infraestructuras de cobre y
radioenlaces hacia redes de fibra óptica de alta capacidad. En el centro de esta
transformación se encuentra la tecnología GPON (Gigabit Passive Optical Network), que
se ha consolidado como el estándar dominante para el despliegue de Fibra hasta el Hogar
(FTTH). Al cierre del año 2024, el panorama nacional refleja una madurez tecnológica
notable, donde más del 88% de las conexiones de internet fijo corresponden a enlaces de
fibra óptica, sumando aproximadamente 2.76 millones de accesos de un total de 3.
millones registrados en el país. Este fenómeno no solo responde a una demanda de
mayor ancho de banda impulsada por la digitalización post-pandemia, sino también a una
estrategia coordinada entre el sector público, liderado por la Corporación Nacional de
Telecomunicaciones (CNT EP), y una red vibrante de operadores privados y comunitarios
que buscan cerrar la brecha digital en las 1,047 parroquias rurales y cabeceras
cantonales del territorio ecuatoriano.

## Contexto y dinámica del mercado de fibra óptica en

## Ecuador

El mercado ecuatoriano de telecomunicaciones presenta una estructura competitiva
donde la tecnología GPON actúa como el habilitador principal de servicios "Triple Play".
La adopción de esta tecnología ha seguido una trayectoria ascendente, concentrándose
inicialmente en los centros urbanos de mayor densidad como Guayas y Pichincha, que
agrupan el 61% de las conexiones nacionales, para luego expandirse hacia las periferias
y zonas rurales mediante modelos de inversión pública y privada.

### Principales operadores y su posicionamiento tecnológico

La arquitectura GPON es operada en Ecuador por una diversidad de actores que van
desde empresas estatales hasta proveedores de servicios de internet (ISP) locales. La
CNT EP mantiene un rol estratégico al gestionar la infraestructura de servicio universal,
migrando activamente sus redes de planta externa de cobre a fibra óptica para soportar
planes de hasta 800 Mbps con una relación de compartición de 1:1 en segmentos
específicos. En el ámbito privado, operadores como Netlife (Grupo Telconet) han liderado
la innovación mediante la implementación de cables submarinos de nueva generación,
como el "Carnival Submarine Network-1", que fortalece el transporte internacional
necesario para alimentar las redes de acceso GPON. Por su parte, otros actores como
Puntonet han extendido su cobertura a 25 provincias, impactando a más del 20% de los
hogares ecuatorianos mediante alianzas con socios tecnológicos como Calix y gestores
integrales como FYCO.

```
Operador Segmento de
Mercado
```

```
Enfoque Tecnológico 2024–
```

### Adopción de FTTH: De centros urbanos a la ruralidad

La penetración de la fibra óptica en Ecuador ha superado barreras geográficas
significativas. Mientras que en 2022 la presencia de internet fijo en parroquias rurales era
del 75.82%, las proyecciones y avances al primer trimestre de 2024 sitúan esta cifra en un
80.80%. Este crecimiento se sustenta en casos reales de implementación donde
comunidades anteriormente relegadas ahora acceden a servicios simétricos. En el cantón
Otavalo, por ejemplo, el proyecto JAKFIBER ha transformado la conectividad de la
parroquia Eugenio Espejo, reemplazando radioenlaces inestables por una red GPON
diseñada para servir a una población de 8,000 habitantes en un área de 28 $km^2$.
Similares esfuerzos se observan en Alausí y Salcedo, donde empresas como AJnet han
desplegado infraestructuras bajo normativas ITU-T G.984 para garantizar estabilidad en
sectores como teleducación y teletrabajo.

El marco regulatorio emitido por la Agencia de Regulación y Control de las
Telecomunicaciones (ARCOTEL) ha sido fundamental en este proceso. La Resolución No.
ARCOTEL-2025-0277 establece normas técnicas para la operación de redes comunitarias
en zonas rurales y fronterizas, promoviendo la gestión sin fines de lucro por parte de
organizaciones de la economía popular y solidaria. Este enfoque normativo busca
democratizar el acceso a las tecnologías de la información, permitiendo que la fibra óptica
llegue a sectores donde los grandes operadores comerciales encuentran limitaciones de
rentabilidad.

## Arquitectura de la red GPON: Estándares y topología

La tecnología GPON se define como una arquitectura de red óptica pasiva capaz de
ofrecer servicios de banda ancha mediante una topología de punto a multipunto (P2MP). A
diferencia de las redes activas, GPON utiliza divisores ópticos que no requieren
alimentación eléctrica en la planta externa, lo que reduce significativamente los costos
operativos y de mantenimiento.

### Estructura jerárquica: OLT, ODN y ONT/ONU

La arquitectura se articula en torno a tres pilares fundamentales que gestionan el tráfico
desde el núcleo del proveedor hasta el terminal del usuario:

**1. Optical Line Terminal (OLT):** Ubicada en la oficina central o nodo del ISP, la OLT
actúa como el agregador de servicios. Es responsable de convertir las señales
eléctricas de la red core en señales ópticas, gestionar la autenticación de los
terminales de red y coordinar la multiplexación del tráfico ascendente. En Ecuador,

```
CNT EP Masivo y
Gubernamental
```

```
Migración de cobre a GPON; despliegue de 5G
backhaul.
Netlife Residencial
Premium
```

```
Adopción de XGS-PON y ecosistemas de Smart
Home.
Claro
(Conecel)
```

```
Convergente
(Fijo/Móvil)
```

```
Integración de FTTH con despliegue de red 5G
en ciudades clave.
Puntonet Corporativo y
Residencial
```

```
Expansión nacional mediante infraestructura
FTTH de alta densidad.
ISPs
Locales
```

```
Rural y Cantonal Uso de software cloud (AdminOLT/Wispro) para
gestión ágil.
```

```
los operadores utilizan chasis de alta densidad (como la serie Huawei MA5800 o
ZTE Titan) capaces de manejar miles de suscriptores por equipo.
```

**2. Optical Distribution Network (ODN):** Es el medio físico pasivo que interconecta la
OLT con los usuarios. Se compone de fibras feeder (troncales), splitters (divisores),
fibras de distribución y cables drop. La ODN define el presupuesto óptico de la red
y su alcance máximo, que típicamente llega a los 20 km.
**3. Optical Network Terminal (ONT) u Optical Network Unit (ONU):** Es el dispositivo
final en las premisas del cliente que reconvierte la señal óptica en interfaces
Ethernet, Wi-Fi o POTS. En el mercado ecuatoriano, la distinción técnica es sutil: la
ONT se refiere comúnmente a terminales para un solo usuario (FTTH), mientras
que la ONU puede referirse a equipos para múltiples usuarios (FTTB).

### Diferencias entre arquitecturas centralizadas y distribuidas

El diseño de la planta externa en el relieve ecuatoriano obliga a los ingenieros a elegir
entre dos modelos de división:

**- División Centralizada (Nivel único):** Se instala un splitter de gran capacidad (1:
o 1:64) en un Fiber Distribution Hub (FDH) cercano a la oficina central. Todas las
fibras drop viajan directamente desde este punto hasta los abonados. Este modelo
simplifica el mantenimiento y la medición de potencia, pero requiere una inversión
mayor en cableado de distribución. Es común en urbanizaciones densas o edificios
residenciales en Quito y Guayaquil.
**- División en Cascada (Distribuida):** La división se realiza en múltiples etapas, por
ejemplo, un splitter 1:8 en una manga de empalme seguido de otro 1:8 en una caja
NAP (Network Access Point). Este enfoque optimiza el uso de la fibra feeder,
siendo ideal para áreas suburbanas y rurales del Ecuador como el sector Guasmo
Sur en Guayaquil, donde se diseñan distritos para atender demandas específicas
de hasta 1,095 clientes por feeder.

### Capas de red y protocolos clave

La red GPON opera bajo una estructura de capas que asegura la eficiencia en la
transmisión de servicios convergentes. La capa de convergencia de transmisión (GTC) es
el corazón del estándar ITU-T G.984.

**- Capa Core:** Donde reside el enrutamiento IP/MPLS y la gestión de servicios
(Internet, IPTV, VoIP).
**- Capa de Distribución:** Enlace entre el core y las OLTs, a menudo utilizando anillos
protegidos de 10G o 100G.
**- Capa de Acceso:** El dominio GPON propiamente dicho, donde se gestionan los
mecanismos de encapsulación y control de acceso.

El funcionamiento se sustenta en tres tecnologías críticas:

**1. GEM (GPON Encapsulation Method):** Permite fragmentar paquetes Ethernet o
tramas TDM en unidades de datos que viajan de forma eficiente sobre la trama
GPON, soportando servicios con diferentes requisitos de calidad (QoS).

**2. TDMA (Time Division Multiple Access):** Utilizado en el sentido Upstream para
permitir que múltiples ONTs compartan la misma fibra sin colisiones. La OLT asigna
"ranuras de tiempo" específicas a cada ONT basándose en su distancia y demanda
de tráfico.
**3. DBA (Dynamic Bandwidth Allocation):** Un algoritmo que permite a la OLT
redistribuir el ancho de banda no utilizado en tiempo real. Si un usuario no está
consumiendo tráfico, el sistema asigna esa capacidad a otros suscriptores en el
mismo puerto PON, optimizando el rendimiento global de la red.

## Componentes físicos de la infraestructura GPON

El despliegue de redes ópticas en Ecuador exige componentes que resistan condiciones
climáticas diversas, desde la humedad de la costa hasta la altitud de la sierra.

### Terminal de Línea Óptica (OLT)

La OLT es el cerebro de la red. En los despliegues modernos (2024–2026), los
operadores optan por chasis modulares que permiten la coexistencia de GPON y XGS-
PON mediante tarjetas "Combo". Un puerto PON típico tiene una capacidad de 2.
Gbps en Downstream y 1.244 Gbps en Upstream, compartida entre un máximo teórico de
128 usuarios, aunque en Ecuador la norma técnica suele limitarlo a 64 para asegurar una
experiencia de usuario superior.

### El Segmento Pasivo: Splitters y ODN

La Red de Distribución Óptica (ODN) representa la inversión más costosa y duradera. Sus
componentes son:

**- Splitters Ópticos:** Dispositivos pasivos basados en tecnología PLC (Planar
Lightwave Circuit) que dividen la potencia óptica. Cada división introduce una
pérdida de inserción matemática. Por ejemplo, un splitter 1:8 introduce
aproximadamente 10.5 dB de pérdida, mientras que uno de 1:64 introduce entre 20
y 21 dB.
**- Network Access Point (NAP):** Las "cajas NAP" son el punto de conexión final en
la postería. En Ecuador, la correcta georreferenciación de estas cajas es vital para
la logística de instalación de los ISPs.
**- Fibra Óptica Feeder y Drop:** Para los tramos troncales (feeder), se emplea fibra
monomodo G.652D por su baja atenuación. Para el tramo final (drop), se utiliza
fibra G.657 (insensible a curvaturas), crucial para instalaciones en interiores donde
los cables deben pasar por esquinas pronunciadas sin degradar la señal.

## Dinámica del flujo de datos y gestión del espectro

El transporte de información en GPON utiliza la multiplexación por división de longitud de
onda (WDM) para permitir la comunicación bidireccional sobre un solo hilo de fibra.

### Transmisión Downstream (ISP al Usuario)

En el sentido descendente, la OLT transmite datos en la longitud de onda de 1490 nm. El
flujo funciona como un **broadcast** : todos los datos se envían a todas las ONTs. Cada
terminal recibe la trama completa, pero solo desencapsula los paquetes que contienen su

identificador de puerto GEM específico. Para garantizar la seguridad de los datos de otros
usuarios, la OLT aplica cifrado AES-128 bit.

### Transmisión Upstream (Usuario al ISP)

En el sentido ascendente, se utiliza la longitud de onda de 1310 nm. Debido a la topología
P2MP, múltiples ONTs envían datos hacia un único receptor en la OLT. Para evitar
colisiones, el flujo es una ráfaga de datos organizada por el mecanismo TDMA. La OLT
realiza un proceso llamado **Ranging** , midiendo el retardo de ida y vuelta (RTD) de cada
ONT para sincronizar con precisión microsegundos los tiempos de disparo del láser de
cada terminal.

### Presupuesto Óptico y Calidad de Servicio

El diseño de red debe garantizar que la potencia llegue al receptor dentro de un rango
operativo, típicamente entre -8 dBm y -28 dBm. El cálculo del presupuesto óptico se rige
por la siguiente relación:

$$
P_{recibida} = P_{transmitida} - (L_{fibra} \cdot Distancia) - L_{splitters} - L_{empalmes}

- L_{conectores}
$$

En los proyectos de la ESPOL para el Guasmo Sur, se establece que el cumplimiento de
estos niveles de atenuación es crítico para evitar alarmas de "Loss of Signal" (LOS) y
garantizar una compartición efectiva de 1:64.

## Modelado de redes GPON: Estructuras de datos y GIS

El modelado informático de una red GPON es esencial para la automatización del
aprovisionamiento, la simulación de fallas y la planificación de expansiones. Dada la
naturaleza de la tecnología, existen tres formas principales de representar estas redes en
software.

### Representación como Árboles Jerárquicos

Debido a su estructura raíz-ramas-hojas, el modelo de árbol es el más natural para la
gestión lógica. Permite representar la jerarquía física desde la OLT hasta la ONT.

**Ejemplo de esquema JSON para modelado de red:**

JSON

### {

### "olt_nodo": "QUITO_SUR_01",

### "puertos_pon":

### } ] } ] } ] }

### Representación como Grafos (Nodos y Aristas)

Para sistemas de inventario de red (GIS) y algoritmos de ruta mínima (como Dijkstra), se
utiliza una estructura de grafos. Los nodos representan equipos (OLT, Splitter, NAP) o
puntos de interés (postes, cámaras de revisión), y las aristas representan los segmentos
de cable con sus respectivos metrajes y atenuaciones estimadas.

### Modelos GIS y Geoespaciales

En Ecuador, el uso de herramientas como **QGIS** es el estándar para la planificación de
planta externa. Los modelos GIS permiten integrar la red técnica con el catastro urbano,
facilitando el análisis de "Homes Passed" (viviendas frente a las que pasa la fibra). El
modelado incluye capas vectoriales de puntos (NAPs), líneas (tendido aéreo/subterráneo)
y polígonos (áreas de cobertura).

**Pseudocódigo para validación de factibilidad en GIS:**

Python

### def verificar_factibilidad(coordenadas_cliente, capa_naps):

### nap_cercana = encontrar_nap_mas_proxima(coordenadas_cliente,

### capa_naps)

### distancia = calcular_distancia_geodesica(coordenadas_cliente,

### nap_cercana)

### if distancia > 300 : # Límite estándar de cable drop en Ecuador

### return "No factible por distancia"

### if nap_cercana.puertos_libres <= 0 :

### return "No factible por saturación de puertos"

### return "Factible para instalación"

## Aplicación en software y ecosistema OSS/BSS

La gestión de redes GPON en 2024–2026 ha pasado de ser manual a estar altamente
automatizada mediante plataformas de software especializadas.

### Sistemas de Soporte a la Operación (OSS)

Los operadores ecuatorianos utilizan diversas herramientas para el monitoreo y
aprovisionamiento:

**- AdminOLT:** Plataforma en la nube compatible con múltiples marcas (Huawei, ZTE,
V-SOL) que automatiza la creación de perfiles de tráfico y la autorización de ONTs
mediante APIs.
**- Wispro:** Software integral que combina la gestión de la OLT con la facturación y el
control de ancho de banda, permitiendo geolocalizar cajas NAP en Google Maps
para facilitar el trabajo de los técnicos de campo.
**- Huawei iMaster NCE / Nokia Altiplano:** Soluciones de nivel carrier que utilizan
inteligencia artificial para el análisis de logs y mantenimiento predictivo,
optimizando la red automáticamente ante variaciones de potencia o tráfico.

### Monitoreo y Simulación

Herramientas como **NetSense NMS** ofrecen visibilidad profunda de la red PON,
permitiendo correlacionar alertas (por ejemplo, reconocer que 50 ONUs desconectadas en
una NAP indican un corte de fibra en el tramo de distribución y no 50 fallas individuales).
Para la simulación de redes complejas, se integran modelos matemáticos en QGIS para
predecir el impacto de nuevas construcciones en el presupuesto óptico total.

## Ventajas, limitaciones y prospectiva tecnológica

La adopción masiva de GPON en Ecuador no está exenta de desafíos técnicos y
económicos que definen la estrategia de los operadores para el futuro inmediato.

### Análisis de Beneficios y Limitaciones

### El Camino hacia XGS-PON y 50G-PON (2025–2026)

```
Atribut
o
```

```
Ventajas Limitaciones
```

```
Escala
bilidad
```

```
Permite aumentar usuarios sin
cambiar la fibra feeder; coexistencia
con XGS-PON.
```

```
El ancho de banda es
compartido; saturación en
zonas de alta demanda.
Costo
s
```

```
Reducción de CAPEX al ser pasiva;
menor consumo energético (OPEX).
```

```
Alta inversión inicial en
infraestructura civil
(soterramiento).
Técnic
o
```

```
Inmunidad a interferencias
electromagnéticas; vida útil de la
fibra > 25 años.
```

```
Sensibilidad a microcurvaturas y
suciedad en conectores; límite
de 20 km.
```

La tendencia en Ecuador para los próximos dos años se centra en la actualización hacia
**XGS-PON** , que ofrece 10 Gbps simétricos. Operadores como Netlife ya están integrando
estos servicios para soportar aplicaciones de Smart Home, realidad virtual y teletrabajo de
alta exigencia. La gran ventaja de esta evolución es la capacidad de reutilizar la ODN
existente: mediante el uso de filtros WDM o puertos "Combo", los suscriptores GPON
actuales y los nuevos usuarios XGS-PON pueden coexistir en el mismo hilo de fibra sin
interferencias.

A largo plazo, el despliegue de **50G-PON** se vislumbra como la solución para el backhaul
de las redes 5G que están comenzando a operar en el país. Esta tecnología no solo
incrementará la velocidad, sino que introducirá mejoras en la latencia, fundamentales para
la industria 4.0 y la medicina conectada en los centros urbanos más avanzados de la
región.

La consolidación de GPON en Ecuador representa un hito técnico que ha permitido al
país superar infraestructuras obsoletas y posicionarse competitivamente en la economía
global de la información. La integración de hardware robusto, software de gestión
inteligente y un modelado de datos preciso garantiza que la red siga siendo el cimiento de
la transformación digital ecuatoriana en la presente década.
