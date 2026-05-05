# OLT Integration Guide — APIs, Protocolos y Automatización para Desarrolladores

## 1. DISPONIBILIDAD DE APIs POR FABRICANTE

### 1.1 Situación Actual (2025)

Las OLTs tradicionales **NO ofrecen API REST pública nativa**. El acceso está intermediado por soluciones propietarias:

| Fabricante | API REST Nativa | Alternative | Madurez | Documentación |
|-----------|-----------------|-------------|---------|---------------|
| **Huawei** | No | iMaster NCE | Alta | Limitada (requiere NDA) |
| **ZTE** | Parcial | NetConf/YANG (Titan C600+) | Media | Incompleta |
| **Nokia** | No | Telnet/SSH CLI | Alta | Estándar industria |
| **Mikrotik** | Sí (REST API) | SSH API, REST API | Muy Alta | Excelente (open source) |

---

### 1.2 SNMP: La Opción Universal

**SNMP (Simple Network Management Protocol)** es el estándar de facto para monitoreo en **todas las OLTs**, incluso sin API REST.

| Versión | Cifrado | Autenticación | Recomendación |
|---------|---------|---------------|---------------|
| **SNMPv1** | ❌ No | Comunidad (texto) | ❌ NO usar en producción |
| **SNMPv2c** | ❌ No | Comunidad (texto) | ⚠️ Solo red privada |
| **SNMPv3** | ✅ Sí (AES) | Usuario/contraseña | ✅ RECOMENDADO |

---

## 2. PROTOCOLOS DE ACCESO DISPONIBLES

### 2.1 SNMP (Monitoreo)

**Capacidad:** Lectura (monitoreo), sin cambios de configuración.

**Ejemplo con Huawei MA5800:**

```bash
# Ver potencia RX de ONT en puerto 0/0, índice 1
snmpget -v3 -u admin -a SHA -A "password123" \
  -x AES -X "privpass456" \
  -l authPriv 10.11.104.2 \
  1.3.6.1.4.1.2011.6.150.2.66.3.1.1.1.1.2

# Traducción:
# -v3: SNMP versión 3 (encriptado)
# -u admin: usuario
# -a SHA: autenticación SHA
# -x AES: encriptación AES
# -l authPriv: nivel máximo de seguridad
# 1.3.6.1... : OID de Huawei para "potencia RX de ONT"
```

**MIBs Comunes por Fabricante:**

```
HUAWEI MA5800:
  Potencia RX ONT: 1.3.6.1.4.1.2011.6.150.2.66.3.1.1.1.1.23
  Estado ONT: 1.3.6.1.4.1.2011.6.150.2.66.3.1.1.1.1.21
  BER: 1.3.6.1.4.1.2011.6.150.2.66.3.1.1.1.1.50

ZTE C320:
  Potencia RX ONT: 1.3.6.1.4.1.3902.1089.1.1.1.1.1.1.40
  Estado ONT: 1.3.6.1.4.1.3902.1089.1.1.1.1.1.1.35
  Frame Loss: 1.3.6.1.4.1.3902.1089.1.1.1.1.1.1.45

NOKIA 7360:
  Usa MIB estándar IETF (más compatible)
  Potencia: 1.3.6.1.2.1.25.3.2.1.4
```

---

### 2.2 SSH / CLI (Configuración y Troubleshooting)

**Capacidad:** Lectura y escritura (ejecución de comandos).

**Ventajas:**
- Acceso completo a configuración
- Scripts pueden cambiar parámetros
- Disponible en todas las OLTs

**Desventajas:**
- Frágil (parsing de texto)
- Lento (latencia >500ms típico)
- Requiere Expect/SSH libraries

**Ejemplo con Node.js (Next.js backend):**

```javascript
const { exec } = require('ssh2');
const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  conn.exec('show ont info summary 0 0', (err, stream) => {
    if (err) throw err;
    
    let output = '';
    stream.on('close', (code, signal) => {
      // Parsear output para extraer ONTs
      const onts = output.split('\n')
        .filter(line => line.includes('active'))
        .map(line => {
          const [index, status, ...rest] = line.split(/\s+/);
          return { index, status };
        });
      
      console.log('ONTs conectadas:', onts);
      conn.end();
    });
    
    stream.on('data', (data) => {
      output += data.toString();
    });
  });
});

conn.connect({
  host: '10.11.104.2',
  port: 22,
  username: 'root',
  password: 'admin123'
});
```

---

### 2.3 NetConf / YANG (Configuración Estructurada)

**Disponibilidad:** ZTE Titan C600+, Nokia 7360 (parcialmente)

**Capacidad:** Cambios de configuración usando esquemas estructurados.

