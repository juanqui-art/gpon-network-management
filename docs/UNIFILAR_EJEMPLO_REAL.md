# Diagrama Unifilar — Ejemplo Real GPON Ecuador

## Escenario: Barrio urbano 3 km (Quito Sur)

### DIAGRAMA UNIFILAR SIMPLIFICADO

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  NIVEL 0: CABECERA (Central Office)                                        │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                             │
│         ┌──────────────────────┐                                           │
│         │   OLT HUAWEI         │                                           │
│         │  MA5800-X7           │                                           │
│         │  Clase: B+           │                                           │
│         │  Puertos: 16 PON     │                                           │
│         │  Puerto #01 activo   │                                           │
│         └──────────┬───────────┘                                           │
│                    │                                                        │
│                    │ Potencia TX: +3.0 dBm                                 │
│                    │ Sensibilidad RX: -28 dBm                             │
│                    │                                                        │
└────────────────────┼────────────────────────────────────────────────────────┘
                     │
                     │ FIBRA FEEDER G.652D
                     │ Distancia: 3 km (ADSS aéreo)
                     │ Pérdida: 3000m × 0.30 dB/km × 1.02 = 0.92 dB
                     │
┌────────────────────┼────────────────────────────────────────────────────────┐
│                    ▼                                                        │
│  NIVEL 1: DISTRIBUCIÓN PRIMARIA                                            │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                             │
│         ┌──────────────────────────┐                                       │
│         │  SPLITTER PRIMARIO       │                                       │
│         │  Ratio: 1:16             │                                       │
│         │  Modelo: PLC 1x16        │                                       │
│         │  Pérdida: 13.8 dB        │                                       │
│         │  16 salidas ópticas      │                                       │
│         └──┬─┬─┬─┬─┬─┬─┬─┬─┬─┬────┘                                       │
│            │ │ │ │ │ │ │ │ │ │                                            │
└────────────┼─┼─┼─┼─┼─┼─┼─┼─┼─┼────────────────────────────────────────────┘
             │ │ │ │ │ │ │ │ │ │
   ┌─────────┘ │ │ │ │ │ │ │ │ └─────────┐
   │ ┌─────────┘ │ │ │ │ │ │ └───┐       │
   │ │ ┌─────────┘ │ │ │ │ └─────┼─┐     │
   │ │ │ ┌─────────┘ │ │ └───────┼─┼─┐   │
   │ │ │ │ ┌─────────┘ └─────────┼─┼─┼─┐ │
   │ │ │ │ │                     │ │ │ │ │
   │ │ │ │ │                     │ │ │ │ │
   ▼ ▼ ▼ ▼ ▼                     ▼ ▼ ▼ ▼ ▼

  FIBRA DISTRIBUTION (Cada rama: ~600m, 300m a 1.2km según NAP)
  Pérdida por rama: 600m × 0.30 dB/km × 1.02 = 0.18 dB

┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ NAP-UIO-Z05-01 │  │ NAP-UIO-Z05-02 │  │ NAP-UIO-Z05-03 │  │ ... NAP-16    │
│  (Caja IP65) │  │  (Caja IP65) │  │  (Caja IP65) │  │ (Caja IP65) │
│ 8 puertos    │  │ 8 puertos    │  │ 8 puertos    │  │ 8 puertos   │
│              │  │              │  │              │  │             │
│  NIVEL 2:    │  │  NIVEL 2:    │  │  NIVEL 2:    │  │ NIVEL 2:    │
│  Splitter    │  │  Splitter    │  │  Splitter    │  │ Splitter    │
│  Interno 1:8 │  │  Interno 1:8 │  │  Interno 1:8 │  │ Interno 1:8 │
│  Pérdida:    │  │  Pérdida:    │  │  Pérdida:    │  │ Pérdida:    │
│  10.5 dB     │  │  10.5 dB     │  │  10.5 dB     │  │ 10.5 dB     │
│              │  │              │  │              │  │             │
│  ┌─┬─┬─┬─┬───┤  │  ┌─┬─┬─┬─┬───┤  │  ┌─┬─┬─┬─┬───┤  │ ┌─┬─┬─┬─┬───┤
│  │ │ │ │ │   │  │  │ │ │ │ │   │  │  │ │ │ │ │   │  │ │ │ │ │ │   │
└──┼─┼─┼─┼─┼───┘  └──┼─┼─┼─┼─┼───┘  └──┼─┼─┼─┼─┼───┘  └─┼─┼─┼─┼─┼───┘
   │ │ │ │ │         │ │ │ │ │         │ │ │ │ │       │ │ │ │ │
   │ │ │ │ │         │ │ │ │ │         │ │ │ │ │       │ │ │ │ │
   ▼ ▼ ▼ ▼ ▼         ▼ ▼ ▼ ▼ ▼         ▼ ▼ ▼ ▼ ▼       ▼ ▼ ▼ ▼ ▼

  FIBRA DROP G.657A1 (Cada hilo: 150-250m, típico 180m)
  Pérdida por drop: 180m × 0.22 dB/km × 1.02 = 0.04 dB

  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ ONT-001 │  │ ONT-002 │  │ ONT-003 │  │ ONT-004 │  │ ONT-005 │  │ ONT-006 │
  │ CLIENTE │  │ CLIENTE │  │ CLIENTE │  │ CLIENTE │  │ CLIENTE │  │ CLIENTE │
  │ (NAP-01 │  │ (NAP-01 │  │ (NAP-01 │  │ (NAP-02 │  │ (NAP-02 │  │ (NAP-02 │
  │  puerto1)  │  puerto2)  │  puerto3)  │  puerto1)  │  puerto2)  │  puerto3)
  │ RX: -20dBm │ RX: -21dBm │ RX: -19dBm │ RX: -22dBm │ RX: -20dBm │ RX: -23dBm
  │ OK ✅      │ OK ✅      │ OK ✅      │ OK ✅      │ OK ✅      │ OK ✅
  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘
