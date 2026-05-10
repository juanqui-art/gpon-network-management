# Monitoreo en Tiempo Real — Investigación y Diseño

**Fecha:** 2026-05-10
**Estado:** Investigación completada, pendiente implementación
**Complementa:** `OLT_INTEGRATION_GUIDE.md` (visión general por fabricante)
**Enfoque:** Decisiones técnicas verificadas para el módulo de monitoreo en tiempo real

---

## 1. Visión general del sistema

```
┌──────────┐   SNMP poll   ┌─────────┐   HTTPS   ┌──────────┐  Realtime  ┌──────────┐
│   OLT    │  ──────────►  │   RPi   │  ──────►  │ Supabase │  ────────► │ Mapa UI  │
│ Huawei   │   UDP 161     │colector │   TCP 443 │  Postgres│  WebSocket │ Next.js  │
│ MA5800   │   cada 60s    │ Node.js │   JSON    │ + Realtime│  WS push   │ Mapbox   │
└──────────┘               └─────────┘           └──────────┘            └──────────┘
```

### Componentes
- **OLT Huawei** — equipo del ISP, expone SNMP en puerto UDP 161
- **Raspberry Pi (colector)** — corre Node.js cada 60s, lee del OLT y escribe a Supabase
- **Supabase** — almacena estado actual + historial, transmite cambios por WebSocket
- **UI Next.js** — recibe cambios en tiempo real y actualiza el mapa

### Decisión arquitectónica clave
**Polling SNMP cada 60s + WebSocket de Supabase al browser** — combina la disponibilidad universal de SNMP con la inmediatez de los WebSockets para el usuario final, sin tener que escribir un servidor WebSocket propio.

---

## 2. OIDs de Huawei verificados

Todos los OIDs siguientes fueron verificados contra documentación de Huawei y proyectos comunitarios. Aplican a familia **MA5600T / MA5603T / MA5608T / MA5800**.

### 2.1 Estado de ONT

| Métrica | OID | Valores |
|---|---|---|
| Status | `1.3.6.1.4.1.2011.6.128.1.1.2.62.1.22` | 1=Online, 2=Offline |
| Última desconexión (causa) | `1.3.6.1.4.1.2011.6.128.1.1.2.46.1.24` | Códigos: LOS, LOF, power-off, etc. |

### 2.2 Potencia óptica

| Métrica | OID | Conversión |
|---|---|---|
| RX Power (ONT lo recibe) | `1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4` | `dBm = INTEGER / 100` |
| TX Power (OLT lo recibe) | `1.3.6.1.4.1.2011.6.128.1.1.2.51.1.6` | `dBm = INTEGER / 100` |
| Temperatura ONT | `1.3.6.1.4.1.2011.6.128.1.1.2.51.1.1` | Celsius directo |

### 2.3 Distancia y posición

| Métrica | OID | Unidad |
|---|---|---|
| Distancia ONT al OLT | `1.3.6.1.4.1.2011.6.128.1.1.2.46.1.20` | metros |

### 2.4 Sistema OLT

| Métrica | OID | Notas |
|---|---|---|
| CPU OLT % | `1.3.6.1.4.1.2011.2.6.7.1.1.2.1.5` | hwSlotCpuRatio |
| Temperatura board | `1.3.6.1.4.1.2011.2.6.7.1.1.2.1.10` | hwMusaBoardTemperature |
| Uptime sistema | `1.3.6.1.2.1.1.3` | MIB-II estándar |

---

## 3. Conversión de potencia óptica — fórmula confirmada

```
dBm_real = SNMP_integer / 100
```

### Ejemplos verificados

| SNMP devuelve | Cálculo | dBm real | Estado |
|---|---|---|---|
| -301 | -301/100 | -3.01 dBm | Excelente (cerca del OLT) |
| -1311 | -1311/100 | -13.11 dBm | Bueno |
| -2410 | -2410/100 | -24.10 dBm | Bajo |
| -2700 | -2700/100 | -27.00 dBm | Crítico |

### Umbrales operativos para semáforo del mapa

| Color | Rango RX (dBm) | Significado |
|---|---|---|
| 🟢 verde | > -24 | señal buena |
| 🟡 amarillo | -24 a -27 | señal degradada |
| 🔴 rojo | < -27 | crítica, requerir intervención |
| ⚫ gris | (offline) | sin conexión |

