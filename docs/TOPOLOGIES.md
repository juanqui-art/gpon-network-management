# Topologías GPON — Guía para Ecuador

Este documento describe las tres topologías pre-configuradas en el sistema, basadas en investigación de despliegues reales en Ecuador.

## 1. Estrella Centralizada (1:16)

```
                    OLT
                     |
                 [SPL 1:16]
                /    |    \
            NAP1  NAP2 ... NAP16
```

### Características
- **Arquitectura:** 1 OLT → 1 Splitter 1:16 → 16 NAPs
- **Cobertura:** 1-2 km² urbano denso
- **Fibra estimada:** 40-60 km (feeder + distribution)
- **Puertos NAP:** 8 puertos c/u (típico)

### Cuándo usar
✅ Centros urbanos densos (edificios, MDU)  
✅ Zonas bien planificadas (grillas ordenadas)  
✅ Fácil de diagnosticar y mantener  
✅ Bajo costo de implementación inicial  

### Ventajas
- Diagnóstico simple: un punto de falla es el splitter
- Fibra corta en distribución
- Administración centralizada

### Desventajas
- Si el splitter falla, 16 NAPs se quedan sin servicio
- Limitado a ~28 dB presupuesto óptico (Clase B+)

### Presupuesto óptico típico
- Fibra feeder: ~2 km → 0.60 dB @ 1490nm
- Splitter 1:16: 13.8 dB
- Conectores (4): 2.0 dB
- Margen: 3-5 dB
- **Total:** ~19.4 dB — bien dentro de B+

---

## 2. Urbano Muy Denso (1:32 centralizado) — EXCEPCIONAL

⚠️ **Nota:** Esta topología existe teóricamente pero **rara vez se deplega en Ecuador**. Los despliegues reales prefieren cascadas 1:2→1:8 o 1:4→1:8. Se incluye como referencia histórica, no como opción de diseño.

```
                    OLT
                     |
              [SPL1:4 Primario]
              /      |      \
           SPL1    SPL2    SPL3    SPL4  (Nivel 2, 1:8 c/u)
           /|\      /|\     /|\     /|\
         NAP.. NAP.. NAP.. NAP.. NAP.. NAP..
         (32 NAPs totales)
```

### Características
- **Arquitectura:** 1 OLT → 4 Splitters 1:4 → 8 Splitters 1:8 → 32 NAPs
- **Cobertura:** 1-2 km² urbano **extremadamente denso**
- **Fibra estimada:** 40-80 km
- **Puertos NAP:** 8 puertos c/u
- **Caso de uso real:** Edificios residenciales MDU (Multi-Dwelling Unit)

### Cuándo usar (raramente)
⚠️ Solo edificios o conjuntos cerrados con:
- Muy alta densidad de apartamentos (>300 unidades en <1 km²)
- Cableado vertical subterráneo
- Punto único de concentración conocido

### Por qué casi nunca se usa en Ecuador
- Presupuesto óptico muy apretado (margen <2 dB)
- Múltiples puntos de falla en cascada
- Difícil de mantener y diagnosticar
- **Los operadores reales prefieren: 1:2→1:8 (Cascada) o 1:16 (Star simple)**

### Ventajas (teóricas)
- Teóricamente escalable a 32 NAPs
- Un solo feeder principal

### Desventajas (reales)
- Presupuesto óptico muy justo (~28-30 dB, límite de B+)
- 4 niveles de cascada = 4 puntos de falla
- Mayor complejidad sin beneficio operativo real
- Riesgo de margen insuficiente tras reparaciones

### Presupuesto óptico típico
- Fibra feeder (primario): ~2 km → 0.60 dB
- Splitter primario 1:4: 7.2 dB
- Fibra feeder (secundario): ~1.5 km → 0.45 dB
- Splitter secundario 1:8: 10.5 dB
- Conectores (4): 1.0 dB
- Margen: 3-5 dB
- **Total:** ~23 dB — **AMARILLO** (al límite de B+, no recomendado)

---

## 3. Cascada Balanceada (1:2→1:4→1:8) — ESTÁNDAR EN ECUADOR

✅ **Esta es la topología real más común en Ecuador** para periurbano y rural. Aparece en Caso 3, 4, 6 de la investigación de campo.

```
                        OLT
                         |
                  [SPL1:2 Primario]
                   /              \
              SPL1 (1:4)      SPL2 (1:4)
              /    |    \     /    |    \
           SPL1  SPL2 ... SPL8  ... (Nivel 3, 1:8 c/u)
           /|\   /|\      /|\
         NAP.. NAP.. ... NAP.. (teórico máx: 64 NAPs)
```

