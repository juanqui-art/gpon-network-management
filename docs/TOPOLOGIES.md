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
- Splitter 1:16: 13.5 dB
- Conectores (2): 0.5 dB
- Margen: 3-5 dB
- **Total:** ~18 dB — bien dentro de B+

---

## 2. Árbol Balanceado (1:32)

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
- **Cobertura:** 3-5 km² urbano/periférico
- **Fibra estimada:** 80-120 km
- **Puertos NAP:** 8 puertos c/u

### Cuándo usar
✅ Expansiones urbanas  
✅ Zonas residenciales medianas  
✅ Balance entre CAPEX y redundancia  
✅ Capacidad media de crecimiento  

### Ventajas
- Mejor distribución de puntos de falla
- Presupuesto óptico más holgado (~32 dB, Clase C+)
- Escalable a 64 NAPs con otro nivel

### Desventajas
- Más complejo que estrella
- Mayor cantidad de splitters = más mantenimiento
- Requiere mejor planificación de rutas

### Presupuesto óptico típico
- Fibra feeder (primario): ~2 km → 0.60 dB
- Splitter primario 1:4: 7.2 dB
- Fibra feeder (secundario): ~1.5 km → 0.45 dB
- Splitter secundario 1:8: 10.5 dB
- Conectores (4): 1.0 dB
- Margen: 3-5 dB
- **Total:** ~23 dB — cómodo en C+

---

## 3. Cascada Balanceada (1:64)

```
                        OLT
                         |
                  [SPL1:2 Primario]
                   /              \
              SPL1 (1:4)      SPL2 (1:4)
              /    |    \     /    |    \
           SPL1  SPL2 ... SPL8  ... (Nivel 3, 1:8 c/u)
           /|\   /|\      /|\
         NAP.. NAP.. ... NAP.. (64 NAPs totales)
```

### Características
- **Arquitectura:** 1 OLT → 2 Splitters 1:4 → 4 Splitters 1:8 → 64 NAPs
- **Cobertura:** 5-10 km² rural/suburbano
- **Fibra estimada:** 150-220 km
- **Puertos NAP:** 8 puertos c/u

### Cuándo usar
✅ Zonas rurales  
✅ Expansiones suburbanas  
✅ Máxima cobertura con CAPEX moderado  
✅ Requiere cálculo óptico cuidadoso  

### Ventajas
- Máxima escala en una sola red
- Buen presupuesto óptico si se calcula bien
- Flexibilidad en expansión (64 NAPs)

### Desventajas
- Presupuesto óptico apretado (~32-35 dB, Clase C+/C++)
- Requiere mediciones ópticas precisas
- Complejidad operativa alta
- Múltiples puntos de falla

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

## Matriz de decisión

| Aspecto | Star (1:16) | Tree (1:32) | Cascade (1:64) |
|---------|-----------|-----------|------------|
| **Zona típica** | Urbano denso | Urbano/periférico | Rural/suburbano |
| **NAPs** | 16 | 32 | 64 |
| **Fibra (km)** | 40-60 | 80-120 | 150-220 |
| **Presupuesto óptico** | B+ (~28dB) | C+ (~32dB) | C+/C++ (~35dB) |
| **Redundancia** | Baja | Media | Alta |
| **Mantenimiento** | Simple | Medio | Complejo |
| **Costo OLT** | Bajo | Bajo | Bajo |
| **Costo Splitters** | ~1 equipo | ~5 equipos | ~7 equipos |
| **CAPEX por NAP** | Alto | Medio | Bajo |

---

## Notas técnicas

### Clase óptica recomendada por topología

**Star (1:16)**: B+ (13-28 dB)
- Margen: holgado
- Valores conservadores suficientes

**Tree (1:32)**: C+ (17-32 dB)
- Margen: modesto
- Validar upstream + downstream

**Cascade (1:64)**: C+/C++ (20-35 dB)
- Margen: apretado
- **Obligatorio:** cálculo óptico preciso, OTDR en campo

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

## Criterio de migración

Si empiezas con Star y necesitas crecer a Tree:

1. Mantienes OLT existente
2. Divides el Splitter 1:16 en una cascada 1:4 → 1:4
3. Migas algunas NAPs existentes a nuevos splitters
4. Agregas fibra nueva (relativamente poco)

→ Se recomienda planificar desde el inicio cuál será la topología final.
