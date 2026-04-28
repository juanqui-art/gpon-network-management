# 📡 GPON Network Management & Interactive Mapping System

## 🧠 Overview

This project is a **web-based system for managing and visualizing GPON (Gigabit Passive Optical Network) infrastructure** through interactive maps and operational tools.

It is designed to support both:

- **Technical teams** (network deployment, troubleshooting, maintenance)
- **Administrative teams** (monitoring, planning, decision-making)

The system combines **geospatial data (GIS)**, **telecommunications network modeling**, and **modern web technologies** to provide a centralized platform for network operations.

---

## 🎯 Objectives

- Visualize GPON network infrastructure on interactive maps
- Manage network components (OLT, Splitters, NAPs, ONTs)
- Assist technicians in field operations
- Provide real-time network status and incident tracking
- Enable scalable and structured network data management

---

## 🏗️ Architecture

### Phase 1 (Current)

- **Frontend:** Next.js (React)
- **Backend:** Supabase (Auth, Database, Realtime)
- **Database:** PostgreSQL + PostGIS
- **Data Format:** GeoJSON

### Phase 2 (Planned)

- **Backend Extension:** Node.js (NestJS)
- **Real-time System:** WebSockets
- **Advanced Logic:** Network validation, automation, integrations

---

## 🧩 Core Features

### 🌍 Interactive Map

- Display network topology (OLT → Splitter → NAP → ONT)
- Layer-based visualization
- Zoom and clustering support

### 🛠️ Network Management

- CRUD operations for network elements
- Hierarchical network structure
- Capacity tracking (ports, split ratios)

### ⚡ Real-Time Monitoring

- ONT status (online/offline)
- Incident detection (fiber cuts, signal loss)
- Live updates via realtime services

### 👥 User Roles

- Technicians (field operations)
- Administrators (monitoring and planning)

---

## 🗺️ Data Modeling

The system represents the GPON network using:

- **Hierarchical structures (tree model)** → logical representation
- **Graph structures** → routing and analysis
- **Geospatial models (GIS)** → real-world mapping

---

## 🗄️ Database

- PostgreSQL with PostGIS extension
- Geospatial queries for:
  - distance calculations
  - nearest node detection
  - coverage analysis

---

## 📁 Project Structure

```bash
gpon-system/
├── apps/
│   ├── web/        # Frontend (Next.js)
│   └── api/        # Backend (future NestJS)
├── packages/
├── database/
├── geodata/
├── docs/
```

---

## 🚀 Development Strategy

1. Build MVP with Supabase + Next.js
2. Validate UI/UX and workflows
3. Introduce backend (NestJS) for advanced logic
4. Scale with real-time systems and automation

### MVP scope

The current MVP is defined as an **Infrastructure Editor for GPON external plant**:

- OLT, splitter and NAP management
- feeder/distribution fiber routes
- route points such as crossings, cable reserves and splices
- data quality levels and non-blocking warnings

See [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md) for the closed MVP scope and
implementation order.

Research notes for Ecuadorian GPON/FTTH deployment criteria are consolidated in
[`docs/GPON_FTTH_ECUADOR_RESEARCH.md`](docs/GPON_FTTH_ECUADOR_RESEARCH.md).

---

## 🔮 Future Enhancements

- Integration with OLT devices (SNMP / APIs)
- Predictive maintenance (AI/analytics)
- Mobile app for field technicians
- Support for XGS-PON and next-gen networks

---

## ⚠️ Notes

This is not a simple CRUD application.
It is a **network operations system combining GIS + telecom infrastructure + real-time data**.

---

## 📌 Author Goal

To build a scalable, modern, and efficient platform that improves how GPON networks are designed, monitored, and managed.

---