### Características
- **Arquitectura:** 1 OLT → 1 Splitter 1:2 → 4 Splitters 1:4 → 8 Splitters 1:8
- **Escala práctica:** 16-32 NAPs efectivos (no 64)
- **Cobertura:** 3-10 km² periurbano/rural
- **Fibra estimada:** 80-150 km
- **Puertos NAP:** 8 puertos c/u
- **Split ratio final:** Aproximadamente 1:32 efectivo (2 × 4 × 8 = 64, pero se usa 1:16-1:32 operacionalmente)

### Cuándo usar (ESTÁNDAR)
✅ **Periurbano:** 3-5 km de distancia, densidad media  
✅ **Rural:** 5-15 km, población dispersa  
✅ **Expansiones suburbanas con geografía lineal**  
✅ **Zonas con topografía complicada** (valles, laderas)  

### Ventajas (REALES en Ecuador)
- **Distribuye el riesgo:** Si un splitter falla, solo afecta ~8 NAPs (no 16-32)
- **Presupuesto óptico robusto:** 20-24 dB con margen confortable
- **Escalable sin perder margen:** Puedes agregar NAPs sin rediseñar
- **Mantenimiento en campo:** Splitters 1:4 y 1:8 son equipos estándar, bajo costo
- **Flexibilidad geográfica:** Splitters pueden reubicarse fácilmente

### Desventajas (manejables)
- Tres niveles de cascada vs. uno en Star
- Más cableado feeder pero mejor distribuido
- Requiere planificación de rutas (pero es más realista)

### Presupuesto óptico típico
- Fibra feeder (nivel 1): ~2 km → 0.60 dB
- Splitter nivel 1 (1:2): 3.5 dB
- Fibra feeder (nivel 2): ~1.5 km → 0.45 dB
- Splitter nivel 2 (1:4): 7.2 dB
- Fibra distribution (nivel 3): ~1 km → 0.30 dB
- Splitter nivel 3 (1:8): 10.5 dB
- Conectores (6): 1.5 dB
- Margen: 4-5 dB
- **Total:** ~29 dB — límite de C+, recomendar C++

---

## Matriz de decisión — BASADA EN CASOS REALES ECUATORIANOS

| Aspecto | Star (1:16) | Excepcional 1:32 | Cascada (1:2→1:4→1:8) |
|---------|-----------|-----------|------------|
| **Zona típica** | Urbano denso | Edificios MDU | Periurbano/Rural ✅ |
| **NAPs efectivos** | 12-16 | 28-32 | 16-32 |
| **Fibra (km)** | 40-80 | 40-80 | 80-150 |
| **Presupuesto óptico** | B+ (20-23 dB) ✅ | B+ (margen <2dB) ⚠️ | C+ (20-24 dB) ✅ |
| **Puntos de falla** | 1 splitter | 4 splitters | 2-3 splitters |
| **Robustez ante reparaciones** | Baja | Muy baja | Media-Alta ✅ |
| **Mantenimiento** | Simple | Complejo | Medio ✅ |
| **Costo SFP OLT** | Bajo (B+) | Bajo (B+) | Medio (C+) |
| **Costo Splitters** | ~1 equipo | ~4-5 equipos | ~3-5 equipos |
| **CAPEX por NAP** | Alto | Muy alto | Bajo ✅ |
| **Frecuencia en Ecuador** | Común en centros | Raro | MUY COMÚN ✅ |
| **Casos reales** | Caso 1 (edificios) | Solo teoría | Casos 3, 4, 6 |

---

## Notas técnicas — ALINEADAS A PRÁCTICA ECUATORIANA

### Splitters reales usados en Ecuador

**NO son comunes los 1:32 centralizados.** Los reales son:

| Splitter | Dónde se usa | Frecuencia | Observación |
|----------|-------------|-----------|------------|
| **1:16** | Feeder principal (Caso 2, urbano estándar) | ✅ Muy común | Estándar de la industria |
| **1:8** | Distribución / NAP interno (Casos 3, 4, 6) | ✅ Muy común | Flexible y manejable |
| **1:4** | Cascada nivel 2 (Caso 6) | ✅ Común en cascada | Para distribuir geográficamente |
| **1:2** | Cascada nivel 1 (Caso 6) | ✅ Común en cascada | Divide feeder en dos ramas |
| **1:32** | Centralizado (Caso 1 solo MDU) | ❌ Raro | Solo edificios extremadamente densos |
| **1:64** | Teórico | ❌ Casi nunca | No hay casos reales en Ecuador |

### Clase óptica recomendada por topología (REAL)

**Star (1:16)**: B+ (20-23 dB)
- Margen: holgado ✅
- Aplicar cuando: distancia <2 km, zona urbana densa
- Validación: ascendente y descendente

