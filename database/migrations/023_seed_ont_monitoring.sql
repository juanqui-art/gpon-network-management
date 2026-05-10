-- Seed dev: telemetría mock para OLT-CUE-01 (Cuenca El Ejido).
-- Permite ver la sección /monitoring funcionando sin tener que arrancar el colector.
-- Idempotente: si se reaplica, sobreescribe.
--
-- Cobertura sembrada (16 ONTs):
--   11 online sanos      rx_power >= -20 dBm
--    3 online warning    -25 <= rx_power < -20
--    1 online critical   rx_power < -25 (al límite operacional)
--    1 offline (LOS)     última conexión hace 7 min

-- ─── Enriquecer OLT-CUE-01 con identidad de gestión + properties realistas ──

UPDATE infrastructure_elements
SET
  management_ip = '10.10.50.1',
  properties = jsonb_build_object(
    'olt_model_id', 'huawei-ma5608t',
    'olt_model', 'Huawei MA5608T',
    'olt_brand', 'Huawei',
    'service_cards_installed', 1,
    'service_slots_total', 2,
    'pon_ports_per_card', 16,
    'design_split_ratio', '1:64',
    'estimated_subscribers', 1024,
    'tx_power_dbm', 4.0,
    'rx_sensitivity_dbm', -28.0,
    'headend_loss_db', 1.5,
    'headend_adapter_count', 2,
    'pon_port_connector_type', 'SC/UPC',
    'odf_feeder_connector_type', 'SC/APC',
    'headend_patchcord_type', 'SC/UPC -> SC/APC'
  )
WHERE id = '60ec7fcc-d850-4f0c-b6b8-d367ec61da3c';

-- ─── ont_current_state — limpiar y resembrar ────────────────────────────────

DELETE FROM ont_current_state WHERE olt_host = '10.10.50.1';

INSERT INTO ont_current_state (
  network_id, ont_serial, ont_logical_id, ont_description,
  olt_host, pon_port,
  rx_power_dbm, tx_power_dbm, temperature_c,
  status, distance_m, last_disconnect_reason, last_seen_at
) VALUES
  -- 11 ONTs sanos (rx_power >= -20 dBm)
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C01', '4194312192.1', 'García Pérez - Av Solano 4-200',
    '10.10.50.1', '0/2/1', -14.20, -0.80, 38.5, 'online', 320, NULL, now()),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C02', '4194312192.2', 'Cybercafé Las Brisas - Solano 5-110',
    '10.10.50.1', '0/2/1', -16.10, 0.20, 41.2, 'online', 580, NULL, now() - interval '15 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C03', '4194312192.3', 'Edif Andes Dpto 502 - Bolívar 8-15',
    '10.10.50.1', '0/2/1', -17.50, -0.40, 36.8, 'online', 720, NULL, now() - interval '8 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C04', '4194312192.4', 'Familia Quintana - Mariscal 3-22',
    '10.10.50.1', '0/2/1', -15.80, -1.20, 35.4, 'online', 250, NULL, now() - interval '5 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C05', '4194312192.5', 'Hostal Bolívar - Calle Bolívar 12-08',
    '10.10.50.1', '0/2/1', -17.90, 0.10, 40.6, 'online', 510, NULL, now() - interval '22 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C06', '4194312192.6', 'Familia Vega - Sucre 2-19',
    '10.10.50.1', '0/2/1', -19.10, -0.20, 38.1, 'online', 690, NULL, now() - interval '12 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C07', '4194312192.7', 'Café Madrid - Estévez de Toral 7-44',
    '10.10.50.1', '0/2/1', -16.50, -0.50, 40.0, 'online', 380, NULL, now() - interval '3 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C08', '4194312192.8', 'Restaurant El Olón',
    '10.10.50.1', '0/2/1', -18.30, 0.50, 39.8, 'online', 850, NULL, now() - interval '18 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C09', '4194312192.9', 'Familia Cordero - Av Solano 6-330',
    '10.10.50.1', '0/2/1', -16.70, 0.80, 37.4, 'online', 420, NULL, now() - interval '7 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C0A', '4194312192.10', 'Familia Andrade - Mariscal 9-15',
    '10.10.50.1', '0/2/1', -18.40, 0.00, 37.9, 'online', 620, NULL, now() - interval '11 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C0B', '4194312192.11', 'Casa Sucre - Sucre 11-25',
    '10.10.50.1', '0/2/1', -19.40, -0.10, 36.2, 'online', 740, NULL, now() - interval '6 seconds'),

  -- 3 ONTs en warning (-25 <= rx_power < -20)
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C0C', '4194312192.12', 'Tienda Esquina Solano - Av Solano 11-08',
    '10.10.50.1', '0/2/1', -22.10, 1.30, 39.4, 'online', 1100, NULL, now() - interval '14 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C0D', '4194312192.13', 'Edif Solano P4 - Av Solano 14-20',
    '10.10.50.1', '0/2/1', -23.40, 1.50, 36.8, 'online', 1280, NULL, now() - interval '20 seconds'),
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C0E', '4194312192.14', 'Casa Mariscal - Mariscal 18-44',
    '10.10.50.1', '0/2/1', -21.70, 0.80, 37.0, 'online', 980, NULL, now() - interval '9 seconds'),

  -- 1 ONT crítico (rx_power < -25)
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C0F', '4194312192.15', 'Tienda Norte - Av Solano 18-90',
    '10.10.50.1', '0/2/1', -26.20, 2.00, 34.8, 'online', 1500, NULL, now() - interval '25 seconds'),

  -- 1 ONT offline (LOS) — última conexión hace 7 min
  ('10000000-0000-0000-0000-000000000002', 'HWTC4A8B2C10', '4194312192.16', 'Imprenta Tres Esquinas - Bolívar 22-15',
    '10.10.50.1', '0/2/1', NULL, NULL, NULL, 'los', 1320, 'los', now() - interval '7 minutes');

