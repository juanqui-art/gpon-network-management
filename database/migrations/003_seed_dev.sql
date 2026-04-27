-- Development seed: minimal GPON network around Quito (Mariscal / La Carolina)
-- 1 OLT, 2 splitters, 5 NAPs, 7 fiber routes, 3 route points
-- All coordinates approximate but coherent geographically.

-- ─── INFRASTRUCTURE ELEMENTS ──────────────────────────────────────────────────

INSERT INTO infrastructure_elements
  (type, code, name, status, location, location_quality,
   pon_standard, total_pon_ports, split_ratio, insertion_loss_db, total_ports,
   address_reference, notes)
VALUES
  -- OLT central (Mariscal Sucre)
  ('olt', 'OLT-UIO-01', 'OLT Mariscal Sucre', 'active',
   ST_GeogFromText('POINT(-78.4870 -0.1900)'), 'verified',
   'gpon', 16, NULL, NULL, NULL,
   'Av. 6 de Diciembre y Patria',
   'OLT principal nodo Quito centro'),

  -- Splitter 1:4 — derivacion barrial
  ('splitter', 'SPL-UIO-001', 'Splitter La Carolina N1', 'active',
   ST_GeogFromText('POINT(-78.4830 -0.1820)'), 'gps_captured',
   NULL, NULL, '1:4', 7.20, 4,
   'Av. Naciones Unidas y Amazonas',
   'Camara cerrada con candado'),

  -- Splitter 1:8 — derivacion comercial
  ('splitter', 'SPL-UIO-002', 'Splitter Mariscal N2', 'active',
   ST_GeogFromText('POINT(-78.4910 -0.1960)'), 'gps_captured',
   NULL, NULL, '1:8', 10.50, 8,
   'Av. Amazonas y Roca',
   NULL),

  -- NAPs (capacidad y ubicacion variable)
  ('nap', 'NAP-UIO-001', 'NAP La Carolina A', 'active',
   ST_GeogFromText('POINT(-78.4820 -0.1790)'), 'gps_captured',
   NULL, NULL, NULL, NULL, 8,
   'Av. Naciones Unidas y Shyris',
   NULL),

  ('nap', 'NAP-UIO-002', 'NAP La Carolina B', 'active',
   ST_GeogFromText('POINT(-78.4790 -0.1810)'), 'approximate',
   NULL, NULL, NULL, NULL, 8,
   'Calle Voz Andes',
   'Ubicacion estimada por reporte de tecnico'),

  ('nap', 'NAP-UIO-003', 'NAP Mariscal A', 'active',
   ST_GeogFromText('POINT(-78.4880 -0.1980)'), 'gps_captured',
   NULL, NULL, NULL, NULL, 8,
   'Calle Lizardo Garcia',
   NULL),

  ('nap', 'NAP-UIO-004', 'NAP Mariscal B', 'planned',
   ST_GeogFromText('POINT(-78.4940 -0.1990)'), 'approximate',
   NULL, NULL, NULL, NULL, 16,
   'Av. 12 de Octubre',
   'Pendiente instalacion fisica'),

  ('nap', 'NAP-UIO-005', 'NAP Mariscal C', 'active',
   ST_GeogFromText('POINT(-78.4900 -0.1925)'), 'unknown',
   NULL, NULL, NULL, NULL, 8,
   NULL,
   'Ubicacion no verificada en campo todavia');

-- ─── FIBER ROUTES ─────────────────────────────────────────────────────────────

INSERT INTO fiber_routes
  (code, type, status, from_element_id, to_element_id,
   geometry, route_quality, installation_type, fiber_type, fiber_count,
   length_meters, attenuation_db_per_km, splice_loss_db, connector_loss_db,
   notes)
