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

### Phase 2+ (Post-MVP Roadmap)

- **Customers & Drop Lines:** Subscriber management and service delivery
- **OLT Integration:** SNMP/TR-069 telemetry and performance monitoring
- **Field Operations:** Mobile app for technicians, QR code scanning
- **Advanced Analytics:** Predictive maintenance, capacity forecasting

---

## 🧩 Core Features

### 🌍 Interactive Map

- Display network topology (OLT → Splitter → NAP → ONT)
- Layer-based visualization
- Zoom and clustering support

### 🛠️ Network Management

- CRUD operations for network elements (OLT, Splitters, NAPs)
- Hierarchical network structure with drag-to-move positioning
- Capacity tracking (ports, split ratios, usage/reserved/available)
- Non-blocking warnings (NAP saturation, splitter imbalance)
- Undo/redo support (50 steps) via Zustand + Zundo

### 📊 Infrastructure Editor Features

- **Three Editor Modes:** View (read-only), Design (create elements), Edit (modify existing)
- **Logical Diagram:** Tree-based visualization with optical budget per path
- **Optical Budget Calculator:** Real-time signal loss calculation (fiber + splitters + connectors + safety margin)
  - Semaphore: Green (>3dB margin) / Amber (1-3dB) / Red (<1dB) / Gray (no OLT class)
  - Tropical Ecuador margins (4.0 dB) for UV/humidity/repairs
- **Data Quality Tracking:** Unknown / Approximate / Drawn / GPS Captured / Verified
- **Topologies:** Star (1:16), Tree (1:32), Cascade (1:64), Bus (asymmetric)
- **Network Zones:** Geographic sectors with operative code generation (e.g., `PIC-UIO-Z05-NAP-128`)
- **Equipment Layers:** Centralized Mapbox layer management for clean scaling

### 👥 User Roles (Role-Based Access Control)

- **Admin** — Government/oversight; full CRUD + delete authority
- **Network Engineer** — Design & validation; CRUD infrastructure
- **Outside Plant** — Field operations; mark crossings/reserves/splices
- **Installer** — Phase 4 (customer installations)
- **Support** — Phase 4 (incident management)

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

```
gpon-system/
├── apps/web/                    # Next.js 16 frontend (React 19)
│   ├── app/                     # App Router (layout, pages, routes)
│   ├── components/              # React components
│   │   ├── map/                 # Map editor & viewer (20+ files)
│   │   │   └── logical-diagram/ # Tree-based network visualization
│   │   └── topology/
│   ├── lib/
│   │   ├── gpon/                # Optical budget, operative codes, topology templates
│   │   ├── map/                 # Mapbox utilities, route geometry editor
│   │   ├── store/               # Zustand + Zundo state management
│   │   ├── queries/             # React Query hooks
│   │   ├── supabase/            # Auth & DB client
│   │   └── types/
│   ├── proxy.ts                 # Auth middleware (Next.js 16)
│   └── biome.json               # Linting & formatting
├── database/
│   ├── migrations/              # 001-017 SQL migrations (001-013 applied)
│   └── seed/                    # Development data
├── docs/                        # 19 markdown docs + research sources
│   ├── MVP_SCOPE.md
│   ├── GPON_FTTH_ECUADOR_RESEARCH.md  # Canonical reference
│   ├── TOPOLOGIES.md            # Star/Tree/Cascade/Bus guide
│   ├── adr/                     # Architecture Decision Records
│   └── research-sources/        # Original whitepapers
├── packages/types/              # Shared TypeScript types (planned)
├── geodata/                     # GeoJSON fixtures (planned)
└── CLAUDE.md                    # Project documentation (source of truth)
```

---

## 🚀 Development Roadmap

### Current Status: MVP (Infrastructure Editor)

The MVP is a **complete web-based infrastructure editor for GPON external plant**, featuring:

- ✅ Network topology visualization (OLT → Splitter → NAP)
- ✅ Interactive map editor (design, edit, delete modes)
- ✅ Optical budget calculator with live semaphore (green/amber/red)
- ✅ Logical tree diagram (unifilar) with per-path loss calculation
- ✅ Role-based access control (5 roles, RLS enforced)
- ✅ Undo/redo (50 steps)
- ✅ Data quality tracking (Unknown/Approximate/Drawn/GPS/Verified)
- ✅ Capacity management (NAP ports, split ratios)
- ✅ Network zones + operative code generation
- ✅ Development seeds (Quito, Cuenca)

See [`docs/MVP_SCOPE.md`](docs/MVP_SCOPE.md) for detailed scope and closure criteria.

### Phase 2+ (Post-MVP)

- Customers, drop lines, service delivery
- OLT telemetry (SNMP/TR-069)
- Field technician mobile app
- Incident tracking and audit logs
- Predictive maintenance analytics

### Technical Foundation

- **Database:** 17 migrations covering schema, RLS, RPCs, audit trails, network zones
- **Frontend:** 20+ map components + logical diagram system
- **Documentation:** Ecuadorian GPON research, topologies, OLT operations, workflow analysis

Technical references:
- [`docs/GPON_FTTH_ECUADOR_RESEARCH.md`](docs/GPON_FTTH_ECUADOR_RESEARCH.md) — Consolidated market analysis, optical budgets, materials
- [`docs/TOPOLOGIES.md`](docs/TOPOLOGIES.md) — Star/Tree/Cascade/Bus topology guide
- [`CLAUDE.md`](CLAUDE.md) — Complete project documentation (source of truth)

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js 18+**, **pnpm** (package manager)
- **Supabase** account (auth, database, PostGIS extension)
- **Mapbox** account (interactive maps)

### Setup

```bash
# Install dependencies
cd apps/web
pnpm install

# Copy environment variables
cp .env.local.example .env.local
# Fill in: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, MAPBOX_TOKEN

# Start development server
pnpm dev

# Run linter/formatter
pnpm check:fix

# Build for production
pnpm build
```

See [`CLAUDE.md`](CLAUDE.md) for complete configuration and architecture details.

---

## 🔮 XGS-PON & Next-Generation Networks

The system is designed to support **XGS-PON** (10 Gbps symmetric) alongside GPON:

- Topologies and optical budgets are XGS-PON ready
- OLT class selection supports both GPON (B/B+) and XGS-PON (D.1/D.2/D.3)
- Future: Combo ports for seamless GPON ↔ XGS-PON migration

---

## ⚠️ Philosophy

This is **not** a simple CRUD application.

It is a **specialized network operations system** combining:
- **GIS integration** (PostGIS, Mapbox, geospatial queries)
- **Telecom infrastructure modeling** (hierarchical + graph structures)
- **Real-time state management** (Zustand + Zundo, undo/redo)
- **Domain-specific logic** (optical budgets, capacity tracking, zone-based codes)

The codebase prioritizes **correctness** (RLS enforcement, audit trails), **usability** (interactive editor), and **scalability** (modular components, centralized state).

---

## 📌 Mission

To build a scalable, modern platform that improves how GPON networks are **designed, validated, operated, and scaled** across Ecuador and beyond.

---
