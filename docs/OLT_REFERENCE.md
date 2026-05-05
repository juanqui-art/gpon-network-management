# OLT (Optical Line Terminal) — Referencia Técnica para Ecuador

## 1. Definición y Rol

Una **OLT (Optical Line Terminal)** es el equipo activo en la cabecera de la red
GPON, ubicado típicamente en la central técnica (CO, Central Office) o en un
punto de presencia (PoP, Point of Presence). Es el responsable de:

- **Agregar y distribuir tráfico** desde la red de core hacia múltiples clientes
  finales a través de la red pasiva (splitters y NAPs).
- **Convertir señales ópticas en datos** (downstream) y datos en señales ópticas
  (upstream).
- **Sincronizar temporalmente** todas las ONTs conectadas mediante el protocolo
  de rango (Ranging) del estándar ITU-T G.984.
- **Gestionar ancho de banda** dinámicamente entre usuarios (DBA, Dynamic
  Bandwidth Allocation).
- **Monitorear** la calidad de la red (niveles de potencia, errores, alarmas).

### Posición en la arquitectura GPON

```
Red de Core (IP/Ethernet)
        |
       OLT (Cabecera)
        |
   [Splitters de 1er nivel]
        |
   [Splitters de 2do nivel] (opcional)
        |
      NAPs (Cajas de acceso)
        |
      ONTs (Clientes finales)
```

La OLT es el **punto de origen único** de la red PON. Todo tráfico, tanto
descendente como ascendente, pasa obligatoriamente por ella.

---

## 2. Equipos OLT Reales Usados en Ecuador

Basado en despliegues actuales de operadores como CNT, Netlife y proveedores
regionais, estos son los OLTs más comunes:

### 2.1 Huawei — Serie MA5800 (Dominante en Ecuador)

| Modelo | Capacidad | Puertos PON | Clase Típica | Potencia TX | Uso |
|--------|-----------|------------|-------------|------------|-----|
| **MA5800-X7** | 16 PON | 16 | B+, C+ | +2.5 dBm | Urbano/Periférico |
| **MA5800-X15** | 16 PON | 16 | B+, C+ | +2.0 dBm | Despliegues medianos |
| **MA5801-FL16** | 16 PON | 16 | C++, C+++ | +6.5 dBm | Rural largo alcance |
| **MA5800-OLT-X7** | Modular | Hasta 128 PON | Variable | Variable | Cabeceras grandes |

**Características generales Huawei:**
- Tarjetas intercambiables para GPON/XGS-PON
- Interfaz de gestión web y telnet/SSH
- Soporte para SNMP v2/v3
- Consumo de potencia: 300-800 W según configuración
- Redundancia: fuentes dobles disponibles
- Ranuras: típicamente 4-8 ranuras de línea

**Fortalezas en Ecuador:**
- Compatibilidad total con infraestructura existente
- Partes y soporte disponibles localmente
- Excelente relación precio/rendimiento

---

### 2.2 ZTE — Serie C300/C320

| Modelo | Capacidad | Puertos PON | Clase Típica | Potencia TX | Uso |
|--------|-----------|------------|-------------|------------|-----|
| **C320** | 16 PON | 16 | B+, C+ | +3.0 dBm | Urbano estándar |
| **C300/C330** | 16 PON | 16 | B+, C+ | +2.5 dBm | Periférico |
| **C320-M** | Modular | Hasta 128 PON | Variable | Variable | Cabeceras |

**Características generales ZTE:**
- Interfaz gráfica amigable
- API REST para integración
- Soporte para TR-069 (protocolo de gestión remota)
- Consumo: 250-700 W
- Redundancia disponible

**Fortalezas:**
- Buen precio inicial
- Tarjetas GPON/XGS-PON intercambiables
- Excelente documentación técnica

---

### 2.3 Nokia (Antiguamente Alcatel-Lucent)

| Modelo | Capacidad | Puertos PON | Clase Típica | Potencia TX | Uso |
|--------|-----------|------------|-------------|------------|-----|
| **7375 Aggregation Services Router** | Hasta 128 PON | Variable | C++, C+++ | Variable | Cabeceras grandes |
| **7360 Aggregation Services Router** | Hasta 64 PON | Variable | C+, C++ | Variable | Despliegues medianos |

**Características generales Nokia:**
- Arquitectura modular de matriz cambiante
- Soporte excepcional para servicios de valor agregado
- SNMP, API REST, CLI estandarizado
- Consumo: 500-2000 W (según configuración)