### Importante — dos árboles distintos
- **GPON** (`1.3.6.1.4.1.2011.6.128.1.1.2.51.x`) — usar `INTEGER / 100`
- **DDM** (`1.3.6.1.4.1.2011.5.14.6.4.1`) — usar `INTEGER × 0.000001` (NO usar — es para módulos SFP del OLT, no ONTs)

---

## 4. Encoding del índice de ONT en SNMP

Cuando se hace WALK sobre un OID base, Huawei retorna las hojas con índices compuestos:

```
Estructura del OID retornado:
   <OID_base>.<olt_port>.<ont_id> = <valor>

Ejemplo real:
   1.3.6.1.4.1.2011.6.128.1.1.2.51.1.4.4194312192.0 = -1311
   ───────────────────────────────────  ─────────  ─  ─────
              OID base                  olt_port  ont rx_power
                                                  id   crudo
```

### Formato de `olt_port`
- Es un entero codificado que representa Frame/Slot/Port físico
- Ejemplos: port 1 = `4194304000`, port 2 = `4194304256` (+256 entre ports)
- Slot 2 port 1 = `4194312192`
- **No hay que calcularlo manualmente** — el WALK lo retorna ya formado

### Formato de `ont_id`
- Entero 0-127 (máximo de ONTs por puerto PON GPON)

### Estrategia de parsing
```
1. Hacer subtreeWalk sobre el OID base (ej: rx_power)
2. Por cada hoja retornada, extraer las dos últimas partes del OID
3. Componer un identificador único:  `${olt_port}.${ont_id}`
4. Usar ese identificador como `ont_logical_id` en la BD
```

---

## 5. Librería Node.js — net-snmp

