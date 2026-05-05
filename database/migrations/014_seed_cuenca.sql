-- Development seed: GPON network in Cuenca (El Ejido / San Sebastián sector)
-- Topology: Star 1:16  (OLT B+ → 1 Splitter 1:16 → 4 NAPs)
-- Intended as a second network to complement the Quito seed (003).
--
-- Also patches the Quito OLT to add optical_class = 'B+' (field added in 013).
--
-- Optical budget summary (layout-engine logic, 1490 nm @ 0.30 dB/km, 1.02x):
--   SPL-CUE-001 : total ~18.3 dB  → margin 9.7 dB  → Verde ✅
--   NAP-CUE-001 : total ~19.5 dB  → margin 8.5 dB  → Verde ✅
--   NAP-CUE-002 : total ~19.5 dB  → margin 8.5 dB  → Verde ✅
--   NAP-CUE-003 : total ~19.5 dB  → margin 8.5 dB  → Verde ✅
--   NAP-CUE-004 : total ~19.4 dB  → margin 8.6 dB  → Verde ✅

-- ─── PATCH QUITO OLT — add optical_class ──────────────────────────────────────

UPDATE infrastructure_elements
SET optical_class = 'B+'
WHERE code = 'OLT-UIO-01'
  AND optical_class IS NULL;

-- ─── INFRASTRUCTURE ELEMENTS ──────────────────────────────────────────────────

INSERT INTO infrastructure_elements
  (type, code, name, status, location, location_quality,
   pon_standard, total_pon_ports, optical_class,
   split_ratio, insertion_loss_db, total_ports,
   address_reference, notes)
VALUES
  -- OLT principal Cuenca — sector San Sebastián
  ('olt', 'OLT-CUE-01', 'OLT San Sebastián Cuenca', 'active',
   ST_GeogFromText('POINT(-79.0200 -2.8900)'), 'verified',
   'gpon', 16, 'B+',
   NULL, NULL, NULL,
   'Av. Loja y Av. Solano, Cuenca',
   'OLT principal nodo Cuenca centro-sur'),

  -- Splitter 1:16 — sector El Ejido
  ('splitter', 'SPL-CUE-001', 'Splitter El Ejido', 'active',
   ST_GeogFromText('POINT(-79.0060 -2.8960)'), 'gps_captured',
   NULL, NULL, NULL,
   '1:16', 13.80, 16,
   'Av. 12 de Abril y Av. Remigio Crespo, Cuenca',
   'Cámara subterránea en calzada. Acceso con llave D1.'),

  -- NAPs
  ('nap', 'NAP-CUE-001', 'NAP El Ejido Norte A', 'active',
   ST_GeogFromText('POINT(-79.0015 -2.8915)'), 'gps_captured',
   NULL, NULL, NULL,
   NULL, NULL, 8,
   'Calle Tarqui y Av. Remigio Crespo, Cuenca',
   NULL),

  ('nap', 'NAP-CUE-002', 'NAP El Ejido Este B', 'active',
   ST_GeogFromText('POINT(-79.0010 -2.8970)'), 'gps_captured',
   NULL, NULL, NULL,
   NULL, NULL, 8,
   'Av. Fray Vicente Solano y Pumapungo, Cuenca',
   NULL),

  ('nap', 'NAP-CUE-003', 'NAP El Ejido Sur C', 'planned',
   ST_GeogFromText('POINT(-79.0060 -2.9010)'), 'approximate',
   NULL, NULL, NULL,
   NULL, NULL, 8,
   'Av. 10 de Agosto, Cuenca',
   'Pendiente aprobación municipio para armario en vía pública'),

  ('nap', 'NAP-CUE-004', 'NAP San Sebastián D', 'active',
   ST_GeogFromText('POINT(-79.0100 -2.8930)'), 'gps_captured',
   NULL, NULL, NULL,
   NULL, NULL, 8,
   'Calle Luis Cordero y Av. Loja, Cuenca',
   NULL);

-- ─── FIBER ROUTES ─────────────────────────────────────────────────────────────

INSERT INTO fiber_routes
  (code, type, status, from_element_id, to_element_id,
   geometry, route_quality, installation_type, fiber_type, fiber_count,
   length_meters, attenuation_db_per_km, splice_loss_db, connector_loss_db,
   notes)