**Excepcional 1:32**: B+ (margen <2 dB) ⚠️
- Margen: MUY apretado, NO RECOMENDADO
- Aplicar solo en: edificios MDU con punto único
- Riesgo: Una reparación invalida el margen

**Cascada (1:2→1:4→1:8)**: C+ (20-24 dB) ✅ RECOMENDADO ECUADOR
- Margen: cómodo, con resiliencia
- Aplicar cuando: periurbano/rural >2 km
- Validación: **CRÍTICA en upstream (1310 nm)** por distancia

### Materiales recomendados

| Tramo | Fibra | Motivo |
|-------|-------|--------|
| Feeder (OLT → Splitter L1) | G.652.D | Bajo costo, bajo atenuación, enlaces largos |
| Distribution L2+ | G.652.D o G.657.A1 | Balance costo/curvas |
| Drop (futuro) | G.657.A2 | Resistencia a curvaturas cerradas |

### Validación as-built

Después de instalar cualquier topología:
1. **Medición óptica** en cada NAP (RX > -20 dBm para B+)
2. **OTDR** en rutas feeder si margen es <3dB
3. **Verificación de código operativo** en cada elemento
4. **Foto de as-built** con GIS actualizado

---

## 🚀 FUTURE-PROOF: COMPATIBILIDAD CON XGS-PON (2026-2030)

### El Cambio Tecnológico: GPON → XGS-PON

La transición hacia XGS-PON (10 Gbps simétrico) es inevitable, pero **NO requiere cambios en la infraestructura física**. Splitters, fibra y topología se mantienen. Solo cambia la electrónica.

```
GPON (2026)                          XGS-PON (2027+)
├─ Velocidad: 2.5 Gbps down         ├─ Velocidad: 10 Gbps down
├─ Wavelength: 1490/1310 nm         ├─ Wavelength: 1577/1270 nm
├─ Clase: B+, C+, C++, C+++         ├─ Clase: N1, N2, E1, E2
└─ Coexistencia: WDM en mismo cable └─ (Ambas viajan juntas por la fibra)
```

### Cómo Funciona la Coexistencia (WDM)

La **Multiplexación por División de Longitud de Onda (WDM)** permite que GPON y XGS-PON viajen simultáneamente en el **mismo hilo de fibra óptica**:

```
┌─────────────────────────────────────────────────────┐
│  1 FIBRA COMPARTIDA (G.652D)                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  GPON (1490 nm downstream + 1310 nm upstream)      │
│  ││││││││││││││││││││││││││││││││││││││││││││││││││  
│                                                     │
│  XGS-PON (1577 nm downstream + 1270 nm upstream)   │
│  ││││││││││││││││││││││││││││││││││││││││││││││││││  
│                                                     │
│  Filtro WDM en la OLT separa las longitudes de onda│
│  (GPON ONTs solo ven 1490/1310 nm)                 │
│  (XGS-PON ONTs solo ven 1577/1270 nm)              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Ventaja para operadores:** Migrar cliente por cliente sin reemplazar infraestructura.

### Compatibilidad de Cada Topología con XGS-PON

| Topología | GPON (Hoy) | XGS-PON (Futuro) | Estrategia Migración |
|-----------|-----------|-----------------|----------------------|
| **Star 1:16** | ✅ Viable | ✅ Viable (puerto sigue 1:16) | Cambiar ONTs, mantener splitters |
| **Cascada 1:2→1:4→1:8** | ✅ **RECOMENDADO** | ✅ **ÓPTIMO** | Cambiar ONTs y SFP OLT solo |
| **Excepcional 1:32** | ⚠️ Marginal | ❌ No recomendado | Rediseñar si se expande |

**Conclusión:** La **Cascada es la topología más future-proof**. Permite migración fluida sin cambios arquitectónicos.

---

## 📅 HOJA DE RUTA: GPON → XGS-PON (2026-2030)

Basada en investigación de despliegues reales en Ecuador.

### FASE 1: Optimización GPON (2025-2026) — ACTUAL

**Estado:** 🟢 Activa

**Objetivo:**
- Maximizar uso de OLTs GPON existentes
- Segmentar ratios de división sobrepoblados (1:64 → 1:32)
- Preparar clientes premium para migración a XGS-PON

**Acciones:**
- Mantener topología Cascada 1:2→1:4→1:8
- Margen óptico recomendado: **4-5 dB** (NO 3 dB)
  - Compensar humedad tropical, UV, reparaciones futuras
- Planes GPON hasta 1 Gbps con overselling 2:1
- Identificar usuarios candidatos para XGS-PON (alto consumo)

**Parámetros de Diseño:**
```
├─ Split ratio máximo: 1:32 (NO 1:64)
├─ Clientes por puerto: 16-20 (NO 32)
├─ Presupuesto mínimo: C+ (31 dB)
├─ Margen de seguridad: 4 dB (tropical)
└─ Clase óptica: B+ o C+
```

---

### FASE 2: Introducción XGS-PON Híbrida (2026-2028) — INICIANDO

**Estado:** 🟡 Iniciando en zonas premium

**Objetivo:**
- Desplegar capacidad 10 Gbps en segmentos de alto valor
- Coexistir GPON + XGS-PON en infraestructura compartida
- Lanzar planes 2-5 Gbps para diferenciación comercial

**Acciones:**
- Instalar **tarjetas Combo PON** en OLT (emiten 1490/1310 nm + 1577/1270 nm)
- Mantener **mismos splitters** (1:2, 1:4, 1:8, 1:16) — NO reemplazo
- Reemplazar ONTs de clientes premium por ONTs XGS-PON
- Filtros WDM para evitar interferencia entre wavelengths

**Parámetros de Diseño:**
```
├─ Topología: MISMA Cascada 1:2→1:4→1:8
├─ Splitters: Compatibles con ambas wavelengths
├─ Fibra: G.652D / G.657A1 (no cambio)
├─ Presupuesto XGS-PON: Clase N2 (31 dB, similar a B+)
├─ Margen de seguridad: 4 dB (mismo que GPON)
└─ Planes: GPON ≤1 Gbps, XGS-PON 2-5 Gbps
```

**Coexistencia en el Mismo Cable:**
```
Feeder OLT → Splitter 1:2
            ├─ Rama A (GPON): Splitter 1:4 → Splitter 1:8 → NAPs GPON
            │  (1490/1310 nm viajen por fibra)
            │
            └─ Rama B (XGS-PON): Splitter 1:4 → Splitter 1:8 → NAPs XGS-PON
               (1577/1270 nm viajan por misma fibra, sin interferencia)