### Información del paquete
- **Nombre:** `net-snmp`
- **Versión actual:** 3.26.3 (publicada hace ~16 días al 2026-05-10)
- **Mantenedor:** [markabrahams/node-net-snmp](https://github.com/markabrahams/node-net-snmp)
- **Estado:** activamente mantenido
- **Licencia:** MIT
- **Dependencias nativas:** ninguna (puro JavaScript)
- **Compatibilidad RPi:** ✅ probado

### APIs relevantes para nuestro caso

#### `session.tableColumns(oid, columns, [maxRepetitions], callback)`
WALK eficiente que solo trae las columnas especificadas. **Recomendado para nuestro colector.**

```javascript
const oid = "1.3.6.1.4.1.2011.6.128.1.1.2";  // base Huawei
const columns = [
  62,  // status
  51,  // optical info (rx_power)
  46   // distance
];

session.tableColumns(oid, columns, maxRepetitions, (error, table) => {
  if (error) return console.error(error);
  // table = {
  //   "4194312192.0": { 62: 1, 51: -1311, 46: 850 },
  //   "4194312192.1": { 62: 2, 51: null, 46: null },  // offline
  // }
});
```

#### `session.subtree(oid, feedCb, doneCb)`
WALK completo de un subárbol. Útil para descubrir todas las ONTs disponibles inicialmente.

#### Ventaja de `tableColumns` vs `table`
"Many times faster than table()" según el README oficial — porque trae solo los datos que necesitas en lugar de todo el subárbol.

---

## 6. Supabase Realtime

### 6.1 Límites del servicio (al 2026-05)

| Tier | Conexiones WS | Mensajes/s | Canales/conexión |
|---|---|---|---|
| Free | 200 | 100 | 100 |
| Pro ($25/mes) | 500 | 500 | 100 |

### Cálculo para nuestro caso (ISP con 128 ONTs)
- Mensajes en pico (todas las ONTs cambian a la vez): ~128/min ≈ 2/s
- Mensajes promedio: ~0.5/s
- **Free tier es suficiente** para el primer ISP
- Pasar a Pro cuando haya múltiples ISPs o muchos usuarios concurrentes

### 6.2 Habilitación de Realtime en tablas nuevas

Las tablas no entran en Realtime automáticamente. Hay que agregarlas a la **publication** de Postgres que Supabase escucha:

```sql
-- Va dentro de la migración 021:
ALTER PUBLICATION supabase_realtime ADD TABLE public.ont_current_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ont_signal_history;
```

### 6.3 RLS y Realtime — interacción crítica

> Realtime respeta RLS — si el usuario no puede `SELECT` la fila, **NO recibirá el evento**.

Esto significa que las políticas RLS deben permitir lectura a los usuarios que verán el mapa. Si hay multi-tenant en el futuro, las políticas deben filtrar por `network_id` o `organization_id`.

### 6.4 Garantía de entrega — NO hay

Supabase explícitamente **NO garantiza entrega de mensajes**. Es un servicio "best effort". Implicaciones:

- Una caída de red puede hacer perder eventos
- Hay que sincronizar el estado al reconectar

**Estrategia de recuperación (justifica `ont_current_state`):**

```
WebSocket cae → Supabase reconecta automáticamente
              ↓
       Al reconectar:
       1. Hacer 1 query SELECT * FROM ont_current_state WHERE network_id = X
       2. Repintar todo el mapa con ese resultado
       3. Continuar escuchando eventos nuevos
```

### 6.5 Reconexión recomendada (basada en blog post de la comunidad)

```
Estrategia híbrida agresiva:
  - Primeros 3 intentos:  delay de 1 segundo
  - Intentos 4 al 10:     delay de 3 segundos
  - Después de 10 fallos: error fatal → notificar al usuario
```

---

## 7. Diseño de las tablas de monitoreo

### 7.1 `ont_current_state` — estado vivo

**Propósito:** 1 fila por ONT, siempre actualizada. Esta es la tabla que el mapa consulta.

**Tamaño:** No crece. Si hay 128 ONTs, hay 128 filas siempre.

**Campos clave:**
- `id` UUID PK
- `network_id` UUID FK → networks
- `ont_serial` text — número de serie Huawei (ej: HWTC12345678)
- `ont_logical_id` text — composición `<olt_port>.<ont_id>` para mapear contra SNMP
- `olt_host` text — IP del OLT origen
- `pon_port` text — F/S/P legible (ej: "0/2/1")
- `rx_power_dbm` numeric — última lectura
- `tx_power_dbm` numeric — última lectura
- `status` text — online | offline | los | lof
- `distance_m` integer — distancia al OLT
- `last_seen_at` timestamptz — última vez que respondió
- `updated_at` timestamptz — actualizado en cada poll

**Operación principal:** UPSERT por `(network_id, ont_logical_id)` cada 60s.

### 7.2 `ont_signal_history` — historial inteligente

**Propósito:** registros solo cuando vale la pena guardar (no en cada poll).

**Crece:** sí, pero controlado por la lógica del colector.

**Triggers para guardar:**

| Trigger | Cuándo se dispara |
|---|---|
| `change` | El status cambió (online ↔ offline ↔ los) |
| `degradation` | rx_power varió más de 2 dBm |
| `sample` | Han pasado 15 min desde el último registro |

**Estimación de volumen** (128 ONTs):
- 4 muestras/hora × 24h × 128 = ~12,300 registros/día
- + ~50 eventos de cambio/día estimados
- ≈ **60 MB/mes** (vs 1 GB sin estrategia)

**Ahorro vs guardar todo:** ~94%.

### 7.3 Retención automática

Estrategia recomendada (implementar después con `pg_cron` en Supabase Pro):

| Edad del dato | Acción |
|---|---|
| < 30 días | Detalle completo |
| 30 días – 12 meses | Solo conservar `trigger='change'` y `trigger='degradation'`, eliminar `'sample'` |
| > 12 meses | Eliminar |

---

## 8. Lógica del colector Node.js

### 8.1 Estructura del proyecto (en RPi)

```
gpon-collector/
├── .env                     ← credenciales OLT + Supabase (llenar en sitio)
├── package.json
├── src/
│   ├── index.js             ← entrada principal: arranca scheduler
│   ├── collector/
│   │   ├── snmp.js          ← envuelve net-snmp.tableColumns
│   │   └── parser/
│   │       └── huawei.js    ← convierte índices y unidades
│   ├── processor/
│   │   └── decide.js        ← lógica "¿guardar este dato?"
│   ├── storage/
│   │   └── supabase.js      ← UPSERT + INSERT a tablas
│   └── scheduler.js         ← orquesta el ciclo cada 60s
└── systemd/
    └── gpon-collector.service  ← arranque automático en RPi
```

### 8.2 Flujo de un ciclo de poll

```
1. snmp.js
   ├── Conecta UDP 161 al OLT (sesión SNMP v2c o v3)
   └── tableColumns(OID base, [columns rx, status, distance])
       Retorna: { "<olt_port>.<ont_id>": { 51: -1311, 62: 1, 46: 850 }, ... }

2. parser/huawei.js
   ├── Itera sobre los índices retornados
   ├── Para cada ONT:
   │   ├── ont_logical_id = "4194312192.0"
   │   ├── pon_port = decode(4194312192)  → "0/2/1"  (legible)
   │   ├── rx_power_dbm = -1311 / 100 → -13.11
   │   ├── status = (62 == 1) ? "online" : "offline"
   │   └── distance_m = 850
   └── Devuelve array de objetos limpios

3. processor/decide.js
   Para cada ONT, comparar contra el último estado conocido (cache local):
   ├── ¿Cambió status?      → trigger = "change"
   ├── ¿Δrx_power > 2 dBm?  → trigger = "degradation"
   ├── ¿Pasaron 15 min?     → trigger = "sample"
   └── ¿Nada de lo anterior? → trigger = null  (no insertar history)

4. storage/supabase.js
   ├── SIEMPRE: UPSERT ont_current_state (1 query con todas las ONTs)
   └── SI hay trigger: INSERT batch a ont_signal_history

5. scheduler.js
   └── setInterval(ciclo, 60000)
```

### 8.3 Variables de entorno

```bash
# OLT (llenar en sitio del ISP)
OLT_HOST=192.168.100.1
OLT_VENDOR=huawei
OLT_MODEL=MA5800-X7
OLT_SNMP_VERSION=2c          # 2c | 3
OLT_SNMP_COMMUNITY=public    # solo si v2c
OLT_SNMP_USER=               # solo si v3
OLT_SNMP_AUTH_PASS=          # solo si v3
OLT_SNMP_PRIV_PASS=          # solo si v3

# Supabase
SUPABASE_URL=https://ybijrwyenlfemjjueopo.supabase.co
SUPABASE_SERVICE_KEY=        # service role key (NO la anon)

# Configuración del colector
NETWORK_ID=                  # UUID de la red en la tabla networks
POLL_INTERVAL_SECONDS=60
SAMPLE_INTERVAL_MINUTES=15
DEGRADATION_DELTA_DB=2.0
```

---

## 9. Hardware del colector (RPi)

### Recomendado para producción

| Componente | Especificación | USD aprox |
|---|---|---|
| Raspberry Pi 4 Model B | 4 GB RAM | $60-70 |
| MicroSD | 32GB Clase 10 / A1 | $10-12 |
| Fuente USB-C oficial | 5V 3A | $12-15 |
| Cable Ethernet Cat5e | 1-2 m | $3-5 |
| Case con heatsinks | (recomendado en rack) | $8-12 |
| **Total** | | **~$95-115** |

### Para pruebas iniciales
- Tu propia laptop sirve perfectamente
- Mismo código que la RPi
- Solo hay que conectar al switch de gestión del OLT

### Consumo eléctrico
- RPi 4 idle: 3-5 W
- RPi 4 con polling SNMP cada 60s: 5-7 W
- Costo eléctrico mensual: ~$0.50/mes (vs $8-15/mes de una laptop encendida 24/7)

---

## 10. Datos pendientes de obtener del ISP

Antes de codificar el colector definitivo, necesitamos del dueño del ISP:

### Críticos
- [ ] Marca y modelo exacto del OLT (MA5800-X7 / MA5608T / etc.)
- [ ] IP de gestión del OLT
- [ ] Versión SNMP habilitada (v2c o v3)
- [ ] Si v2c: community string
- [ ] Si v3: usuario, contraseña auth, contraseña priv
- [ ] Cantidad aproximada de ONTs (para dimensionar)

### Útiles
- [ ] Versión de software del OLT (afecta comandos CLI por si necesitamos fallback)
- [ ] ¿Hay otros OLTs en otras centrales? (planning escalabilidad)
- [ ] ¿Existe red VLAN dedicada para gestión?

---

## 11. Mejoras futuras (no MVP)

### 11.1 Dying Gasp Traps
Las ONTs envían un trap SNMP especial al perder alimentación eléctrica antes de apagarse. Más rápido que el poll de 60s.
- Requiere: colector escuche también en UDP 162
- Beneficio: detección instantánea de cortes de luz en zona del cliente
- Complejidad: media (manejo de listener UDP además del poll)

### 11.2 Múltiples OLTs en paralelo
Cuando el ISP tenga >1 OLT o se sumen más ISPs:
- Un colector por OLT (no compartir RPi entre OLTs)
- Cada uno apunta al mismo Supabase con `network_id` distinto
- Realtime ya soporta esto sin cambios

### 11.3 Alertas externas
Cuando una ONT cae:
- Email via Resend (ya en stack Vercel marketplace)
- WhatsApp via Twilio API (futuro)
- Webhook a sistemas de tickets

### 11.4 SNMP v3 obligatorio
Para ISPs con auditoría de seguridad:
- Configurar usuario SNMP v3 con cifrado AES
- Cambiar `OLT_SNMP_VERSION=2c` → `3`
- net-snmp soporta esto sin cambios de código

---

## 12. Fuentes consultadas

### Documentación Huawei
- [SNMP MIB Huawei OLT ONT — gponsolution.com](https://gponsolution.com/snmp-mib-huawei-olt-ont.html)
- [OID and MIB for Huawei OLT and ONU — ixnfo.com](https://ixnfo.com/en/oid-and-mib-for-huawei-olt-and-onu.html)
- [Huawei OLT DDM SNMP OID — ixnfo.com](https://ixnfo.com/en/huawei-olt-ddm-snmp-oid-en.html)
- [Huawei-OLT-ONT-SNMP-MIBs — GitHub](https://github.com/Jeremias0618/Huawei-OLT-ONT-SNMP-MIBs)
- [Huawei OLT SNMP and Telnet commands — drinia.tech](https://itsolution.drinia.tech/2022/12/16/huawei-olt-snmp-and-telnet-commands/)
- [LibreNMS Huawei MIBs](https://github.com/librenms/librenms/blob/master/mibs/huawei/HUAWEI-DEVICE-MIB)

### Librería SNMP Node.js
- [net-snmp en npm](https://www.npmjs.com/package/net-snmp)
- [node-net-snmp README — GitHub](https://github.com/markabrahams/node-net-snmp/blob/master/README.md)

### Supabase Realtime
- [Subscribing to Database Changes — Supabase Docs](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Realtime Limits — Supabase Docs](https://supabase.com/docs/guides/realtime/limits)
- [Realtime Architecture — Supabase Docs](https://supabase.com/docs/guides/realtime/architecture)
- [Realtime Best Practices (BetterLink Blog)](https://eastondev.com/blog/en/posts/dev/supabase-realtime-practice/)

### Proyectos de referencia
- [GPONMonitor — Dasan Networks (ASP.NET Core)](https://github.com/bartekkois/GPONMonitor/wiki)
- [go-snmp-olt-zte-c320 — ZTE en Go](https://github.com/Cepat-Kilat-Teknologi/go-snmp-olt-zte-c320)

### Otros
- [How to Collect SNMP Traps from Dying Gasps — DPSTele](https://www.dpstele.com/blog/how-collect-snmp-trap-dying-gasp-gpon-install.php)
- [How to Monitor Your Huawei Network — Paessler](https://blog.paessler.com/how-to-monitor-your-huawei-network)

---

## 13. Próximos pasos

1. **Obtener acceso al OLT del ISP** — recolectar la información de la sección 10
2. **Migración 021** — crear `ont_current_state` + `ont_signal_history` + habilitar Realtime
3. **Colector Node.js** — implementar `src/collector/snmp.js` + parser Huawei
4. **Probar con laptop conectada al OLT** — validar OIDs reales en sitio
5. **UI Realtime en el mapa** — suscripción al canal `ont-realtime` y actualización de marcadores
6. **Migrar a RPi** — copiar el colector a la RPi y configurar systemd
7. **(Opcional) Dying Gasp** — agregar listener UDP 162 para alertas instantáneas