VALUES
  -- Feeder OLT-CUE-01 → SPL-CUE-001 (~1.72 km, underground)
  ('R-FEED-CUE-001', 'feeder', 'active',
   (SELECT id FROM infrastructure_elements WHERE code = 'OLT-CUE-01'),
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-CUE-001'),
   ST_GeogFromText('LINESTRING(
     -79.0200 -2.8900,
     -79.0180 -2.8910,
     -79.0150 -2.8930,
     -79.0110 -2.8945,
     -79.0080 -2.8955,
     -79.0060 -2.8960
   )'),
   'verified', 'underground', 'g652d', 24,
   1720.0, 0.350, 0.10, 0.30,
   'Canalización Telconet por Av. Loja y Av. 12 de Abril'),

  -- Distribution SPL-CUE-001 → NAP-CUE-001 (~580 m, aerial)
  ('R-DIST-CUE-001', 'distribution', 'active',
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-CUE-001'),
   (SELECT id FROM infrastructure_elements WHERE code = 'NAP-CUE-001'),
   ST_GeogFromText('LINESTRING(
     -79.0060 -2.8960,
     -79.0050 -2.8945,
     -79.0040 -2.8930,
     -79.0020 -2.8920,
     -79.0015 -2.8915
   )'),
   'gps_captured', 'aerial', 'g657a1', 6,
   580.0, 0.380, 0.10, 0.30,
   NULL),

  -- Distribution SPL-CUE-001 → NAP-CUE-002 (~540 m, aerial)
  ('R-DIST-CUE-002', 'distribution', 'active',
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-CUE-001'),
   (SELECT id FROM infrastructure_elements WHERE code = 'NAP-CUE-002'),
   ST_GeogFromText('LINESTRING(
     -79.0060 -2.8960,
     -79.0040 -2.8960,
     -79.0025 -2.8965,
     -79.0010 -2.8970
   )'),
   'gps_captured', 'aerial', 'g657a1', 6,
   540.0, 0.380, 0.10, 0.30,
   NULL),

  -- Distribution SPL-CUE-001 → NAP-CUE-003 (~555 m, aerial, planned)
  ('R-DIST-CUE-003', 'distribution', 'planned',
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-CUE-001'),
   (SELECT id FROM infrastructure_elements WHERE code = 'NAP-CUE-003'),
   ST_GeogFromText('LINESTRING(
     -79.0060 -2.8960,
     -79.0060 -2.8975,
     -79.0060 -2.8990,
     -79.0060 -2.9010
   )'),
   'approximate', 'aerial', 'g657a1', 6,
   555.0, 0.380, 0.10, 0.30,
   'Trazo preliminar, pendiente levantamiento en campo'),

  -- Distribution SPL-CUE-001 → NAP-CUE-004 (~385 m, aerial)
  ('R-DIST-CUE-004', 'distribution', 'active',
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-CUE-001'),
   (SELECT id FROM infrastructure_elements WHERE code = 'NAP-CUE-004'),
   ST_GeogFromText('LINESTRING(
     -79.0060 -2.8960,
     -79.0070 -2.8950,
     -79.0085 -2.8940,
     -79.0100 -2.8930
   )'),
   'gps_captured', 'aerial', 'g657a1', 6,
   385.0, 0.380, 0.10, 0.30,
   NULL);

-- ─── ROUTE POINTS ─────────────────────────────────────────────────────────────

INSERT INTO route_points
  (fiber_route_id, type, code, status,
   location, location_quality, position_on_route_m,
   reserve_length_m, splice_loss_db, crossing_type, risk_level, reference_text,
   notes)
VALUES
  -- Cruce de avenida en R-FEED-CUE-001 (Av. Solano)
  ((SELECT id FROM fiber_routes WHERE code = 'R-FEED-CUE-001'),
   'crossing', NULL, 'active',
   ST_GeogFromText('POINT(-79.0150 -2.8930)'), 'gps_captured', 620,
   NULL, NULL, 'avenue', 'medium', 'Av. Remigio Crespo',
   'Cruce subterráneo vía ducto existente, profundidad 0.8 m'),

  -- Empalme de fusión en R-FEED-CUE-001 (reparación por obra vial)
  ((SELECT id FROM fiber_routes WHERE code = 'R-FEED-CUE-001'),
   'splice', 'EMP-CUE-001', 'active',
   ST_GeogFromText('POINT(-79.0110 -2.8945)'), 'gps_captured', 1020,
   NULL, 0.12, NULL, NULL, NULL,
   'Empalme de reparación por rotura en obra vial Municipio Cuenca 2025'),

  -- Reserva de cable en R-DIST-CUE-002
  ((SELECT id FROM fiber_routes WHERE code = 'R-DIST-CUE-002'),
   'reserve', 'RES-CUE-001', 'active',
   ST_GeogFromText('POINT(-79.0025 -2.8965)'), 'gps_captured', 290,
   25.0, NULL, NULL, NULL, NULL,
   'Reserva 25 m para eventual derivación hacia edificio en construcción');