```

---

### FASE 3: Dominancia XGS-PON (2028-2030) — CONSOLIDACIÓN

**Estado:** 🔵 Planificada

**Objetivo:**
- Estandarizar la red en XGS-PON
- Retirar progresivamente OLTs GPON puras
- Ofrecer planes multi-gigabit como estándar

**Acciones:**
- Migración total de ONTs GPON a XGS-PON (precio se igualó por economía de escala)
- Retiro ordenado de SFPs GPON de la OLT
- Consolidación de todas las ONTs bajo la plataforma 10G
- Planes estándar 5-10 Gbps

**Parámetros de Diseño:**
```
├─ Topología: MISMA Cascada 1:2→1:4→1:8
├─ Tecnología: XGS-PON puro (GPON completamente retirado)
├─ Split ratio: 1:32-1:64 (permitido por mayor presupuesto)
├─ Clientes por puerto: Hasta 32-40 con baja contención
├─ Presupuesto: Clase E1/E2 (33-35 dB)
├─ Margen de seguridad: 4 dB (mismo)
└─ Planes: 5-10 Gbps como estándar
```

---

## 🎯 MARGEN ÓPTICO RECOMENDADO PARA CLIMA TROPICAL

**Crítico:** Ecuador requiere margen **4-5 dB mínimo**, NO 3 dB.

### Por qué más margen en Ecuador:

1. **Humedad Relativa (60-90%)**
   - Infiltración en cajas de empalme → +0.5-1.0 dB pérdida
   - Corrosión en conectores → +0.3-0.5 dB por evento

2. **Radiación UV (Línea ecuatorial)**
   - Degradación de jackets de cable drop → fragilidad mecánica
   - Micro-microbends por contracción térmica → +0.2-0.5 dB

3. **Ciclos Térmicos (0-45°C en sierra)**
   - Dilatación/contracción de fibra → micro-curvaturas
   - Cada ciclo añade ~0.05-0.1 dB acumulativo

4. **Reparaciones Acumuladas**
   - Cada empalme de fusión: 0.05-0.1 dB
   - Tercera reparación: +0.3 dB total
   - Sin margen de 4 dB, cliente queda fuera

**Regla de Oro:**
```
Presupuesto total (dB) = Pérdidas + Margen de Seguridad
                       = 20 dB + 4 dB = 24 dB MÍNIMO

Para Clase B+:     28 dB presupuesto → Margen resultante = 4 dB ✅
Para Clase C+:     31 dB presupuesto → Margen resultante = 7 dB ✅✅
Para Clase N2 (XGS-PON): 31 dB presupuesto → Margen resultante = 7 dB ✅✅
```

---

## 📋 DECISIÓN FINAL: RECOMENDACIÓN GLOBAL

**Para proyectos nuevos en Ecuador (2026 en adelante):**

```
✅ USAR TOPOLOGÍA CASCADA (1:2 → 1:4 → 1:8)

