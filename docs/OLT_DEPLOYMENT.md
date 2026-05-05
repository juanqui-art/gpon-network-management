# OLT Deployment Guide — Infraestructura, Seguridad, Monitoreo y Roadmap

## 1. COSTOS Y TCO (Total Cost of Ownership)

### 1.1 Precio de Equipamiento en Ecuador (2024-2025)

| Modelo | Capex Inicial | Capacidad | Notas |
|--------|---------------|-----------|-------|
| **Huawei MA5800-X7** | $4,000 - $6,500 | 16 PON | Dominante en Ecuador, buena disponibilidad de repuestos |
| **Huawei MA5801-FL16** | $5,500 - $8,000 | 16 PON | Diseñado para rural, clase C++ estándar |
| **ZTE C320** | $3,000 - $5,000 | 16 PON | 20-30% más barato que Huawei, menos soporte local |
| **ZTE Titan C600** | $8,000 - $12,000 | 32 PON | Moderno, con NetConf/YANG |
| **Nokia 7360** | $12,000 - $20,000 | Modular (16+) | Para operadores tier-1, muy robusto |
| **Mikrotik CCR1016** | $800 - $2,000 | 1-4 (SFP) | BNG, no OLT completa |

**Costos adicionales (por equipo):**

| Componente | Costo Unitario | Cantidad | Subtotal |
|-----------|----------------|----------|----------|
| SFP Clase B+ | $400 - $600 | 16 | $6,400 - $9,600 |
| SFP Clase C+ | $600 - $900 | 16 | $9,600 - $14,400 |
| Tarjeta Uplink (GE) | $1,500 - $3,000 | 1 | $1,500 - $3,000 |
| Fuente redundante | $2,000 - $4,000 | 2 | $4,000 - $8,000 |
| **TOTAL CAPEX (Huawei MA5800 con clase C+)** | — | — | **$24,500 - $40,000** |

---

### 1.2 Costos Operativos Anuales (OpEx)

| Línea de Costo | Cantidad | Unitario | Anual |
|---|---|---|---|
| **Energía** | 150W continuo × 8760h | $0.09 kWh | $120 |
| **Refrigeración (A/C)** | 12,000 BTU × 24h | $0.09 kWh | $1,200 |
| **Soporte/Mantenimiento** | 1 contrato anual | Huawei: $1,500-3,000 | $2,000 |
| **Reemplazo de SFPs** | 1-2 SFPs cada 2 años | $600 | $300-600 |
| **Capacitación técnica** | 1 semana cada 2 años | $2,000 | $1,000 |

---

### 1.3 TCO Comparativo a 5 Años (300 Clientes)

```
HUAWEI MA5800-X7 (Clase C+):
  Capex:             $32,000
  OpEx (5 años):     $2,000 × 5 = $10,000
  Soporte (5 años):  $2,500 × 5 = $12,500
  TCO Total:         $54,500
  Costo/cliente:     $182 por cliente en 5 años

ZTE C320 (Clase C+):
  Capex:             $24,000
  OpEx (5 años):     $1,800 × 5 = $9,000
  Soporte (5 años):  $1,500 × 5 = $7,500
  TCO Total:         $40,500
  Costo/cliente:     $135 por cliente en 5 años
  Ahorro vs Huawei:  27% ($47 por cliente)

NOKIA 7360:
  Capex:             $55,000 (mejor escala para >500 clientes)
  OpEx (5 años):     $2,500 × 5 = $12,500
  Soporte (5 años):  $3,500 × 5 = $17,500
  TCO Total:         $85,000
  Costo/cliente:     $283 por cliente en 5 años
  Nota: Justificable para operadores grandes
```

**Conclusión:** Para 300 clientes, **ZTE C320 ofrece mejor TCO**. Huawei es viable si necesitas excelente soporte local.

---

## 2. INFRAESTRUCTURA FÍSICA

### 2.1 Sala Técnica: Especificaciones Críticas

#### 2.1.1 Climatización

**Requisito:** Mantener temperatura 18-22°C en todo momento.