**Fortalezas:**
- Confiabilidad extrema (usado por operadores tier-1 globales)
- Escalabilidad sin límites prácticos
- Excelente para multiservicio (IPTV, voz, datos)

---

### 2.4 FiberHome (VSOL) — Crecimiento en Latinoamérica

| Modelo | Capacidad | Puertos PON | Clase Típica | Potencia TX | Uso |
|--------|-----------|------------|-------------|------------|-----|
| **AN5516-01** | 16 PON | 16 | B+, C+ | +2.5 dBm | Urbano/Periférico |
| **AN5516-04** | 64 PON | 64 | Variable | Variable | Grandes redes |

**Características:**
- Bajo costo de adquisición
- Interfaz web básica
- Crecimiento en mercados emergentes

---

### 2.5 Mikrotik (Alternativa de bajo costo)

| Modelo | Capacidad | Puertos PON | Clase Típica | Potencia TX | Uso |
|--------|-----------|------------|-------------|------------|-----|
| **CCR1016** + SFP GPON | 1-4 PON | Variable (SFPs) | C+, C++ | +4.5 dBm | Rural, ISPs pequeños |

**Características:**
- Router genérico con slots SFP
- Bajo costo total
- Excelente CLI y API
- Consumo bajo (50-100 W)

**Limitaciones:**
- Tarjetas GPON no optimizadas para el protocolo
- Rendimiento inferior a OLTs dedicadas
- Menor capacidad de DBA

---

## 3. Especificaciones Técnicas Comunes

### 3.1 Puertos PON y su Configuración

Cada puerto PON en una OLT puede configurarse como:

| Parámetro | Descripción | Valores típicos |
|-----------|-------------|-----------------|
| **Tecnología** | Estándar PON | GPON (ITU-T G.984), XGS-PON (ITU-T G.9807), EPON (IEEE 802.3ah) |
| **Clase Óptica** | Presupuesto óptico | B+, C+, C++, C+++, N1, N2, E1, E2 |
| **Velocidad** | Throughput nominal | GPON: 2.5 Gbps down / 1.25 Gbps up; XGS-PON: 10 Gbps down / 10 Gbps up |
| **Split Ratio Objetivo** | Cantidad de ONTs esperadas | 1:16, 1:32, 1:64, 1:128 |
| **Potencia TX** | Potencia de emisión | Típica: +2 a +6 dBm (ajustable en algunos modelos) |
| **Sensibilidad RX** | Potencia mínima recibida | Depende de clase óptica; típica: -28 dBm para B+, hasta -32 dBm para C++ |
| **Wavelength** | Longitud de onda | Downstream: 1490 nm (GPON), 1575-1580 nm (XGS-PON); Upstream: 1310 nm (ambos) |

### 3.2 Clases Ópticas GPON

La OLT determina la clase óptica máxima permitida en su puerto PON. Las ONTs
conectadas no pueden exceder esa clase.

| Clase | Presupuesto (dB) | Alcance Teórico | Uso |
|-------|------------------|-----------------|-----|
| **B+** | 13-28 | ~20 km | Urbano/Periférico estándar |
| **C+** | 17-32 | ~28 km | Rural, mayores distancias |
| **C++** | 20-35 | ~28 km | Rural extremo, alto split |
| **C+++** | Hasta 38 dB | ~28 km | Casos excepcionales |
| **N1** (XGS-PON) | 14-29 | ~20 km | Igual a B+ en performance óptica |
| **N2** (XGS-PON) | 16-31 | ~20 km | Igual a C+ |
| **E1** (XGS-PON) | 18-33 | ~20 km | Igual a C++ |
| **E2** (XGS-PON) | 20-35 | ~20 km | Igual a C+++ |

**Nota importante:** La clase óptica es una **propiedad del módulo SFP** en la OLT,
no del puerto. Un mismo modelo OLT puede tener múltiples clases ópticas si se
instalan diferentes SFPs.

---

## 4. Parametrización de la OLT

### 4.1 Parámetros de Configuración Críticos

Cada puerto PON debe tener configurados:

```
Puerto PON #01
├── Nombre/Descripción: "PON-Urbano-Z05"
├── Tecnología: GPON
├── Clase Óptica: C+
├── Split Ratio Objetivo: 1:32
├── Estado: Activo / Inactivo / Mantenimiento
├── Potencia TX: +3.0 dBm (ajustable en algunos modelos)
├── Rango Máximo: 20 km (típico para GPON)
├── ONTs Conectadas: 28 de 32 puertos (capacidad)
└── Zona Operativa: Z05-Sector-Norte
```

