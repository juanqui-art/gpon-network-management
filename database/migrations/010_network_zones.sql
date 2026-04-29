-- Network zones: predefined geographic sectors within a network
-- Supports zone-based code generation: {PROV}-{CIUDAD}-{ZONA}-{TIPO}-{SEQ}
-- Example: Z01 (Sector norte), Z05 (Centro), Z10 (Sur)

CREATE TABLE IF NOT EXISTS network_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  zone_code varchar(10) NOT NULL, -- Z01, Z05, Z10, Z20, etc.
  zone_name varchar(100) NOT NULL, -- "Sector norte", "Centro"
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  -- Constraint: zone_code unique per network (can't have duplicate Z05 in same network)
  CONSTRAINT unique_zone_code_per_network UNIQUE (network_id, zone_code)
);

-- Indexes
CREATE INDEX idx_network_zones_network_id ON network_zones(network_id);

-- Enable RLS
ALTER TABLE network_zones ENABLE ROW LEVEL SECURITY;

-- RLS: Anyone authenticated can read zones of networks they have access to
CREATE POLICY "zones_read_authenticated" ON network_zones
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS: Only admin and network_engineer can create/update zones
CREATE POLICY "zones_write_admin_engineer" ON network_zones
  FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

CREATE POLICY "zones_update_admin_engineer" ON network_zones
  FOR UPDATE
  USING (get_user_role() IN ('admin', 'network_engineer'))
  WITH CHECK (get_user_role() IN ('admin', 'network_engineer'));

-- RLS: Only admin can delete zones
CREATE POLICY "zones_delete_admin" ON network_zones
  FOR DELETE
  USING (get_user_role() = 'admin');

-- Seed: Add default zones to existing networks
INSERT INTO network_zones (network_id, zone_code, zone_name, description)
SELECT
  id,
  'Z01',
  'Zona norte',
  'Sector norte de la red'
FROM networks
WHERE NOT EXISTS (SELECT 1 FROM network_zones WHERE network_zones.network_id = networks.id)
UNION ALL
SELECT
  id,
  'Z05',
  'Centro',
  'Zona central'
FROM networks
WHERE NOT EXISTS (SELECT 1 FROM network_zones WHERE network_zones.network_id = networks.id)
UNION ALL
SELECT
  id,
  'Z10',
  'Zona sur',
  'Sector sur de la red'
FROM networks
WHERE NOT EXISTS (SELECT 1 FROM network_zones WHERE network_zones.network_id = networks.id);