Razones:
├─ Distribuye riesgo en 3 niveles (robusto)
├─ Compatible con GPON HOY
├─ Compatible con XGS-PON en FUTURO (sin cambios físicos)
├─ Margen óptico seguro 4-5 dB
├─ Escalable de 16 a 64 NAPs sin rediseño
└─ Migración gradual puerto por puerto en OLT

GPON (2026):        XGS-PON (2027+):
16-32 NAPs          32-64 NAPs
16-20 clientes      32-40 clientes
Planes 1 Gbps       Planes 5-10 Gbps
```

---

## Ejemplo: Generar Star (1:16) en Quito

```typescript
import { generateTopology } from "@/lib/gpon/topology-templates";

const topology = generateTopology("star", -78.5249, -0.2194);
// Genera:
// - 1 OLT en (lng, lat + 0.01)
// - 1 Splitter 1:16 en posición calculada
// - 16 NAPs distribuidos alrededor
// - Rutas de fibra automáticas entre elementos
// - Códigos operativos siguiendo convención PIC-UIO-Z05-*
```

---

## Criterio de migración y evolución

### Recomendación para Ecuador: EMPEZAR CON CASCADA (Future-Proof)

**Por qué:**
- Es la topología más robusta operacionalmente
- Escala sin perder margen óptico
- Tolera mejor las reparaciones de campo
- Es lo que operadores reales usan (Casos 3, 4, 6)
- **✅ Compatible con GPON HOY y XGS-PON MAÑANA** (sin cambios físicos)

**Flujo recomendado:**

```
Fase 1 (MVP 2026):     
  1 OLT GPON → 1 Splitter 1:16 → 8-16 NAPs (Star simple)
  Tecnología: GPON 2.5 Gbps
  Planes: Hasta 1 Gbps
                  ↓
Fase 2 (Expansión 2026-2027): 
  1 OLT DUAL (GPON + XGS-PON) → 1 Splitter 1:2 → 2 Splitters 1:8 → 16 NAPs
  Tecnología: Híbrida (GPON + XGS-PON coexistentes)
  Planes: GPON 1 Gbps + XGS-PON 2-5 Gbps
                  ↓
Fase 3 (Consolidación 2028-2030):
  1 OLT XGS-PON → 1 Splitter 1:2 → 2 Splitters 1:4 → 8 Splitters 1:8 → 32-64 NAPs
  Tecnología: XGS-PON 10 Gbps
  Planes: 5-10 Gbps estándar
```

### Migración GPON → XGS-PON (Sin Cambios de Infraestructura)

**Escenario:** Tienes una red Cascada 1:2→1:4→1:8 con GPON, quieres migrar a XGS-PON.

**Pasos:**

1. ✅ **Splitters y fibra:** NO cambien. Son compatibles con ambas tecnologías
2. ✅ **Topología:** Mantiene exactamente la misma (Cascada 1:2→1:4→1:8)
3. ⚠️ **OLT:** Instala tarjeta Combo PON (emite 1490/1310 nm GPON + 1577/1270 nm XGS-PON)
4. ⚠️ **ONTs:** Reemplaza gradualmente ONTs GPON por ONTs XGS-PON
5. ✅ **Cable:** La misma fibra G.652D transporta ambas longitudes de onda (WDM)

**Resultado:**
```
ANTES (GPON):
Cascada 1:2→1:4→1:8 + ONTs GPON (2.5 Gbps) = 16-20 clientes/puerto

DESPUÉS (Híbrido 2026-2028):
Cascada 1:2→1:4→1:8 + ONTs GPON + ONTs XGS-PON = 16+8 clientes/puerto

FUTURO (XGS-PON 2028-2030):
Cascada 1:2→1:4→1:8 + ONTs XGS-PON (10 Gbps) = 32-40 clientes/puerto
```

**Ventaja clave:** Migrar cliente por cliente sin parar de servir a los demás.

---

## 4. Topología Bus — Red Desbalanceada (Asimétrica)

⚠️ **Especializada:** Esta topología es apropiada para casos MUY ESPECÍFICOS en Ecuador. NO es la opción por defecto.

```
                        OLT
                         |
                  [Splitter Primario]
                   /    |     |    \
              TAP 1   TAP 2  TAP 3  TAP 4
             (10/90) (10/90)(10/90)(10/90)
              |       |      |      |
            NAP1    NAP2   NAP3   NAP4 ... NAP16