### 4.2 Parámetros Operativos Monitoreados

La OLT contablemente registra en tiempo real:

| Parámetro | Unidad | Rango Normal | Alarma |
|-----------|--------|-------------|--------|
| **RX Power (downstream)** | dBm | -20 a -8 | < -25 o > -5 |
| **TX Power (upstream)** | dBm | -3 a +1 | < -5 o > +3 |
| **BER (Bit Error Rate)** | | < 1e-9 | > 1e-7 |
| **Frame Loss** | % | < 0.001 | > 0.01 |
| **Temperature** | °C | 0-40 (típico) | > 50 |
| **Voltage** | V | 12V ± 10% | ±15% |

---

## 5. Clases Ópticas en Detalle (Ecuatorial)

Para Ecuador, donde la humedad, UV y reparaciones frecuentes son realidad operativa:

### 5.1 Cuándo Usar Clase B+

**Contexto:**
- Redes urbanas densas (< 3 km de distancia típica)
- Split ratio bajo (1:8, 1:16)
- Mantenimiento frecuente esperado

**Presupuesto típico:**
```
Pérdida total = 20-23 dB (margen suficiente)
```

**Ventaja:** Costo mínimo de SFP.
**Desventaja:** Frágil ante acumulación de pérdidas por reparación.

---

### 5.2 Cuándo Usar Clase C+

**Contexto:**
- Redes periurbanas (3-8 km)
- Split ratio medio (1:32)
- Vida útil esperada > 5 años sin revisión óptica profunda

**Presupuesto típico:**
```
Pérdida total = 23-28 dB (margen cómodo)
```

**Ventaja:** Balance costo/robustez.
**Desventaja:** Sigue siendo vulnerable a múltiples reparaciones.

---

### 5.3 Cuándo Usar Clase C++

**Contexto:**
- Redes rurales (8-20 km)
- Split ratio alto (1:64)
- Expectativa de 7-10 años de operación con mínima degradación

**Presupuesto típico:**
```
Pérdida total = 20-24 dB (amplio margen para reparación)
```

**Ventaja:** Robustez máxima.
**Costo:** 30-50% más caro que C+.

---

## 6. Capacidad y Escalabilidad

### 6.1 Puertos PON vs. Cantidad de Clientes

Un concepto común errado: **1 puerto PON ≠ 1 cliente**.

Mediante multiplexación temporal (TDMA, Time Division Multiple Access) en GPON,
**múltiples ONTs comparten un mismo puerto PON**.

```
1 Puerto PON GPON
└─ Split Ratio 1:32
   └─ Hasta 32 ONTs (clientes teóricos)
      └─ Pero cada cliente ocupa ancho de banda compartido
         (DBA: Dynamic Bandwidth Allocation)
```

**Cálculo de capacidad:**

```
Ancho de banda disponible por cliente = 2.5 Gbps downstream / cantidad de ONTs
Ejemplo: 2.5 Gbps / 32 ONTs ≈ 78 Mbps por ONT (en teoría sin contención)
```

En práctica operativa, los ISPs ecuatorianos configuran:
- **1:16 o 1:32** para GPON en urbano (garantizar 50-100 Mbps por cliente)
- **1:64** solo en casos de muy baja demanda por cliente

### 6.2 Cálculo de Escalabilidad

**Si instalas una OLT Huawei MA5800-X7:**

```
- 16 puertos PON
- Cada puerto en 1:32 = 32 ONTs
- Total clientes teóricos = 16 × 32 = 512 clientes
- Ancho de banda total = 16 × 2.5 Gbps = 40 Gbps downstream

PERO en práctica operativa ecuatoriana:
- Split más conservador: 1:16 a 1:20
- Total realista = 16 × 20 = 320 clientes
- Margen para crecimiento: bueno
```

---

## 7. Potencia Óptica TX y Sensibilidad RX

### 7.1 Transmisión (Downstream, OLT → ONT)

**Rango típico OLT:**
```
Potencia TX mínima: +0 dBm
Potencia TX máxima: +6 dBm
Valor típico configurado: +2.5 a +3.0 dBm
```

**Por qué la OLT emite a baja potencia:**

1. Protege receptores ONT (evita saturación)
2. Reduce interferencia de reflexión (backrefection)
3. Cumple con normas ITU-T G.984 de emisión máxima
4. Extiende vida útil del SFP

