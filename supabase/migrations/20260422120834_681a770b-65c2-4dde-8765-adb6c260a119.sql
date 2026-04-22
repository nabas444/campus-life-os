-- Remove any existing duplicates first to allow the unique index to be created
DELETE FROM public.outage_reports a
USING public.outage_reports b
WHERE a.ctid < b.ctid
  AND a.outage_id IS NOT NULL
  AND a.outage_id = b.outage_id
  AND a.reporter_id = b.reporter_id;

-- Unique partial index: one report per (outage, reporter) when outage_id is set
CREATE UNIQUE INDEX IF NOT EXISTS outage_reports_unique_pile_on
  ON public.outage_reports (outage_id, reporter_id)
  WHERE outage_id IS NOT NULL;