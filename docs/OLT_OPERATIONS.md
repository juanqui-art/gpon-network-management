# OLT Operations Guide — Configuración, Troubleshooting y Gestión de Tráfico

## 1. CONFIGURACIÓN POR FABRICANTE

### 1.1 Huawei SmartAX MA5800 / MA5608T

#### Acceso Inicial

| Atributo | Especificación |
|----------|----------------|
| IP Puerto METH (gestión fuera de banda) | 10.11.104.2 / 255.255.255.0 |
| Usuario por defecto | root |
| Password por defecto | admin o admin123 |
| Puerto consola | 9600-8N1 |
| Protocolo | SSH / Telnet |

#### Configuración Básica de Puertos

```bash
# Acceso SSH
ssh root@10.11.104.2

# Confirmar tarjetas de línea instaladas
board confirm 0

# Habilitar descubrimiento automático de ONTs
interface gpon 0/0
  ont-auto-find enable

# Configurar potencia TX (típicamente +3 dBm en Ecuador)
interface gpon 0/0
  tx-power 3

# Configurar clase óptica (C++ para rural)
interface gpon 0/0
  optical-class C++

# Guardar configuración
save

# Ver estado de ONTs en puerto PON 0/0
display ont info summary 0 0
```

#### Configuración de VLANs de Servicio

```bash
vlan 100 name SERVICE-VLAN

interface gpon 0/0
  vlan 100 uniport
  vlan 100 cos 5  # Prioridad de clase de servicio
```

---

### 1.2 ZTE ZXA10 C320 / Titan C600

#### Acceso Inicial

| Atributo | Especificación |
|----------|----------------|
| IP por defecto | 136.1.1.100 |
| Usuario | zte |
| Password usuario | zte |
| Password escalado (enable) | zxr10 |
| Puerto consola | 9600-8N1 |

#### Configuración Básica

```bash
# SSH/Telnet a 136.1.1.100
ssh zte@136.1.1.100

# Escalar privilegios
enable
# Ingresar password: zxr10

# Agregar chasis (si es modular)
add-rack rackno 1 racktype C320RackType
add-shelf rackno 1 shelfno 1 shelftype C320_SHELF

# Verificar tarjetas
show card

# Configurar puerto PON
interface pon 0/0/0
  tx-power 3
  optical-class C++

# Habilitar ONT auto-discovery
interface pon 0/0/0
  ont-auto-find enable

# Guardar configuración
write

# Ver ONTs conectadas
show ont info summary
```

#### Configuración de T-CONT y Perfiles

```bash
# Crear perfil T-CONT para servicio residencial
tcont add 0/0/0 tcont-id 1 type 4

# Crear perfil de ancho de banda (perfil de tráfico)
traffic-policy add 0/0/0 traffic-policy-id 1
  upstream-cir 100000  # 100 Mbps garantizado
  upstream-pir 800000  # 800 Mbps máximo

# Asociar perfil a ONT
ont add 0/0/0 ont-index 1 traffic-policy-id 1
```

---

### 1.3 Nokia ISAM 7360

#### Acceso Inicial

| Atributo | Especificación |
|----------|----------------|
| Usuario | isadmin |
| Password | i$@mad- |
| Nomenclatura de puertos | shelf/slot/port |
| Protocolo | SSH / Telnet |

#### Configuración Básica

```bash
# SSH a Nokia
ssh isadmin@<IP_NOKIA>

# Ver equipamiento instalado
show equipment ont status pon

# Ver ONTs no provisionadas
show pon unprovision-onu

# Monitorear potencia óptica RX/TX
show equipment ont optics

# Ver estado de interfaces
show interface port

# Crear perfil de software para ONT
equipment ont software-profile create profile-name TEST-PROFILE
  version R100.02.00

# Aprovisionar ONT manualmente
pon provisioning add ont 0/1/1 ont-index 1 software-profile TEST-PROFILE

# Guardar cambios
admin save
```

---

### 1.4 Mikrotik en Ecosistema GPON

Mikrotik no produce OLTs de chasis completas, pero juega dos roles:

#### A) Módulo SFP ONU (Router directo a fibra)

```bash
# En router Mikrotik con SFP GPON
/interface ethernet pon
add name=pon-upstream mac-address=02:00:00:00:00:01 pppoe-mru=1492

# Crear VLAN para servicios
/interface vlan
add name=vlan-100 vlan-id=100 interface=pon-upstream

# Asignar IP
/ip address add address=192.168.1.1/24 interface=vlan-100
```

#### B) BNG (Broadband Network Gateway) detrás de OLT