| Parámetro | Especificación |
|-----------|---|
| Temperatura operativa | 18-22°C (rango estrecho) |
| Humedad relativa | 40-60% |
| Gradiente de temperatura | < 5°C/m (evitar cold/hot aisles) |
| Sistema de aire acondicionado | 12,000 BTU mínimo |
| Tipo de A/C | De precisión (industrial), no doméstico |
| Ubicación A/C | Puerta posterior de rack (hot aisle) |

**Motivo:** El calor excesivo acorta la vida útil de:
- Láseres en SFP (reducen power ~0.3%/°C)
- Componentes electrónicos (doblamiento de la tasa de falla cada 10°C)

#### 2.1.2 Rack 19" y Espaciamiento

```
Profundidad mínima: 600 mm (para cables y ventilación)
Altura: 42U estándar (OLT = 3-4U)
Distribución:
  ├─ U1-U3: OLT Huawei/ZTE/Nokia
  ├─ U4: Tarjeta Uplink + Management
  ├─ U5-U6: VACÍO (flujo de aire)
  ├─ U7-U10: Router/Switch de gestión
  ├─ U11-U15: UPS (batería)
  └─ U16-U42: Espacio para crecimiento / Patch panels

Separación vertical:
  - Mínimo 1U vacío entre equipos activos
  - Permite circulación de aire (convección)
```

#### 2.1.3 UPS (Uninterruptible Power Supply)

**Especificación mínima:**

| Parámetro | Valor |
|-----------|-------|
| Capacidad | 3,000 VA (soportar OLT + router + A/C) |
| Tipo | Doble conversión (Online) |
| Batería | Litio (SmartLi) preferible a plomo-ácido |
| Autonomía | 4-6 horas (para graceful shutdown) |
| Redundancia | Dual (activo-activo con paralelización) |

**Cálculo de capacidad:**

```
Consumo OLT:           600 W
Consumo Router/Switch: 200 W
Consumo A/C (pico):    1,500 W
Total:                 2,300 W

UPS recomendado: 2,300 W × 1.5 (factor seguridad) = 3,450 VA
→ Comprar 5,000 VA (oversizing para baterías)
```

---

### 2.2 Conectividad Uplink

#### 2.2.1 Interfaz Uplink

**Opciones por ancho de banda:**

| Ancho de Banda | Interfaz | Distancia | Costo |
|---|---|---|---|
| < 3 Gbps | GE (Ethernet RJ45) | 100 m | $500 |
| 3-10 Gbps | 10GbE SFP+ (fibra) | 10-100 km | $3,000 |
| > 10 Gbps | 40GbE QSFP+ | 10-100 km | $10,000+ |

**Recomendación para Ecuador:**
- ISPs pequeños: **GE (1 Gbps)** — suficiente para 100-200 clientes
- ISPs medianos: **10GbE (10 Gbps)** — soporta 500+ clientes
- ISPs grandes: **Dual 10GbE redundante**

#### 2.2.2 Redundancia de Uplink

**Arquitectura simple (mínimo):**
```
OLT ──── Router Principal ──── Internet
  └─── Router Secundario ──┘ (failover manual)
```

**Arquitectura robusta (recomendada):**
```
OLT ──┬─── Router-A ──┬─── Enlace 1
      └─── Router-B ──┴─── Enlace 2 (ISP diferente)
      
LACP (Link Aggregation): Se distribuye tráfico entre ambos enlaces.
Failover automático si uno cae.
```

---

### 2.3 Ubicación Física

**Sitios recomendados en Ecuador:**

| Ubicación | Ventajas | Desventajas |
|---|---|---|
| **Central Telefónica** | Buena infraestructura, energía redundante | Espacio limitado, coordinación lenta |
| **Data Center Local** | Aire acondicionado, UPS, seguridad | Costo, dependencia de tercero |
| **Nodo GPON Propio** | Control total, expansión fácil | Gastos de infraestructura |
| **Armario de Fibra** | Bajo costo, espacio mínimo | Sin aire acondicionado, riesgo sobrecalentamiento |

