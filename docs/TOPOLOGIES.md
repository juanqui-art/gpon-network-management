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

### Recomendación para Ecuador: EMPEZAR CON CASCADA

**Por qué:**
- Es la topología más robusta operacionalmente
- Escala sin perder margen óptico
- Tolera mejor las reparaciones de campo
- Es lo que operadores reales usan (Casos 3, 4, 6)

**Flujo recomendado:**

```
Fase 1 (MVP):     1 OLT → 1 Splitter 1:16 → 8-16 NAPs (Star simple)
                  ↓
Fase 2 (Expansión): 1 OLT → 1 Splitter 1:2 → 2 Splitters 1:8 → 16 NAPs (Cascada 1:2→1:8)
                  ↓
Fase 3 (Escala):  1 OLT → 1 Splitter 1:2 → 2 Splitters 1:4 → 8 Splitters 1:8 → 32+ NAPs
```

### Migración de Star a Cascada

Si empiezas con Star 1:16:

1. Mantén OLT existente
2. Coloca un Splitter 1:2 primario después de feeder
3. Divide las 16 rutas de distribución en 2 grupos de 8
4. Agrupa cada grupo bajo un Splitter 1:8 secundario
5. Resultado: Cascada 1:2 → 1:8 (total 1:16 efectivo)
6. Margen sigue siendo robusto

→ **Se recomienda planificar Cascada desde el inicio** si la zona tiene potencial de crecer >2 km.
