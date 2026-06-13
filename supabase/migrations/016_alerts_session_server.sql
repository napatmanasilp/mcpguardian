-- Migration 016: Add session_id and server_id to alerts table
-- These columns allow alert rows to link directly to the related session or server.

ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS server_id UUID;

-- Optional indexes for filtering/joining
CREATE INDEX IF NOT EXISTS idx_alerts_session_id ON public.alerts(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alerts_server_id ON public.alerts(server_id) WHERE server_id IS NOT NULL;