**Mejor opción para startups:** Data center local (evita gastos iniciales de infraestructura).

---

## 3. SEGURIDAD DEL SISTEMA

### 3.1 Control de Acceso (Roles)

**Definir roles con principio de menor privilegio:**

| Rol | Acceso | Responsabilidad | Técnico Ejemplo |
|---|---|---|---|
| **Admin** | Configuración total, crear usuarios | Cambios críticos, gestión de equipo | Ingeniero Senior |
| **Operator** | Provisión ONT, diagnóstico, restart | Tareas diarias, troubleshooting | Técnico de planta externa |
| **Viewer** | Solo lectura, monitoreo | Reportes, alertas | Soporte técnico, contratista |
| **Auditor** | Acceso a logs, sin cambios | Cumplimiento normativo, auditoría | Compliance officer |

### 3.2 Autenticación

**Opción 1: Local (simple pero inseguro)**
```bash
# En OLT Huawei
aaa local-user admin password <strong-password>
aaa local-user admin privilege level 15
```

**Opción 2: RADIUS Centralizado (recomendado)**
```bash
# En OLT Huawei
radius-server host 192.168.1.100 key <shared-secret>
aaa authentication login radius local
```

**Beneficio:** Centralizar credenciales, auditar en un lugar.

### 3.3 Protección SNMP

**SNMPv2c (INSEGURO):**
```bash
snmp-server community public ro  # ¡NO usar en producción!
```

**SNMPv3 (SEGURO):**
```bash
# Crear usuario con autenticación + encriptación
snmp-server user admin authNoPriv md5 password123
snmp-server user admin authPriv des privkey456

# ACL para limitar acceso
snmp-server access-control ip 192.168.1.0 255.255.255.0
```

### 3.4 Protección Física

- **Acceso a sala:** Llave + badge electrónico con logs
- **Cableado de poder:** Bajo llave en PDU
- **Cableado de red:** Etiquetado, no exponer puertos críticos
- **Consola serial:** Protegida contra acceso físico
- **Ubicación:** Lejos de áreas de tránsito público

---

## 4. MONITOREO Y KPIs (INDICADORES CLAVE)

### 4.1 Métricas Principales por Puerto PON

#### 4.1.1 Potencia Óptica RX/TX

```
Rango Normal (Downstream a ONT):
  TX desde OLT: +2 a +6 dBm ✓
  RX en ONT: -8 a -27 dBm ✓

Alertas:
  RX > -5 dBm ← Saturación del receptor (rebajar TX)
  RX < -28 dBm ← Insuficiente (limpiar conectores)
  Degradación > 1 dB/semana ← Indicador de falla inminente
```

#### 4.1.2 Bit Error Rate (BER)

```
Excelente: < 1e-9 (1 error por 1,000 millones de bits)
Bueno:     1e-9 a 1e-7
Alerta:    1e-7 a 1e-5 (requiere investigación)
Crítico:   > 1e-5 (desconectar puerto, investigar)

Causa típica de BER alto:
  - Connectors sucios (common en Ecuador)
  - Fibra dañada o tensada
  - Splitter defectuoso
```

#### 4.1.3 Frame Loss (Pérdida de Tramas)

```
Esperado: 0.000% (tolerancia cero en líneas críticas)

Si Frame Loss > 0.001%:
  1. Ver si es downstream o upstream
  2. Si upstream: ONT mal sincronizada
  3. Si downstream: puerto PON congestionado
```

#### 4.1.4 ONTs Online / Offline

```
Métrica: Tendencia de cantidad de ONTs conectadas por puerto

Normal: ±1-2 ONTs/día (clientes agregando/removiendo)
Anormal: Pérdida súbita de 5+ ONTs/hora
  → Investigar: corte de fibra, splitter defectuoso, falla OLT
```

---

### 4.2 Herramientas de Monitoreo Disponibles

#### 4.2.1 Stack Open Source (Recomendado para startups)

