-- Seva Entry, Phase 1 - seed rows (DB 7.9). Idempotent: every insert is ON CONFLICT DO NOTHING, so running it
-- again never changes rows the office has since edited.
--
-- Temple texts are samples: each one starts with 'SAMPLE - ' so the go-live check can find any left over before
-- the office sends the real details (D29). No phone numbers here.

-- Counter 1 on the office PC.
INSERT INTO counters (id, name, place)
VALUES (1, 'Counter 1', 'Office PC')
ON CONFLICT (id) DO NOTHING;

-- Series: C1 (Counter 1 online), OF1 (Counter 1 offline), W (paid online orders), WT (gateway test mode).
INSERT INTO receipt_series (code, kind, counter_id)
VALUES
  ('C1', 'counter_online', 1),
  ('OF1', 'counter_offline', 1),
  ('W', 'online', NULL),
  ('WT', 'online_test', NULL)
ON CONFLICT (code) DO NOTHING;

-- Cash denominations for the close-day count: notes 500..10, then coins by value 20..1.
INSERT INTO cash_denominations (kind, value, display_order)
VALUES
  ('note', 500, 1),
  ('note', 200, 2),
  ('note', 100, 3),
  ('note', 50, 4),
  ('note', 20, 5),
  ('note', 10, 6),
  ('coin', 20, 7),
  ('coin', 10, 8),
  ('coin', 5, 9),
  ('coin', 2, 10),
  ('coin', 1, 11)
ON CONFLICT (kind, value) DO NOTHING;

-- The single settings row with sample slip texts; every other column keeps its default.
INSERT INTO seva_settings (
  id, temple_name_en, temple_name_kn, address_line1, address_line2, registration_line,
  footer_line1, footer_line2, footer_blessing
)
VALUES (
  1,
  'SAMPLE - Sri Raghavendra Swamy Matha',
  'SAMPLE - ಶ್ರೀ ರಾಘವೇಂದ್ರ ಸ್ವಾಮಿ ಮಠ',
  'SAMPLE - Yelahanka New Town',
  'SAMPLE - Bengaluru 560064',
  'SAMPLE - Regd. Trust No. to be confirmed by the temple office',
  'SAMPLE - Please keep this receipt for prasadam.',
  'SAMPLE - Seva timings and contact details from the temple office',
  'SAMPLE - ಶ್ರೀ ಗುರುರಾಜೋ ವಿಜಯತೇ'
)
ON CONFLICT (id) DO NOTHING;