**Ventajas:**
- Sintaxis estructurada (JSON/XML)
- Válido y robusto
- Estándar IETF

**Desventajas:**
- Documentación incompleta en Ecuador
- Curva de aprendizaje alta
- Latencia media-alta

**Ejemplo YANG para ZTE (conceptual):**

```xml
<config>
  <gpon-port>
    <port-id>0/0/0</port-id>
    <optical-class>C++</optical-class>
    <tx-power>3</tx-power>
    <distance>20000</distance>
  </gpon-port>
</config>
```

---

### 2.4 TR-069 (Gestión de CPEs Remotos)

**Capacidad:** Gestionar dispositivos ONT/cliente remotamente.

**Caso de Uso:** Cambiar configuración de WiFi, reiniciar ONT, recolectar parámetros sin ir a cliente.

**Implementación:**
- OLT actúa como servidor CWMP (CPE WAN Management Protocol)
- ONTs se conectan periódicamente
- Comandos se envían de forma asincrónica

**Limitación:** Requiere que ONTs soporten TR-069 (más common en empresas que residencial).

---

## 3. COMPARATIVA DE VIABILIDAD TÉCNICA

| Protocolo | Complejidad | Tiempo Integración | Seguridad | Fiabilidad | Mejor Para |
|-----------|-------------|-------------------|-----------|-----------|-----------|
| **SNMP v3** | Baja | 2-3 semanas | ✅ Alta | ✅ Alta | Monitoreo en tiempo real |
| **SSH CLI** | Media-Alta | 3-5 semanas | ⚠️ Media | ⚠️ Media | Automatización de cambios |
| **NetConf** | Alta | 8-10 semanas | ✅ Alta | ✅ Alta | Aprovisionamiento masivo |
| **TR-069** | Media | 6-8 semanas | ✅ Alta | ⚠️ Media | Gestión de ONTs cliente |

---

## 4. INTEGRACIÓN CON NEXT.JS + SUPABASE

### 4.1 Arquitectura Recomendada

```
Next.js Frontend (Mapbox)
    ↓
Next.js API Route (/api/olt/status)
    ↓
Worker Process (Node.js, SNMP/SSH)
    ↓
Supabase (PostgreSQL) ← datos en tiempo real
    ↓
Realtime Subscriptions (websockets a frontend)
```

**Por qué esta arquitectura:**
1. **No exponer credenciales OLT al cliente** (seguridad)
2. **SNMP lento** (>500ms) → almacenar en BD, servir desde caché
3. **Realtime** → Supabase Realtime notifica cambios a UI

### 4.2 Schema de Base de Datos

```sql
-- Tabla de OLTs
CREATE TABLE olt_devices (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  ip_address INET NOT NULL,
  manufacturer TEXT, -- 'huawei', 'zte', 'nokia'
  model TEXT,
  snmp_community TEXT, -- cifrado
  snmp_version TEXT DEFAULT 'v3',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de puertos PON
CREATE TABLE olt_pon_ports (
  id UUID PRIMARY KEY,
  olt_id UUID REFERENCES olt_devices(id),
  port_number INTEGER, -- 0/0, 0/1, etc.
  optical_class TEXT, -- 'B+', 'C+', 'C++'
  distance_km INTEGER,
  tx_power_dbm FLOAT,
  status TEXT, -- 'active', 'inactive'
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de métricas en tiempo real
CREATE TABLE olt_metrics (
  id BIGSERIAL PRIMARY KEY,
  pon_port_id UUID REFERENCES olt_pon_ports(id),
  timestamp TIMESTAMP DEFAULT NOW(),
  rx_power_dbm FLOAT,
  tx_power_dbm FLOAT,
  ber FLOAT,
  ont_count INTEGER,
  frame_loss FLOAT,
  
  -- Crear índice para Realtime
  CONSTRAINT metrics_time_unique UNIQUE (pon_port_id, timestamp)
);

-- Tabla de ONTs
CREATE TABLE olt_onts (
  id UUID PRIMARY KEY,
  pon_port_id UUID REFERENCES olt_pon_ports(id),
  ont_index INTEGER,
  serial_number TEXT,
  status TEXT, -- 'online', 'offline'
  rx_power_dbm FLOAT,
  customer_id UUID, -- relación con cliente
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 4.3 API Route de Next.js para Leer SNMP

**File: `apps/web/app/api/olt/[id]/metrics/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import * as snmp from 'snmp-native';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const oltId = params.id;
  
  // 1. Obtener credenciales OLT desde BD
  const supabase = createServerClient();
  const { data: olt } = await supabase
    .from('olt_devices')
    .select('ip_address, snmp_community')
    .eq('id', oltId)
    .single();
  
  if (!olt) {
    return NextResponse.json({ error: 'OLT not found' }, { status: 404 });
  }
  
  // 2. Consultar SNMP (libería snmp-native)
  const session = new snmp.Session({
    host: olt.ip_address,
    community: olt.snmp_community,
    version: 3,
  });
  
  const metrics = [];
  
  // OID para potencia RX (Huawei)
  const OID_RX_POWER = '1.3.6.1.4.1.2011.6.150.2.66.3.1.1.1.1.23';
  
  session.getSubtree({ oid: OID_RX_POWER }, (error, varbinds) => {
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Parsear resultados
    varbinds.forEach((vb) => {
      const [value] = vb.value;
      metrics.push({
        rx_power_dbm: value / 100, // Convertir (Huawei usa centésimas de dB)
      });
    });
    
    // 3. Guardar en Supabase
    supabase
      .from('olt_metrics')
      .insert(metrics);
    
    return NextResponse.json({ metrics });
  });
}
```

---

### 4.4 Worker de Polling Periódico

**File: `apps/web/lib/workers/snmp-collector.ts`**

```typescript
import cron from 'node-cron';
import * as snmp from 'snmp-native';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! // Service role (backend only)
);

