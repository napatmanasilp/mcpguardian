-- Monthly Partition Builder for tool_invocation_logs
-- Run this script monthly (e.g., via pg_cron or cron job) to create partitions
-- for the next 3 months. Each partition covers one calendar month.
--
-- Usage:
--   psql $DATABASE_URL -f scripts/create-monthly-partitions.sql
--
-- Or schedule via Supabase pg_cron:
--   SELECT cron.schedule('create-partitions', '0 0 1 * *',
--     $$ ...content of this file... $$);

DO $$
DECLARE
  start_date DATE := date_trunc('month', now())::DATE;
  end_date   DATE := date_trunc('month', now() + interval '3 months')::DATE;
  part_date  DATE;
  part_name  TEXT;
  from_val   TEXT;
  to_val     TEXT;
BEGIN
  part_date := start_date;
  WHILE part_date < end_date LOOP
    part_name := 'tool_invocation_logs_' || to_char(part_date, 'YYYY_MM');
    from_val  := to_char(part_date, 'YYYY-MM-DD');
    to_val    := to_char(part_date + interval '1 month', 'YYYY-MM-DD');

    -- Only create if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE relname = part_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF tool_invocation_logs ' ||
        'FOR VALUES FROM (%L) TO (%L);',
        part_name, from_val, to_val
      );
      RAISE NOTICE 'Created partition: %', part_name;
    END IF;

    part_date := part_date + interval '1 month';
  END LOOP;
END;
$$;
