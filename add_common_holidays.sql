-- Add common Indian holidays for 2025
-- This script can be run in the Supabase SQL editor to add holidays

INSERT INTO holidays (date, name, is_optional) VALUES
-- 2025 holidays
('2025-01-26', 'Republic Day', false),
('2025-08-15', 'Independence Day', false),
('2025-10-02', 'Gandhi Jayanti', false),
('2025-03-14', 'Holi', false),
('2025-04-14', 'Ram Navami', false),
('2025-10-20', 'Dussehra', false),
('2025-11-08', 'Diwali', false),
('2025-12-25', 'Christmas Day', false)
ON CONFLICT (date) DO NOTHING;

-- Add 2024 holidays as well
INSERT INTO holidays (date, name, is_optional) VALUES
('2024-01-26', 'Republic Day', false),
('2024-08-15', 'Independence Day', false),
('2024-10-02', 'Gandhi Jayanti', false),
('2024-03-25', 'Holi', false),
('2024-04-17', 'Ram Navami', false),
('2024-10-12', 'Dussehra', false),
('2024-11-01', 'Diwali', false),
('2024-12-25', 'Christmas Day', false)
ON CONFLICT (date) DO NOTHING;