```

### Qué es Tecnología Bus Desbalanceada

**Bus Desbalanceado (Asymmetric Splitter Network):** Utiliza splitters de razones **asimétricas** (5/95, 10/90, 20/80, 30/70) para crear una topología de bus donde una rama transporta la mayoría del tráfico (rama 95%) y otras toman pequeñas derivaciones (rama 5%).

**Principio físico:**
- Cada TAP (derivación) usa un splitter asimétrico FBT (Fused Biconical Taper)
- Fibra principal de **baja pérdida** en la rama 95%
- La rama 5% se termina en NAP local (clientes cercanos)
- Se repite a lo largo de ~10-20 km de corredor lineal

**Pérdida de inserción por ratio:**
```
Ratio 5/95:   IL ≈ 13 dB rama 5%, 0.2 dB rama 95%
Ratio 10/90:  IL ≈ 10 dB rama 10%, 0.4 dB rama 90%
Ratio 20/80:  IL ≈ 7 dB rama 20%, 0.9 dB rama 80%
Ratio 30/70:  IL ≈ 5.2 dB rama 30%, 1.5 dB rama 70%
```

### Arquitectura Real Bus 10/90 (Caso Ecuador)

```
OLT (Central Office)
│
├─ Fibra principal G.652D (baja pérdida en rama 90%)
│  Longitud total: 20-30 km (corredor lineal: ruta, carretera, río)
│
├─ @km 0.0: TAP 1 (10/90)
│  ├─ Rama 10% → NAP-UIO-Z05-BUS-001 (8 clientes)
│  └─ Rama 90% → continúa fibra principal
│
├─ @km 5.5: TAP 2 (10/90)
│  ├─ Rama 10% → NAP-UIO-Z05-BUS-002 (8 clientes)
│  └─ Rama 90% → continúa fibra principal
│
├─ @km 11.0: TAP 3 (10/90)
│  ├─ Rama 10% → NAP-UIO-Z05-BUS-003 (8 clientes)
│  └─ Rama 90% → continúa fibra principal
│
└─ ... (hasta 12-16 TAPs en 20-30 km)

TOTAL: 96-128 clientes en una sola fibra (sin splitter primario centralizado)
```

### Características

- **Arquitectura:** 1 OLT → Fibra principal lineal → N TAPs asimétricos → N NAPs
- **Cobertura:** 10-30 km corredor lineal
- **Fibra estimada:** 40-50 km (fibra principal larga + pocos drops cortos)
- **Puertos NAP:** 8 puertos c/u (típico)
- **Distancia diferencial:** Máx 20 km (OLT a último cliente = ~30 km)
- **Split ratio efectivo:** 1:12-1:16 por NAP (no 1:128 total)

### Cuándo usar (Casos ESPECÍFICOS)

✅ **Corredores lineales rurales:**
- Carreteras con clientes dispersos (2-5 km entre clientes)
- Rutas fluviales con comunidades en la orilla
- Líneas de ferrocarril o tuberías con accesos dispersos
- Longitud >15 km; densidad baja y lineal

✅ **Zonas con topografía restrictiva:**
- Valles angostos (solo una ruta de fibra viable)
- Montañas donde splitters centralizados son difíciles de mantener
- Terreno donde divergir ramales de fibra es caro

✅ **Minimizar puntos de falla:**
- NO hay splitter primario centralizado (evita punto único de falla)
- Si un TAP falla, solo ~8 clientes; otros 120 no se afectan

❌ **NO usar en:**
- Zonas urbanas densas (usa Star 1:16)
- Periurbano con clientes en todas direcciones (usa Cascada)
- Geometría tipo árbol (usa Cascada)
- Clientes que requieren redundancia (bus es punto de falla lineal)

### Ventajas (REALES en corredor lineal)

1. **Escalabilidad lineal:** Agrega TAPs sin rediseñar topología
2. **Robustez contra splitter:** NO hay splitter primario centralizado
3. **Baja pérdida en rama principal:** Rama 90% con ~0.4 dB/km (vs. 0.3 dB/km base)
4. **Económico para terreno restrictivo:** Una sola ruta de fibra principal
5. **Mantenimiento operativo:** TAPs son equipos estándar, bajo costo

### Desventajas (CRÍTICAS)

1. **Distancia diferencial limitada:** Máx 20 km entre primer y último cliente
   - OLT a Cliente-1: 0.5 km
   - OLT a Cliente-16: 30 km
   - Diferencia: 29.5 km ❌ EXCEDE 20 km máximo TDMA
   - **Solución:** Usar FEC (Forward Error Correction) o regeneradores

2. **Pérdida acumulada en rama 10%:**
   - TAP entrada: 10 dB rama 10%
   - Fibra distribution (1 km): 0.3 dB
   - Conectores: 1.0 dB
   - **Total en peor caso:** 11.3 dB + splitter NAP 1:8 (10.5 dB) = **21.8 dB**
   - **Margen si clase B+:** 28 - 21.8 = 6.2 dB ✅ Aceptable

3. **Complejidad operativa:**
   - Requiere disciplina en documentación (dónde está cada TAP)
   - Difícil de diagnosticar si hay problema en rama 90%
   - Cambios en árbol óptico complejos

4. **Congestión en rama principal:**
   - Todas 16 ONTs comparten la fibra principal
   - Pérdida en rama 90% afecta a todos los demás
   - Si hay corte, toda la red se cae

5. **No es estándar de industria:**
   - Operadores prefieren topologías simétricas (Star, Cascada)
   - Menos documentación disponible
   - Equipo técnico necesita capacitación especial

### Presupuesto óptico típico — Bus 10/90

**Peor caso: Cliente en TAP más lejano (30 km del OLT)**

```
├─ OLT TX:                              +3.0 dBm (B+)
├─ Fibra feeder (30 km):                -9.0 dB  (30 km × 0.30 dB/km)
├─ Connectors OLT/Splitter (2):         -1.0 dB
├─ Splitter TAP 10/90 (rama 10%):       -10.0 dB ← CRÍTICO
├─ Fibra distribution (1 km):           -0.3 dB
├─ Connectores (2):                     -1.0 dB
├─ Splitter NAP 1:8:                    -10.5 dB
├─ Fibra drop (150 m):                  -0.05 dB
├─ Connectores drop (2):                -1.0 dB
├─ Margen de seguridad:                 -4.0 dB
├─────────────────────────────────────────────
└─ TOTAL PÉRDIDA:                        -36.85 dB ❌ EXCEDE B+ (28 dB)
```

**Solución:** Usar Clase C+ (31 dB) o C++ (35 dB)

```
Con Clase C++:
  Presupuesto 35 dB - Pérdida 30.85 dB = Margen 4.15 dB ✅