Mikrotik CCR (Cloud Core Router) se coloca detrás de la OLT como concentrador:

```bash
# En CCR detrás de OLT Huawei/ZTE
/interface ethernet bridge
add name=br-main protocol-mode=rstp

/interface bridge port
add interface=ether1 bridge=br-main  # Hacia OLT
add interface=ether2 bridge=br-main  # Hacia Internet

# DHCP para clientes detrás de OLT
/ip pool
add name=pool-clients ranges=10.0.0.2-10.0.0.254

/ip dhcp-server
add name=dhcp-main interface=br-main address-pool=pool-clients
```

---

## 2. DBA (DYNAMIC BANDWIDTH ALLOCATION)

### 2.1 Concepto Fundamental

El DBA es el mecanismo de software que **orquesta cómo se comparte el ancho de banda de subida (upstream)** entre múltiples ONTs conectadas al mismo puerto PON.

**Por qué es necesario:**
- Downstream (1490 nm): Broadcast, OLT envía a todas simultáneamente
- **Upstream (1310 nm): TDMA** — Solo una ONT puede transmitir a la vez
- El DBA evita colisiones asignando "ventanas de tiempo" a cada ONT

### 2.2 Contenedores de Transmisión (T-CONT)

Cada ONT tiene T-CONTs (Transmission Containers) que compiten por ancho de banda. ITU-T G.984 define 5 tipos:

| Tipo | Nombre | Características | Caso de Uso |
|------|--------|-----------------|-------------|
| **1** | Fixed | Ancho de banda constante, siempre garantizado | VoIP, gestión de red |
| **2** | Assured | Mínimo garantizado, puede usar más si hay capacidad | Servicios empresariales |
| **3** | Non-Assured + Assured | Mezcla: mínimo garantizado + best-effort | Triple play residencial |
| **4** | Best-Effort | Sin garantías, usa lo que sobre | Navegación web, descarga |
| **5** | Mixto | Combinación de todos | Servicios complejos |

### 2.3 Ejemplo Práctico de Cálculo DBA

**Escenario:**
- 1 puerto GPON con capacidad upstream real: **1.2 Gbps**
- 64 ONTs conectadas
- ISP vende planes de **100 Mbps simétricos** (T-CONT Tipo 4)

**Análisis:**

```
Teoría (sin sobresuscripción):
  1.2 Gbps / 64 ONTs = 18.75 Mbps por ONT
  Insuficiente para planes de 100 Mbps

Práctica (con sobresuscripción 10:1):
  - Hora baja: 8 ONTs activas simultáneamente
    → Cada una obtiene 1.2 Gbps / 8 = 150 Mbps (excepto su límite de 100 Mbps)
  
  - Hora pico: 20 ONTs activas simultáneamente
    → Cada una obtiene 1.2 Gbps / 20 = 60 Mbps
    → Algunos clientes reportan "internet lento en horario pico"

Solución:
  1. Migrar clientes VIP a T-CONT Tipo 2 (ancho de banda asegurado)
  2. Splitear puerto PON en cascada (reducir ONTs por puerto)
  3. Agregar más puertos PON a la OLT
```

### 2.4 SR-DBA vs NSR-DBA

**Status Reporting DBA (SR-DBA):**
- La ONT **informa explícitamente** a la OLT cuántos datos tiene en cola
- Más preciso y eficiente
- Recomendado para ONTs modernas

**Non-Status Reporting DBA (NSR-DBA):**
- La OLT **monitorea el tráfico entrante**
- Si ve muchos frames inactivos, asume que no necesita ancho de banda
- Menos preciso, útil para ONTs de gama baja

---

## 3. PROTOCOLO DE RANGING (SINCRONIZACIÓN TEMPORAL)

### 3.1 ¿Por Qué Existe el Límite de 20 km?

La luz viaja por fibra a ~200,000 km/s.

**Ejemplo:**
```
ONT a 100 m:     retraso = 0.0005 ms
ONT a 20 km:     retraso = 0.1 ms
Diferencial:     retraso de 20 km

ITU-T G.984 especifica que el máximo retraso diferencial 
permitido es ~100 ms, equivalente a ~20 km.

Si tienes ONT a 100 m y otra a 25 km:
- Diferencial = 24.9 km (excede límite)
- La "ventana de silencio" de la OLT para ranging no es lo suficientemente amplia
- Las ráfagas colisionan → errores masivos → desconexión
```

### 3.2 Configuración del Rango de Distancia

**En Huawei:**
```bash
interface gpon 0/0
  distance 20000  # 20 km en metros
```

**En ZTE:**
```bash
interface pon 0/0/0
  distance 20000
```