```

---

## Cuadro de Pérdidas por Nivel

```
┌──────────────────────────────────────────────────────────────────┐
│ RUTA: OLT → NAP-UIO-Z05-01 → ONT-001                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ NIVEL 0→1: OLT a Splitter Primario                             │
│ ─────────────────────────────────────────────────────────────  │
│   Señal OLT TX:                    +3.0 dBm                    │
│   Fibra feeder (3 km):             -0.92 dB                    │
│   Conector OLT salida:             -0.5 dB                     │
│   Conector Splitter entrada:       -0.5 dB                     │
│   ────────────────────────────────────────                     │
│   Subtotal antes Splitter 1:16:    +0.58 dBm                   │
│                                                                 │
│ NIVEL 1: Splitter Primario 1:16                                │
│ ─────────────────────────────────────────────────────────────  │
│   Pérdida Splitter 1:16:           -13.8 dB  ← CRÍTICO         │
│   ────────────────────────────────────────                     │
│   Potencia en rama #1:             -13.22 dBm                  │
│                                                                 │
│ NIVEL 1→2: Splitter Primario a NAP                             │
│ ─────────────────────────────────────────────────────────────  │
│   Fibra distribution (600m):       -0.18 dB                    │
│   Conectores (2):                  -1.0 dB                     │
│   ────────────────────────────────────────                     │
│   Potencia en entrada NAP:          -14.4 dBm                  │
│                                                                 │
│ NIVEL 2: Splitter Interno NAP 1:8                              │
│ ─────────────────────────────────────────────────────────────  │
│   Pérdida Splitter 1:8:            -10.5 dB  ← CRÍTICO         │
│   ────────────────────────────────────────                     │
│   Potencia en puerto NAP:           -24.9 dBm                  │
│                                                                 │
│ NIVEL 2→3: NAP a ONT (drop)                                    │
│ ─────────────────────────────────────────────────────────────  │
│   Fibra drop (180m):               -0.04 dB                    │
│   Conectores (2):                  -1.0 dB                     │
│   ────────────────────────────────────────                     │
│                                                                 │
│ POTENCIA FINAL EN ONT:             -25.94 dBm                  │
│                                                                 │
├──────────────────────────────────────────────────────────────────┤
│ ANÁLISIS:                                                        │
│ ────────────────────────────────────────────────────────────    │
│   Sensibilidad OLT B+:             -28 dBm                     │
│   Potencia recibida ONT:           -25.94 dBm                  │
│   MARGEN RESULTANTE:               +2.06 dB  ⚠️ AMARILLO       │
│                                                                  │
│   ⚠️ MARGINAL: Funciona, pero vulnerable a:                     │
│      - Conector sucio (+1 dB pérdida) → ROJO                   │
│      - Reparación con empalme (+0.5 dB) → ROJO                 │
│      - Envejecimiento de fibra → ROJO                          │
│                                                                  │
│   ✅ SOLUCIÓN: Usar Clase C+ (sensibilidad -30 dBm)            │
│      → Margen sería +4.06 dB (VERDE)                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Cascada COMPLETA de Splitters