```

**Mejor caso: Cliente en TAP cercano (1 km del OLT)**

```
├─ OLT TX:                              +3.0 dBm
├─ Fibra feeder (1 km):                 -0.3 dB
├─ Connectors (2):                      -1.0 dB
├─ Splitter TAP 10/90 (rama 10%):       -10.0 dB
├─ Fibra distribution (0.5 km):         -0.15 dB
├─ Connectores (2):                     -1.0 dB
├─ Splitter NAP 1:8:                    -10.5 dB
├─ Fibra drop (150 m):                  -0.05 dB
├─ Connectores drop (2):                -1.0 dB
├─ Margen seguridad:                    -4.0 dB
├─────────────────────────────────────────────
└─ TOTAL PÉRDIDA:                        -27.95 dB ✅ Dentro de C+ (31 dB)
```

**Conclusión:** Bus 10/90 requiere **Clase C++ como mínimo** para corredor >15 km.

### Comparativa: Bus vs. Star vs. Cascada

| Aspecto | Star 1:16 | Cascada 1:2→1:4→1:8 | **Bus 10/90** |
|---------|-----------|-----------|------------|
| **Geometría ideal** | Urbano denso | Periurbano radial | **Corredor lineal** ✅ |
| **Rango operativo** | 0-2 km | 0-15 km | **0-30 km** ✅ |
| **Cobertura típica** | 1-2 km² | 5-10 km² | **10-30 km lineal** ✅ |
| **NAPs por red** | 12-16 | 16-32 | **12-16** |
| **Presupuesto óptico** | B+ (20-23 dB) | C+ (20-24 dB) | **C++ (31-35 dB)** |
| **Splitter central** | 1 splitter 1:16 | 1 splitter 1:2 | **NINGUNO** ✅ |
| **Puntos de falla** | 1 (splitter) | 2-3 (splitters) | **N TAPs** |
| **Escalabilidad** | Fija (16 NAPs) | Flexible | **Flexible** ✅ |
| **Distancia diferencial** | <2 km | <10 km | **<20 km** ✅ |
| **Mantenimiento** | Simple | Medio | **Complejo** ⚠️ |
| **Uso en Ecuador** | Común urbano | **MUY COMÚN** | **Raro** |
| **Compatibilidad XGS-PON** | ✅ Viable | ✅ Óptima | ✅ Viable |

### Decisión de Diseño: Cuándo Elegir Bus en Ecuador

**Usar Bus 10/90 SOLO si TODOS estos criterios se cumplen:**

```
✅ Geometría: Línea recta >15 km
✅ Densidad: Clientes espaciados 3-5 km (no urbano)
✅ Topografía: Corredor único (río, ruta, ferrocarril)
✅ Operación: Equipo capacitado en TAPs asimétricos
✅ Coste: Ahorro de splitter central compensa complejidad
✅ SLA: Clientes aceptan que fallo de fibra = toda la red cae
❌ Si FALTAN criterios: USAR CASCADA (es más robusto)
```

### Cascada vs. Bus: Matriz de Decisión FINAL

| Decisión | Cascada ✅ | Bus ⚠️ |
|----------|-----------|---------|
| Tienes control de una ruta lineal de 20+ km | NO → Cascada | SÍ → Evalúa Bus |
| Clientes dispersos pero radiales (no lineales) | SÍ → Cascada | NO → No Bus |
| Necesitas redundancia o convergencia | SÍ → Cascada | NO → Bus puede servir |
| Equipo técnico capacitado en TAPs | NO → Cascada | SÍ → Bus viable |
| Presupuesto permite SFP Clase C++ | NO → Cascada | SÍ → Bus viable |
| **RESULTADO FINAL** | **CASCADA** | **BUS** |

### Implementación Bus en app (Futuro)

Cuando se implemente UI para Bus en network-editor.tsx:

```typescript
// Nuevo topology template
generateTopology("bus-linear", center_lng, center_lat, {
  distance_km: 25,
  num_taps: 12,
  tap_ratio: "10/90",
  tap_interval_km: 2.0
})