**En Nokia:**
```bash
equipment pon ranging-time-out 1000
```

### 3.3 Diagnóstico de Fallas de Ranging

**Síntomas:**
- ONT no sincroniza
- LED de ONT parpadea lentamente (estado O1 o O3)
- En OLT aparece como "offline"

**Diagnóstico paso a paso:**

```
1. VERIFICAR POTENCIA ÓPTICA
   - RX debe estar entre -8 dBm y -27 dBm
   - Si es -30 dBm: ONT no puede leer BWMap de la OLT
   - Solución: Limpiar conectores, revisar fibra

2. VERIFICAR DISTANCIA CONFIGURADA
   Huawei: display interface gpon 0/0 | grep distance
   ZTE:    show pon 0/0/0 | grep distance
   
   Si ONT está físicamente a 22 km pero puerto está en 20 km: FALLO

3. DETECTAR "ROGUE ONU"
   Una ONT defectuosa que transmite continuamente (no en ráfagas)
   ciega al receptor de la OLT
   
   Solución: Desactivar puerto, limpiar o reemplazar ONT problemática

4. MEDIR CON OTDR (Optical Time Domain Reflectometer)
   - Buscar reflexiones anómalas
   - Identificar distancia a falla
   - Verificar pérdida de inserción en splitters
```

**Comando para ver delay de cada ONT:**

```bash
# Huawei
display ont info detail 0/0 <ont-index>

# ZTE
show ont delay 0/0/0

# Nokia
show equipment ont status pon
```

---

## 4. TROUBLESHOOTING: TOP 5 PROBLEMAS EN ECUADOR

### Problema #1: ONT No Sincroniza (Estado O1-O3 Persistente)

**Síntomas:**
- LED de PON parpadea lentamente
- En OLT aparece como offline
- Cliente sin internet

**Diagnóstico:**

```bash
# 1. Verificar potencia óptica con medidor
Esperado: -8 a -27 dBm
Si < -28 dBm: señal insuficiente

# 2. Verificar en OLT
Huawei: display ont info summary 0 0

# 3. Usar OTDR para verificar fibra
- Buscar macro-curvaturas
- Verificar empalmes
- Medir distancia a ONT
```

**Soluciones (en orden):**

1. **Limpiar conectores** (Lo más probable en Ecuador)
   - Usar alcohol isopropílico al 99.9%
   - Paño sin pelusa
   - Repetir 3-5 veces hasta ver cambio en potencia

2. **Revisar fibra con OTDR**
   - Si hay reflexión anómala: fibra cortada
   - Si atenuación es alta: fibra tensada o degradada
   - Solución: Fusionar o reemplazar tramo

3. **Verificar distance en puerto PON**
   ```bash
   Huawei: interface gpon 0/0; distance 20000
   ZTE:    interface pon 0/0/0; distance 20000
   ```

4. **Detectar y remover rogue ONT**
   - Desactivar puerto PON
   - Esperar 30 segundos
   - Reactivar
   - Si el resto de ONTs sincroniza: ONT defectuosa aislada

---

### Problema #2: Latencia Alta en Ráfagas (Upstream Jitter)

**Síntomas:**
- Usuarios reportan lag en Zoom, gaming, llamadas VoIP
- Ping OK pero video pixelado
- Velocidad de descarga normal

**Causa Probable:**
La longitud de onda de **1310 nm (upstream)** está severamente atenuada mientras que 1490 nm (downstream) está OK.

**Diagnóstico:**

```bash
# 1. Verificar potencia TX de ONT (debe estar >-3 dBm upstream)
# En OLT, comando específico por fabricante:
Huawei: display ont optic info 0/0 <ont-index>
ZTE:    show ont optical-info 0/0/0 <ont-index>

# 2. Medir con medidor óptico en fibra del cliente
- Poner medidor en 1310 nm si tiene función
- Comparar con 1490 nm
- Si diferencia > 3 dB: problema upstream

# 3. Ver BER en OLT
# Si BER > 1e-6 en upstream: degradación severa
```

**Soluciones:**

1. **Limpiar conectores** (especialista en campo)
   - Especialmente en ONT del cliente

2. **Revisar fibra con OTDR**
   - Buscar zonas con atenuación específica a 1310 nm
   - Posible causa: fibra tensada, empalme defectuoso

3. **Considerar cambio de fibra**
   - Si fibra es G.652D vieja: degradación por UV
   - Reemplazar tramo con G.657A1 (más resistente)

4. **Aumentar clase óptica si es B+**
   - Cambiar SFP a C+ para mayor margen
   - Aumentar potencia TX en OLT (+0.5 dBm)