-- ─── ont_signal_history — historial mínimo para mostrar degradación ─────────

INSERT INTO ont_signal_history (
  ont_current_state_id, network_id, ont_logical_id,
  rx_power_dbm, tx_power_dbm, status, trigger, recorded_at
)
SELECT cs.id, cs.network_id, cs.ont_logical_id,
  -22.30, 1.80, 'online'::ont_status, 'sample'::ont_history_trigger, now() - interval '40 minutes'
FROM ont_current_state cs
WHERE cs.ont_logical_id = '4194312192.15' AND cs.olt_host = '10.10.50.1'
UNION ALL
SELECT cs.id, cs.network_id, cs.ont_logical_id,
  -24.10, 1.90, 'online'::ont_status, 'degradation'::ont_history_trigger, now() - interval '20 minutes'
FROM ont_current_state cs
WHERE cs.ont_logical_id = '4194312192.15' AND cs.olt_host = '10.10.50.1'
UNION ALL
SELECT cs.id, cs.network_id, cs.ont_logical_id,
  -26.20, 2.00, 'online'::ont_status, 'degradation'::ont_history_trigger, now() - interval '5 minutes'
FROM ont_current_state cs
WHERE cs.ont_logical_id = '4194312192.15' AND cs.olt_host = '10.10.50.1'
UNION ALL
SELECT cs.id, cs.network_id, cs.ont_logical_id,
  -18.40, 1.20, 'online'::ont_status, 'sample'::ont_history_trigger, now() - interval '15 minutes'
FROM ont_current_state cs
WHERE cs.ont_logical_id = '4194312192.16' AND cs.olt_host = '10.10.50.1'
UNION ALL
SELECT cs.id, cs.network_id, cs.ont_logical_id,
  NULL, NULL, 'los'::ont_status, 'change'::ont_history_trigger, now() - interval '7 minutes'
FROM ont_current_state cs
WHERE cs.ont_logical_id = '4194312192.16' AND cs.olt_host = '10.10.50.1';