```
OLT
│
├─ Nivel 0: Equipo activo (OLT)
│
├─ SPLIT #1: Splitter Principal 1:16 (Distribución)
│  Pérdida: 13.8 dB
│  ├─ Rama 1 → NAP-01
│  ├─ Rama 2 → NAP-02
│  ├─ Rama 3 → NAP-03
│  └─ Rama 16 → NAP-16
│
└─ Nivel 1 (16 NAPs)
   │
   ├─ NAP-01
   │  ├─ SPLIT #2: Splitter Interno 1:8
   │  │ Pérdida: 10.5 dB
   │  │ ├─ Puerto 1 → DROP → ONT-001
   │  │ ├─ Puerto 2 → DROP → ONT-002
   │  │ ├─ Puerto 3 → DROP → ONT-003
   │  │ └─ Puerto 8 → DROP → ONT-008
   │  │
   │  └─ Nivel 2 (8 ONTs)
   │
   ├─ NAP-02
   │  ├─ SPLIT #3: Splitter Interno 1:8
   │  │ ├─ Puerto 1 → DROP → ONT-009
   │  │ ├─ Puerto 2 → DROP → ONT-010
   │  │ └─ Puerto 8 → DROP → ONT-016
   │  │
   │  └─ Nivel 2 (8 ONTs)
   │
   └─ NAP-16
      ├─ SPLIT #17: Splitter Interno 1:8
      │ ├─ Puerto 1 → DROP → ONT-121
      │ └─ Puerto 8 → DROP → ONT-128
      │
      └─ Nivel 2 (8 ONTs)

TOTAL CASCADA:
  Nivel 1 (Primario): 1 Splitter 1:16
  Nivel 2 (NAPs):   16 Splitters 1:8
  ────────────────────────────────
  CASCADA TOTAL: 1:16 × 1:8 = 1:128 teórico
  CAPACIDAD REAL: ~120-130 ONTs (considerando margen)
```

---

## Tabla: Qué es CADA ELEMENTO

| Elemento | Tipo | Pérdida | Ubicación | Función |
|----------|------|---------|-----------|---------|
| **OLT** | Activo | - | Central Office | Genera y recibe señales ópticas |
| **Fibra Feeder** | Pasivo | 0.30 dB/km | Aéreo/subterráneo | Transporta señal a nivel primario |
| **Splitter 1:16** | Pasivo | 13.8 dB | Caja FDH | **Divide 1 rama en 16 ramas** |
| **Fibra Distribution** | Pasivo | 0.30 dB/km | Aéreo | Transporta señal a NAPs |
| **NAP (Caja exterior)** | **Pasivo + Activo** | - | En campo | **Contiene Splitter 1:8 + 8 puertos** |
| **Splitter 1:8 (interno NAP)** | Pasivo | 10.5 dB | Dentro NAP | **Divide rama NAP en 8 puertos** |
| **Fibra Drop** | Pasivo | 0.22 dB/km | Aéreo/fachada | Conecta NAP a ONT cliente |
| **ONT** | Activo | - | Casa cliente | Recibe/envía datos |

---

## Resumen: Niveles de Splitting

```
SPLITTING CASCADA:

Nivel 1 (Primario):     1 Splitter 1:16 = 16 ramas
                        ↓
Nivel 2 (NAPs):         16 cajas con Splitter 1:8 = 16 × 8 = 128 puertos
                        ↓
Nivel 3 (Clientes):     ~120-130 ONTs efectivos (con margen)

PÉRDIDA ACUMULADA:
  Splitter Primario (1:16):      13.8 dB
  + Splitter NAP (1:8):          10.5 dB
  ──────────────────────────
  TOTAL PÉRDIDA SPLITTERS:        24.3 dB
  
  + Fibra (3 km feeder + 600m dist + 180m drop): ~0.92 + 0.18 + 0.04 = 1.14 dB
  + Conectores y empalmes:       ~2.5 dB
  + Margen seguridad:            3.0 dB
  ──────────────────────────
  PÉRDIDA TOTAL RUTA:            ~30.9 dB
  
  ⚠️ LÍMITE: Clase C+ (32 dB máx) → Margen: +1.1 dB (AMARILLO)
  ✅ MEJOR: Clase C++ (35 dB máx) → Margen: +4.1 dB (VERDE)
```

Esta es la realidad de una red típica ecuatoriana: **dos cascadas de splitters** (primario + NAP interno), no uno solo.