// Ejecutar cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  console.log('Running SNMP collector...');
  
  // Obtener todas las OLTs activas
  const { data: olts } = await supabase
    .from('olt_devices')
    .select('id, ip_address, snmp_community, manufacturer')
    .eq('status', 'active');
  
  for (const olt of olts || []) {
    try {
      // Llamar API interna para recolectar métricas
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/olt/${olt.id}/metrics`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
          },
        }
      );
      
      const { metrics } = await response.json();
      console.log(`OLT ${olt.id}: ${metrics.length} métricas recolectadas`);
    } catch (error) {
      console.error(`Error collecting from OLT ${olt.id}:`, error);
    }
  }
});
```

---

### 4.5 Realtime Subscriptions en Frontend

**File: `apps/web/components/OltDashboard.tsx`**

```typescript
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function OltDashboard({ oltId }: { oltId: string }) {
  const [metrics, setMetrics] = useState([]);
  const supabase = createClientComponentClient();
  
  useEffect(() => {
    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('olt_metrics')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'olt_metrics',
          filter: `pon_port_id=eq.${oltId}`,
        },
        (payload) => {
          console.log('New metric:', payload.new);
          setMetrics(prev => [...prev, payload.new]);
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [oltId, supabase]);
  
  return (
    <div>
      <h2>OLT {oltId} - Métricas en Tiempo Real</h2>
      {metrics.map((m) => (
        <div key={m.id}>
          RX Power: {m.rx_power_dbm} dBm | 
          ONTs: {m.ont_count} | 
          BER: {m.ber}
        </div>
      ))}
    </div>
  );
}
```

---

## 5. SEGURIDAD

### 5.1 Protección de Credenciales

**❌ MAL:**
```typescript
const olt = {
  ip: '10.11.104.2',
  user: 'root',
  password: 'admin123', // ¡¡Hardcoded!!
};
```

**✅ BIEN:**
```typescript
// .env.local (servidor solamente)
SNMP_COMMUNITY_ENCRYPTED=<valor_cifrado_en_supabase>
HUAWEI_SSH_KEY=<ssh_key_privada_en_secrets>

// En código
const snmpCommunity = decrypt(process.env.SNMP_COMMUNITY_ENCRYPTED!);
```

### 5.2 Encriptación en Tránsito

**SNMP v3 con AES + SHA:**

```typescript
const session = new snmp.Session({
  host: '10.11.104.2',
  version: 3,
  user: 'admin',
  authProtocol: 'sha', // Autenticación
  authKey: 'password123',
  privProtocol: 'aes', // Cifrado
  privKey: 'privpass456',
});
```

### 5.3 VPN Obligatoria

La OLT NUNCA debe ser accesible directamente desde internet.

```
Arquitectura correcta:
Navegador (cliente)
    ↓ HTTPS (internet)
Next.js (servidor en VPN)
    ↓ SSH/SNMP (VPN privada)
OLT (red de gestión protegida)
```

---

## 6. CASOS DE USO PRÁCTICOS DE INTEGRACIÓN

### 6.1 Leer Potencia RX de Todas las ONTs

**Objetivo:** Dashboard que muestre trending de potencia en tiempo real.

```typescript
// API Route: /api/olt/[id]/onts/power
export async function GET(request, { params }) {
  const { data: onts } = await supabase
    .from('olt_onts')
    .select('*, olt_metrics(rx_power_dbm, timestamp)')
    .eq('pon_port_id', params.id)
    .order('timestamp', { 
      foreignTable: 'olt_metrics', 
      ascending: false 
    });
  
  return NextResponse.json(onts);
}
```

### 6.2 Crear Alerta Automática (Potencia Baja)

**Objetivo:** Enviar email cuando RX < -26 dBm.

```typescript
// Edge Function: /api/olt/alerts
export async function POST(request) {
  const { ont_id, rx_power_dbm } = await request.json();
  
  const THRESHOLD = -26; // dBm
  
  if (rx_power_dbm < THRESHOLD) {
    // Enviar notificación
    await supabase
      .from('olt_alerts')
      .insert({
        ont_id,
        alert_type: 'LOW_RX_POWER',
        severity: 'CRITICAL',
        message: `RX Power ${rx_power_dbm} dBm (< ${THRESHOLD} dBm)`,
        created_at: new Date(),
      });
    
    // Email
    await sendEmail({
      to: 'ops@isp.com',
      subject: 'OLT Alert: Low RX Power',
      body: `ONT ${ont_id} está operando con baja potencia`,
    });
  }
}
```

### 6.3 Cambiar Configuración sin Parar Servicio

**Objetivo:** Aumentar potencia TX de un puerto PON.

**Nota:** Requiere SSH scripting (SNMP no permite escritura profunda).

```typescript
// API Route: /api/olt/[id]/ports/[port]/tx-power (POST)
export async function POST(request, { params }) {
  const { tx_power_new } = await request.json();
  
  // Validar rango
  if (tx_power_new < 0 || tx_power_new > 6) {
    return NextResponse.json({ error: 'Invalid TX power' }, { status: 400 });
  }
  
  // Conectar SSH a OLT
  const conn = new Client();
  
  const commands = [
    `interface gpon ${params.port}`,
    `tx-power ${tx_power_new}`,
    'save'
  ];
  
  for (const cmd of commands) {
    await executeSSH(conn, cmd);
  }
  
  // Log cambio
  await supabase
    .from('olt_audit_log')
    .insert({
      olt_id: params.id,
      action: 'CHANGE_TX_POWER',
      details: { port: params.port, new_value: tx_power_new },
      user_id: request.user?.id,
      timestamp: new Date(),
    });
  
  return NextResponse.json({ success: true });
}
```

---

## 7. EJEMPLO COMPLETO: DASHBOARD CON MAPBOX + REALTIME

**Arquitectura:**
1. Mapbox muestra ubicación de OLTs
2. Al clickear OLT → modal con métricas
3. Métricas se actualizan via Supabase Realtime

```typescript
// components/MapWithOltStatus.tsx
import Map from 'react-map-gl';
import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function MapWithOltStatus() {
  const [olts, setOlts] = useState([]);
  const supabase = createClientComponentClient();
  
  useEffect(() => {
    // Cargar OLTs iniciales
    supabase
      .from('olt_devices')
      .select('id, name, latitude, longitude, status')
      .then(({ data }) => setOlts(data || []));
    
    // Suscribirse a cambios
    const channel = supabase
      .channel('olt_status_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'olt_metrics' },
        (payload) => {
          // Actualizar estado de OLT en mapa
          setOlts(prev => prev.map(olt => ({
            ...olt,
            lastMetric: payload.new,
          })));
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);
  
  return (
    <Map initialViewState={{ longitude: -78.5, latitude: -0.2, zoom: 10 }}>
      {olts.map(olt => (
        <Marker
          key={olt.id}
          longitude={olt.longitude}
          latitude={olt.latitude}
          color={olt.lastMetric?.rx_power_dbm < -25 ? 'red' : 'green'}
          onClick={() => {
            // Mostrar modal de métricas
          }}
        >
          {olt.name}
        </Marker>
      ))}
    </Map>
  );
}
```

---

## 8. CHECKLIST DE SEGURIDAD ANTES DE PRODUCCIÓN

- [ ] Credenciales OLT en variables de entorno cifradas
- [ ] SNMP v3 con autenticación + encriptación
- [ ] VPN o túnel SSH entre servidor y red de gestión OLT
- [ ] Logs de auditoría (quién accedió, qué cambió)
- [ ] Firewall: puerto SNMP (161) permitido solo desde servidor
- [ ] SSL/TLS en API Next.js (HTTPS obligatorio)
- [ ] Rate limiting en endpoints de OLT (evitar DoS)
- [ ] Validación de entrada (no permitir inyección de comandos)
- [ ] Backup automático de configuración OLT
- [ ] Monitoreo de intentos de acceso fallidos