**Estrategia de ajuste en campo:**

Si todas las ONTs reportan RX = -25 dBm (bajo) → aumentar TX a +3.5 dBm
Si algunas ONTs reportan RX = -8 dBm (saturación) → reducir TX a +2.0 dBm

---

### 7.2 Recepción (Upstream, ONT → OLT)

La OLT recibe señales de múltiples ONTs en time slots diferentes.

**Rango de sensibilidad típica:**

| Clase | Sensibilidad RX | Corresponde a |
|-------|-----------------|---------------|
| **B+** | -28 dBm | ~13-28 dB de presupuesto |
| **C+** | -30 dBm | ~17-32 dB de presupuesto |
| **C++** | -32 dBm | ~20-35 dB de presupuesto |

**Interpretación:** Si la OLT tiene Clase C++ con sensibilidad -32 dBm, puede
recibir señales tan débiles como -32 dBm y aún decodificarlas correctamente.

---

## 8. Integración en el Sistema GPON

```
OLT
├── [Puertos PON Activos] — Cada uno conectado a un árbol de splitters
│   ├── PON #1: conectado a Splitter 1:16 → 16 NAPs
│   ├── PON #2: conectado a Splitter 1:32 → 32 NAPs
│   └── PON #N: ...
│
├── [Tarjeta de Línea Uplink] — Conecta OLT a core (IP/Ethernet)
│   └── Interfaz GE o 10GE hacia router de borde
│
├── [Tarjeta de Administración] — Management, SNMP, CLI
│
└── [Tarjeta de Alimentación Redundante]
```

---

## 9. Parámetros para la Aplicación GPON System

Al modelar una OLT en la aplicación, estos son los campos **obligatorios** y
**opcionales**:

### 9.1 Campos Obligatorios

```typescript
interface OLT {
  id: string;                      // UUID único
  code: string;                    // Ej: "PIC-UIO-CAR-OLT-01"
  name: string;                    // Ej: "OLT Principal Quito"
  
  location: GeoPoint;              // Coordenadas [lng, lat]
  location_quality: DataQuality;   // unknown | approximate | gps_captured | verified
  
  pon_standard: "gpon" | "xgs_pon"; // Tecnología del puerto
  total_pon_ports: number;         // Ej: 16
  
  optical_class: "B+" | "C+" | "C++" | "C+++"; // Clase óptica del SFP instalado
  
  status: ElementStatus;           // planned | active | inactive | faulty | retired
}
```

### 9.2 Campos Opcionales (Aplicación Futura)

```typescript
interface OLTExtended {
  // Equipamiento físico
  manufacturer: string;             // Huawei, ZTE, Nokia, etc.
  model: string;                    // MA5800-X7, C320, etc.
  serial_number: string;            // Número de serie único
  
  // Parametrización óptica
  tx_power_dbm: number;             // Potencia de transmisión ajustada
  maximum_range_km: number;         // Rango máximo configurado (típico: 20)
  maximum_distance_differential_km: number; // Limit de ranging (típico: 20)
  
  // Capacidad
  total_client_capacity: number;    // Clientes teóricos máximos
  current_connected_onts: number;   // ONTs conectadas actualmente
  
  // Datos operacionales
  installed_date: string;           // ISO 8601
  last_maintenance: string;         // ISO 8601
  expected_lifespan_years: number;  // Típico: 5-10
  
  // Notas y referencias
  notes: string;
  address_reference: string;        // "Edificio CNT, Piso 3, Rack A"
  contact_person: string;           // Técnico responsable
  snmp_ip: string;                  // IP de gestión SNMP (si aplica)
}
```

---

## 10. Matrices de Decisión para Seleccionar OLT

### 10.1 Por Tipo de Red

| Tipo de Red | OLT Recomendada | Justificación |
|-------------|-----------------|---------------|
| **Urbano denso (<2 km)** | Huawei MA5800-X7, B+ | Bajo costo, capacidad suficiente |
| **Urbano estándar (2-5 km)** | Huawei MA5800-X7, C+ | Balance costo/robustez |
| **Periurbano (5-10 km)** | ZTE C320, C+ | Buena relación precio/performance |
| **Rural (10-20 km)** | Huawei MA5801-FL16, C++ | Diseñado para distancia |
| **Rural extremo (>20 km)** | Nokia 7375 o similares | Clase C++ garantizada |
| **ISP muy pequeño** | Mikrotik CCR1016 + SFP | Bajo costo inicial |

