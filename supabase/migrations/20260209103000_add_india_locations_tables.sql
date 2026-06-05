-- Add India state/city/pincode reference tables

CREATE TABLE IF NOT EXISTS public.states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id uuid NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_id, name)
);

CREATE TABLE IF NOT EXISTS public.pincodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  pincode text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, pincode)
);

CREATE INDEX IF NOT EXISTS idx_states_name ON public.states(name);
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON public.cities(state_id);
CREATE INDEX IF NOT EXISTS idx_pincodes_city_id ON public.pincodes(city_id);

ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pincodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS states_select_all ON public.states;
DROP POLICY IF EXISTS cities_select_all ON public.cities;
DROP POLICY IF EXISTS pincodes_select_all ON public.pincodes;

CREATE POLICY states_select_all ON public.states FOR SELECT TO authenticated USING (true);
CREATE POLICY cities_select_all ON public.cities FOR SELECT TO authenticated USING (true);
CREATE POLICY pincodes_select_all ON public.pincodes FOR SELECT TO authenticated USING (true);