---

### Problema #3: "Clientes Lentos" Intermitentes

**Síntomas:**
- Velocidad cae drasticamente en horas pico (18:00-21:00)
- Vuelve a la normalidad después
- Afecta a múltiples clientes en mismo puerto PON

**Causa Probable:**
Saturación del puerto PON o mala configuración del DBA.

**Diagnóstico:**

```bash
# 1. Ver utilización del puerto PON
Huawei: display statistics pon-port 0/0
ZTE:    show statistics pon 0/0/0

# 2. Ver estad de T-CONT (descartes, colisiones)
Huawei: display tcont info 0/0

# 3. Contar ONTs conectadas en hora pico
# Si puerto está saturado: > 64 ONTs es límite práctico
```

**Soluciones (en orden):**

1. **Balanceo de carga**
   - Mover algunos clientes a puerto PON menos saturado
   - Requiere reconfiguración de ONT

2. **Migrar clientes VIP a T-CONT asegurado**
   - Cambiar de T-CONT Tipo 4 (best-effort) a Tipo 2
   - Garantiza ancho de banda mínimo

3. **Agregar nuevo puerto PON**
   - Dividir 32 ONTs en dos puertos (16 cada uno)
   - Requiere nueva fibra feeder

---

### Problema #4: Reflectancia Alta (ORL - Optical Return Loss)

**Síntomas:**
- SFPs de la OLT se queman frecuentemente
- Todos los clientes en ese puerto PON experimentan BER alto
- En mediciones: valor de ORL muy alto (< -14 dBm indica reflexión)

**Causa Probable:**
Conector dañado o fibra cortada cerca de la OLT reflejando luz de regreso al transmisor.

**Diagnóstico:**

```bash
# 1. Medir ORL con medidor de potencia especializado
# Medidor debe soportar ORL (Optical Return Loss)
# Normal: ORL < -20 dB
# Crítico: ORL > -14 dB

# 2. Usar OTDR
# Buscar picos de reflexión agudos en los primeros 100 m
# Indica conector rayado o fibra cortada
```

**Soluciones:**

1. **Verificar conector OLT**
   - Si es SC/UPC: cambiar a SC/APC (ángulo 8°, refleja menos)
   - Limpiar conector: alcohol isopropílico

2. **Inspeccionar fibra cerca de OLT**
   - Buscar daño mecánico, dobleces
   - Si está cortada: fusionar o reemplazar

3. **Reemplazar SFP**
   - Si ORL persiste después de limpiar: SFP está dañado
   - Costo: $300-500 USD

---

### Problema #5: Degradación Progresiva por Humedad

**Síntomas:**
- Potencia óptica de **todo un sector** cae varios dB
- Especialmente después de temporada de lluvias (Costa ecuatoriana)
- Clientes reportan "internet lento" sin corte

**Causa Probable:**
Agua penetra en cierres de empalme, causando **hidrólisis** (reacción química que daña sílice).

**Diagnóstico:**

```bash
# 1. Medir potencia de múltiples ONTs en sector
# Si todas muestran degradación -2 a -5 dB: problema sistémico

# 2. Usar OTDR
# Buscar zonas con atenuación creciente (especialmente en empalmes)
# Zonas mojadas mostrarán atenuación anormalmente alta

# 3. Inspeccionar cajas de empalme en sector
# Buscar agua o condensación
```

**Soluciones:**

1. **Secado de fibras** (si el daño es leve)
   - Usar máquinas de secado (costo: $2000+ USD)
   - Requiere equipo especializado

2. **Reemplazo de tramo** (si es severo)
   - Reemplazar cable afectado
   - Usar cable con **barrera seca** (gel protector)
   - Costo: $30-50 por km instalado

3. **Mejora de sellado**
   - Mejorar cajas de empalme: sealantes de calidad
   - Instalar respiraderos desecantes
   - Mantenimiento semestral en época lluviosa

---

## 5. CHECKLIST DE OPERACIÓN DIARIA

- [ ] Revisar potencia RX/TX de puertos PON principales (cada 4 horas)
- [ ] Monitorear temperatura de sala técnica (debe estar 18-22°C)
- [ ] Verificar estado de fuentes de la OLT (amperaje, voltaje)
- [ ] Contar ONTs online vs. offline (detectar anomalías)
- [ ] Revisar BER de puertos PON (> 1e-6 = acción requerida)
- [ ] Inspeccionar rack por sobrecalentamiento o ruidos extraños
- [ ] Hacer backup de configuración (semanal)
- [ ] Revisar logs de alarmas en NMS (diario)