VALUES
  -- Feeder OLT -> SPL-001
  ('R-FEED-001', 'feeder', 'active',
   (SELECT id FROM infrastructure_elements WHERE code = 'OLT-UIO-01'),
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-UIO-001'),
   ST_GeogFromText('LINESTRING(-78.4870 -0.1900, -78.4855 -0.1860, -78.4840 -0.1830, -78.4830 -0.1820)'),
   'verified', 'underground', 'g652d', 12,
   980.0, 0.350, 0.10, 0.30,
   'Tendido por ducto principal Av. 6 de Diciembre'),

  -- Feeder OLT -> SPL-002
  ('R-FEED-002', 'feeder', 'active',
   (SELECT id FROM infrastructure_elements WHERE code = 'OLT-UIO-01'),
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-UIO-002'),
   ST_GeogFromText('LINESTRING(-78.4870 -0.1900, -78.4885 -0.1925, -78.4905 -0.1955, -78.4910 -0.1960)'),
   'gps_captured', 'aerial', 'g652d', 12,
   780.0, 0.350, 0.10, 0.30,
   NULL),

  -- Distribution SPL-001 -> NAP-001
  ('R-DIST-001', 'distribution', 'active',
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-UIO-001'),
   (SELECT id FROM infrastructure_elements WHERE code = 'NAP-UIO-001'),
   ST_GeogFromText('LINESTRING(-78.4830 -0.1820, -78.4825 -0.1805, -78.4820 -0.1790)'),
   'gps_captured', 'aerial', 'g657a1', 6,
   340.0, 0.380, 0.10, 0.30,
   NULL),

  -- Distribution SPL-001 -> NAP-002
  ('R-DIST-002', 'distribution', 'active',
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-UIO-001'),
   (SELECT id FROM infrastructure_elements WHERE code = 'NAP-UIO-002'),
   ST_GeogFromText('LINESTRING(-78.4830 -0.1820, -78.4810 -0.1815, -78.4790 -0.1810)'),
   'approximate', 'aerial', 'g657a1', 6,
   460.0, 0.380, 0.10, 0.30,
   'Trazo aproximado, validar en campo'),

  -- Distribution SPL-002 -> NAP-003
  ('R-DIST-003', 'distribution', 'active',
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-UIO-002'),
   (SELECT id FROM infrastructure_elements WHERE code = 'NAP-UIO-003'),
   ST_GeogFromText('LINESTRING(-78.4910 -0.1960, -78.4895 -0.1970, -78.4880 -0.1980)'),
   'gps_captured', 'aerial', 'g657a1', 6,
   320.0, 0.380, 0.10, 0.30,
   NULL),

  -- Distribution SPL-002 -> NAP-004 (planned, no completed)
  ('R-DIST-004', 'distribution', 'planned',
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-UIO-002'),
   (SELECT id FROM infrastructure_elements WHERE code = 'NAP-UIO-004'),
   ST_GeogFromText('LINESTRING(-78.4910 -0.1960, -78.4925 -0.1975, -78.4940 -0.1990)'),
   'approximate', 'aerial', 'g657a1', 6,
   430.0, 0.380, 0.10, 0.30,
   'Pendiente tendido fisico'),

  -- Distribution SPL-002 -> NAP-005
  ('R-DIST-005', 'distribution', 'active',
   (SELECT id FROM infrastructure_elements WHERE code = 'SPL-UIO-002'),
   (SELECT id FROM infrastructure_elements WHERE code = 'NAP-UIO-005'),
   ST_GeogFromText('LINESTRING(-78.4910 -0.1960, -78.4905 -0.1945, -78.4900 -0.1925)'),
   'approximate', 'aerial', 'g657a1', 6,
   400.0, 0.380, 0.10, 0.30,
   NULL);

-- ─── ROUTE POINTS ─────────────────────────────────────────────────────────────

INSERT INTO route_points
  (fiber_route_id, type, code, status,
   location, location_quality, position_on_route_m,
   reserve_length_m, splice_loss_db, crossing_type, risk_level, reference_text,
   notes)
VALUES
  -- Cruce de avenida en R-FEED-001
  ((SELECT id FROM fiber_routes WHERE code = 'R-FEED-001'),
   'crossing', NULL, 'active',
   ST_GeogFromText('POINT(-78.4855 -0.1860)'), 'gps_captured', 480,
   NULL, NULL, 'avenue', 'medium', 'Av. Naciones Unidas',
   'Cruce subterraneo via ducto Telconet'),

  -- Reserva de cable en R-FEED-002
  ((SELECT id FROM fiber_routes WHERE code = 'R-FEED-002'),
   'reserve', 'RES-001', 'active',
   ST_GeogFromText('POINT(-78.4905 -0.1955)'), 'gps_captured', 660,
   30.0, NULL, NULL, NULL, NULL,
   'Reserva 30m para futura derivacion'),

  -- Empalme en R-DIST-003
  ((SELECT id FROM fiber_routes WHERE code = 'R-DIST-003'),
   'splice', 'EMP-001', 'active',
   ST_GeogFromText('POINT(-78.4895 -0.1970)'), 'gps_captured', 160,
   NULL, 0.15, NULL, NULL, NULL,
   'Empalme de fibra danada por construccion');