```
Zabbix (recolección SNMP)
    ↓
Prometheus (almacenamiento time-series)
    ↓
Grafana (visualización)

Costo: $0 (open source)
Tiempo setup: 2-3 semanas
Mantenimiento: 1 técnico
```

**Ejemplo Zabbix: Recolectar potencia RX cada 5 minutos**

```
1. Crear Host "OLT-Huawei-001" (IP: 10.11.104.2)
2. Importar template SNMP de Huawei
3. Crear item: "pon0/0 RX Power" (OID: 1.3.6.1.4.1.2011...)
4. Crear trigger: Alert si RX < -26 dBm
5. Crear acción: Enviar email a ops@isp.com
```

#### 4.2.2 Zabbix: Setup Básico

```bash
# 1. Instalar Zabbix Server (Ubuntu)
sudo apt-get install zabbix-server-mysql zabbix-frontend-php

# 2. Configurar SNMP community en Zabbix
# Configuration → Hosts → OLT-Huawei-001 → SNMP community: "public"

# 3. Crear custom dashboard
# Monitoring → Dashboards → Create Dashboard
#   - Widget: "pon0/0 RX Power" (gráfico histórico)
#   - Widget: "ONT Count" (número de ONTs conectadas)
#   - Widget: "BER Trend" (valores últimas 24h)
```

#### 4.2.3 Grafana: Dashboards Visuales

**Dashboard "OLT Health Overview":**

```
┌─────────────────────────────────────────┐
│ OLT Huawei MA5800-X7 - Status Dashboard │
├─────────────────────────────────────────┤
│                                         │
│  Port 0/0         Port 0/1              │
│  ┌─────────────┐  ┌─────────────┐      │
│  │ RX: -20 dBm│  │ RX: -24 dBm │      │
│  │ ONTs: 28/32│  │ ONTs: 31/32 │      │
│  │ BER: <1e-9 │  │ BER: 2e-8   │ ⚠️   │
│  │ Status: ✓  │  │ Status: ✓   │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  Temperatura: 38°C  UPS: OK  Fan: OK   │
│                                         │
│  Alertas activas: 1 (Port 0/1 BER high)│
└─────────────────────────────────────────┘
```

---

### 4.3 Alertas Críticas (SLA Driven)

| Alerta | Umbral | Severidad | Acción |
|---|---|---|---|
| RX Power bajo | < -26 dBm | CRÍTICA | Escalada inmediata |
| BER alto | > 1e-6 | MAYOR | Investigar en 1 hora |
| ONT desconectada | > 5 min offline | MENOR | Monitorear tendencia |
| Temperatura sala | > 28°C | CRÍTICA | Revisar A/C inmediato |
| UPS en batería | > 5 min | MAYOR | Preparar parada controlada |
| Pérdida uplink | Downtime > 1 min | CRÍTICA | Failover automático |

---

## 5. ROADMAP TECNOLÓGICO (2026-2030)

### 5.1 Evolución de Velocidades PON

```
2025: GPON dominante (2.5 / 1.25 Gbps)
      └─ Sigue siendo viable para mayoría de Ecuador

2026-2027: Adopción XGS-PON (10 Gbps simétrico)
      └─ Operadores premium (Quito, Guayaquil)
      └─ Casos: Empresas, streaming 8K, teletrabajo avanzado

2028-2030: Coexistencia GPON + XGS-PON
      └─ Mismo hilo de fibra (diferentes λ)
      └─ Migración gradual sin retirar ODN

2030+: 50G-PON (para backhaul 5G)
      └─ Baja latencia, ultra-alta capacidad
      └─ No para último km residencial (en Ecuador)
```

### 5.2 Coexistencia GPON + XGS-PON

**Cómo funciona:**

```
OLT (Huawei/ZTE):
├─ Puerto PON 0/0 (GPON)     → λ 1310/1490 nm
├─ Puerto PON 0/1 (XGS-PON)  → λ 1270/1577 nm
└─ WDM combinator en splitter
   └─ Permite mismo hilo de fibra para ambas tecnologías

Beneficio:
  - No necesita nueva fibra feeder
  - Migración gradual (cliente por cliente)
  - Reutiliza infraestructura existente
```