### 10.2 Por Capacidad Esperada

| Clientes Esperados | Puertos PON | Modelo Sugerido | Notas |
|------------------|-------------|-----------------|-------|
| < 100 | 2-4 | MA5800-X7 (1-2 puertos) | Sobre-dimensionado pero flexible |
| 100-200 | 4-8 | MA5800-X7 (4 puertos) | Split 1:16-1:32 |
| 200-500 | 8-16 | MA5800-X7 (16 puertos) | Máxima capacidad de este modelo |
| > 500 | Modular | MA5800-OLT-X7 (modular) | Escalable sin límites |

---

## 11. Integración SNMP y Monitoreo

### 11.1 OIDs Comunes por Fabricante

**Huawei MA5800:**
```
Potencia RX por ONT: 1.3.6.1.4.1.2011.6.150.*.*.*.1.1.23
Estado de ONT: 1.3.6.1.4.1.2011.6.150.*.*.*.1.1.21
BER: 1.3.6.1.4.1.2011.6.150.*.*.*.1.1.50
```

**ZTE C320:**
```
Potencia RX por ONT: 1.3.6.1.4.1.3902.1089.1.1.1.1.1.1.40
Estado de ONT: 1.3.6.1.4.1.3902.1089.1.1.1.1.1.1.35
```

**Nokia 7360:**
```
Estándar MIB IETF (más compatible)
Potencia: 1.3.6.1.2.1.25.3.2.1.4
```

---

## 12. Caso de Uso: OLT en el Sistema GPON Network Management

### Flujo de Creación de OLT

```
1. Ingeniero crea OLT en el editor del mapa
   ├─ Click [Crear] → [OLT]
   ├─ Posiciona en mapa (Quito, coordenadas CO)
   └─ Llena form:
      - Código: PIC-UIO-CAR-OLT-01
      - Nombre: OLT Principal Carcelen
      - Clase Óptica: C+
      - Puertos PON: 16
      - Estado: planned

2. Sistema guarda en DB:
   ├─ infrastructure_elements (tipo = 'olt')
   └─ Generará warnings si:
      - Falta clase óptica
      - Total puertos PON = null
      - Ubicación sin verificar (location_quality = 'unknown')

3. Ingeniero dibuja rutas feeder OLT → Splitters
   ├─ Cada ruta asociada a un puerto PON lógico
   └─ Sistema calcula presupuesto óptico considerando clase OLT

4. Calculadora óptica valida:
   - "Clase C+ soporta hasta 32 dB de pérdida"
   - Ruta feeder 3 km + splitter 1:16 + conectores
     = total 21 dB → VERDE ✓

5. Sistema genera reportes por OLT:
   - Puertos ocupados / disponibles
   - Clientes por puerto (futura fase)
   - Presupuesto óptico por ruta feeder
   - Advertencias de capacidad
```

---

## 13. Referencias Normativas

- **ITU-T G.984 (G-series Recommendations):** GPON estándar
- **ITU-T G.9807.1:** XGS-PON estándar
- **IEEE 802.3ah:** EPON estándar (menos usado en Ecuador)
- **IEEE 1588:** Sincronización temporal en redes PON
- **TR-156 (Broadband Forum):** Management de sistemas GPON
- **TR-157:** Management de equipos OLT

---

## 14. Contacto Técnico y Soporte

**Fabricantes con presencia en Ecuador:**

| Fabricante | Contacto Local | Soporte |
|-----------|-----------------|---------|
| Huawei | Ecuador@huawei.com | 24/7 por CNT/Netlife |
| ZTE | Ecuador@zte.com.cn | Disponible |
| Nokia | Distribuidor regional | Disponible |
| FiberHome | Distribuidor regional | Limitado |

---

## 15. Checklist de Parametrización OLT en Campo

Antes de activar una OLT en producción:

- [ ] Verificar modelo y serie en sitio
- [ ] Confirmar clase óptica del SFP instalado (B+, C+, C++)
- [ ] Medir potencia TX con medidor óptico (debe estar entre +2 a +3 dBm)
- [ ] Probar puerto PON con ONT de prueba
- [ ] Registrar en sistema: código, nombre, puertos, clase, ubicación
- [ ] Configurar IP de gestión (SNMP)
- [ ] Verificar redundancia (fuente dual si aplica)
- [ ] Crear back-up de configuración
- [ ] Documentar: foto, coordenadas GPS, contacto técnico
- [ ] Capturar baseline de potencia RX en prueba de campo