// Genera:
// - 1 OLT en punto de inicio
// - 1 ruta fibra principal 25 km
// - 12 TAPs en (0, 2, 4, 6, ... 22) km
// - 12 NAPs (1 por TAP)
// - Códigos: PIC-UIO-Z05-BUS-001, BUS-002, etc.
// - Presupuesto óptico: Mínimo C++
```

---

## Matriz de Decisión ACTUALIZADA (4 Topologías)

| Aspecto | Star (1:16) | Excepcional 1:32 | **Cascada (1:2→1:4→1:8)** | **Bus 10/90** |
|---------|-----------|-----------|------------|------------|
| **Zona típica** | Urbano denso | Edificios MDU | **Periurbano/Rural** ✅ | **Corredor lineal** |
| **NAPs efectivos** | 12-16 | 28-32 | **16-32** | 12-16 |
| **Fibra (km)** | 40-80 | 40-80 | **80-150** | 40-50 |
| **Presupuesto óptico** | B+ (20-23 dB) | B+ (margen <2dB) ⚠️ | **C+ (20-24 dB)** ✅ | C++ (31-35 dB) |
| **Puntos de falla** | 1 splitter | 4 splitters | **2-3 splitters** | N TAPs |
| **Robustez** | Baja | Muy baja | **Media-Alta** ✅ | Media (lineal) |
| **Mantenimiento** | Simple | Complejo | **Medio** ✅ | Complejo |
| **Escalabilidad** | Fija | Limitada | **Flexible** ✅ | Flexible |
| **CAPEX por NAP** | Alto | Muy alto | **Bajo** ✅ | Bajo |
| **Frecuencia en Ecuador** | Común urbano | Raro | **MUY COMÚN** ✅ | Raro |
| **Compatibilidad XGS-PON** | ✅ Viable | ❌ No recomendado | **✅ Óptima** | ✅ Viable |
| **Recomendación 2026** | Urbano solo | No usar | **✅ ESTÁNDAR** | Corredor especializado |

---

## 🎯 RESUMEN FINAL: RECOMENDACIÓN POR CASO DE USO

Para nuevos despliegues en Ecuador (2026):

```
┌─────────────────────────────────────────────────────────────┐
│ PREGUNTA 1: ¿Cuál es tu geometría?                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Urbano denso (MDU, edificios)                              │
│   → Usa STAR 1:16 (Clase B+)                               │
│                                                             │
│ Periurbano / Rural radial (clientes en todas direcciones)  │
│   → Usa CASCADA 1:2→1:4→1:8 (Clase C+) ✅ RECOMENDADO     │
│                                                             │
│ Corredor lineal >15 km (ruta, río, ferrocarril)           │
│   → Evalúa BUS 10/90 (Clase C++)                           │
│   → PERO: Usa CASCADA si equipo no está capacitado         │
│                                                             │
│ Mega-densidad >300 apts (raro)                             │
│   → Evita 1:32, usa Cascada dividido en 2 OLTs             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Default para 2026:** CASCADA. Es future-proof, operacionalmente probado, y escala sin rediseño.

### Migración de Star a Cascada (Opcionalidad)

Si empiezas con Star 1:16 y necesitas expandir:

1. Mantén OLT existente
2. Coloca un Splitter 1:2 primario después de feeder
3. Divide las 16 rutas de distribución en 2 grupos de 8
4. Agrupa cada grupo bajo un Splitter 1:4 o 1:8 secundario
5. Resultado: Cascada 1:2 → 1:8 (o 1:2 → 1:4 si escalas más)
6. Margen sigue siendo robusto
7. **Listo para XGS-PON sin cambios adicionales**

→ **Se recomienda planificar Cascada desde el inicio** si la zona tiene potencial de crecer >2 km y se anticipa migración a XGS-PON.
