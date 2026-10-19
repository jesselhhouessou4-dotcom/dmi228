ALTER TABLE public.dishes ADD COLUMN category text NOT NULL DEFAULT 'plat' CHECK (category IN ('plat','dessert'));
CREATE TABLE public.telegram_settings (id int PRIMARY KEY DEFAULT 1 CHECK (id = 1), chat_id bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.telegram_settings TO service_role;
ALTER TABLE public.telegram_settings ENABLE ROW LEVEL SECURITY;