### 5.3 Planes de Fabricantes

**Huawei:**
- MA5900 (2026): Próxima generación, mejor integración XGS-PON
- Enfoque cloud-native (gestión centralizada vía iMaster NCE)

**ZTE:**
- Titan C600 (disponible ahora): Soporta NetConf/YANG
- Roadmap XGS-PON nativo (2027)

**Nokia:**
- 7380 (2026-2027): Mejorado con IA para diagnóstico automático
- Focus en automatización, reducir OPEX

### 5.4 Implicaciones para Ecuador

| Aspecto | 2025 | 2028 | 2030+ |
|---|---|---|---|
| Clase óptica dominante | B+, C+ | C+, C++ | C++, C+++ (coex) |
| Velocidad max ofrecible | 2.5 Gbps | 10 Gbps | 10-50 Gbps |
| Infraestructura ODN | Nueva fibra | Reutilizable | Reutilizable |
| Soporte OLT (Huawei) | Excelente | Excelente | Migración a cloud |
| Costo SFP | Estable | Bajando | Muy bajo |

---

## 6. DECISIÓN DE COMPRA: MATRIZ DE SELECCIÓN

```
¿Cuántos clientes esperas en 5 años?

< 200 clientes           200-500 clientes      > 500 clientes
    ↓                         ↓                       ↓
  ZTE C320          Huawei MA5800-X7          Nokia 7360
  ($24k)                ($32k)                  ($55k)
  Razón:            Razón:                   Razón:
  - Bajo TCO        - Equilibrio             - Máxima escala
  - Mantenimiento   - Buen soporte           - Robustez
    simple            local                   extrema
  - Menos OPEX      - Disponibilidad SFP     - Multi-servicio
```

---

## 7. CHECKLIST PRE-DEPLOYMENT

### Antes de Instalar OLT

- [ ] Sala técnica lista (A/C funcionando, temperatura 18-22°C)
- [ ] Rack 42U en lugar, niveado, asegurado
- [ ] UPS 3000VA+ probado, baterías cargadas
- [ ] Uplink preparado (fibra o GE según ancho de banda)
- [ ] Cableado de poder: PDU con fusibles por circuito
- [ ] Cableado de gestión: vlan separada para OLT (VLAN 1000)
- [ ] Servidor SNMP/Zabbix en funcionamiento
- [ ] Equipo: IP de gestión, usuario/password registrado
- [ ] Fibra feeder: limpia, testeada con OTDR
- [ ] Splitters: validados y etiquetados

### Después de Instalar OLT

- [ ] OLT boot correctamente, firmware v17+ (Huawei)
- [ ] Interfaces PON UP (status activo)
- [ ] Descubrimiento automático de ONTs activo
- [ ] SNMP responde correctamente (snmpget test)
- [ ] Dashboard Zabbix/Grafana muestra métricas
- [ ] Alertas configuradas en NMS
- [ ] Test con 3 ONTs reales (potencia RX normal)
- [ ] Documentación: diagrama de cableado, credenciales
- [ ] Backup de configuración inicial
- [ ] Capacitación: operador conoce CLI básico

---

## 8. MÉTRICAS DE ÉXITO OPERATIVO

| Métrica | Target | Tolerable | Crítico |
|---|---|---|---|
| Disponibilidad OLT | 99.9% | 99.5% | < 99% |
| Disponibilidad uplink | 99.95% | 99.9% | < 99% |
| Latencia promedio | < 30 ms | < 50 ms | > 100 ms |
| Packet loss | < 0.01% | < 0.1% | > 0.5% |
| BER promedio | < 1e-9 | < 1e-7 | > 1e-5 |
| Tiempo respuesta soporte | 4h | 8h | > 24h |

---

**Próximo paso:** Implementar monitoreo con SNMP + Zabbix + Grafana para visibilidad operativa en tiempo real.

