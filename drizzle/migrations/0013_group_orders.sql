CREATE TABLE public.group_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  min_items integer NOT NULL DEFAULT 10 CHECK (min_items BETWEEN 2 AND 1000),
  lead_hours integer NOT NULL DEFAULT 24 CHECK (lead_hours BETWEEN 1 AND 720),
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','fixed')),
  discount_value integer NOT NULL DEFAULT 10 CHECK (discount_value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.group_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
GRANT SELECT ON public.group_settings TO anon, authenticated;
GRANT UPDATE ON public.group_settings TO authenticated;
GRANT ALL ON public.group_settings TO service_role;
ALTER TABLE public.group_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read group settings" ON public.group_settings FOR SELECT TO anon, authenticated USING (id = 1);
CREATE POLICY "admin update group settings" ON public.group_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.dishes ADD COLUMN group_price integer CHECK (group_price IS NULL OR group_price >= 0);
ALTER TABLE public.orders ADD COLUMN is_group boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN original_total integer;
ALTER TABLE public.orders ADD COLUMN discount_total integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.place_order_v5(_customer_name text, _customer_phone text, _customer_email text, _order_type text, _scheduled_at timestamptz, _delivery_type text, _delivery_location text, _payment_method text, _note text, _items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.group_settings; s public.shop_settings; _id uuid; _t time; n int; it jsonb; gp int; base int; unit int; orig int;
  out_items jsonb := '[]'::jsonb; tot int := 0; otot int := 0; o public.orders;
BEGIN
  IF _order_type <> 'group' THEN
    RETURN public.place_order_v4(_customer_name, _customer_phone, _customer_email, _order_type, _scheduled_at, _delivery_type, _delivery_location, _payment_method, _note, _items);
  END IF;
  SELECT * INTO g FROM public.group_settings WHERE id = 1;
  SELECT * INTO s FROM public.shop_settings WHERE id = 1;
  IF g IS NULL OR NOT g.enabled THEN RAISE EXCEPTION 'La commande groupée n''est pas disponible pour le moment.'; END IF;
  IF jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'Panier invalide'; END IF;
  SELECT coalesce(sum((x->>'quantity')::int),0) INTO n FROM jsonb_array_elements(_items) x;
  IF n < g.min_items THEN RAISE EXCEPTION 'Commande groupée : minimum % articles.', g.min_items; END IF;
  IF _scheduled_at IS NULL THEN RAISE EXCEPTION 'Choisis la date et l''heure de livraison.'; END IF;
  IF _scheduled_at < now() + make_interval(hours => g.lead_hours) THEN
    RAISE EXCEPTION 'La commande groupée doit être passée au moins % h à l''avance.', g.lead_hours; END IF;
  IF _scheduled_at > now() + interval '60 days' THEN RAISE EXCEPTION 'Date trop lointaine (60 jours maximum).'; END IF;
  _t := (_scheduled_at AT TIME ZONE 'Africa/Lome')::time;
  IF _t < s.open_time OR _t > s.close_time THEN
    RAISE EXCEPTION 'Livraison possible entre % et %.', to_char(s.open_time,'HH24:MI'), to_char(s.close_time,'HH24:MI'); END IF;
  _id := public.place_order_v3(_customer_name, _customer_phone, _customer_email,
    'Groupée ' || to_char(_scheduled_at AT TIME ZONE 'Africa/Lome', 'DD/MM/YYYY HH24:MI'),
    _delivery_type, _delivery_location, _payment_method, _note, _items);
  SELECT * INTO o FROM public.orders WHERE id = _id;
  FOR it IN SELECT * FROM jsonb_array_elements(o.items) LOOP
    orig := (it->>'price')::int;
    SELECT group_price INTO gp FROM public.dishes WHERE id = (it->>'dish_id')::uuid;
    IF gp IS NOT NULL THEN
      SELECT coalesce(sum((e->>'price')::int * (e->>'quantity')::int),0) INTO base FROM jsonb_array_elements(coalesce(it->'extras','[]'::jsonb)) e;
      unit := gp + base;
    ELSIF g.discount_type = 'percent' THEN
      unit := round(orig * (100 - least(g.discount_value,100)) / 100.0)::int;
    ELSE
      unit := greatest(0, orig - g.discount_value);
    END IF;
    unit := least(unit, orig);
    out_items := out_items || (it || jsonb_build_object('price', unit, 'original_price', orig));
    tot := tot + unit * (it->>'quantity')::int;
    otot := otot + orig * (it->>'quantity')::int;
  END LOOP;
  UPDATE public.orders SET order_type = 'group', is_group = true, scheduled_at = _scheduled_at,
    items = out_items, total = tot, original_total = otot, discount_total = otot - tot WHERE id = _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.place_order_v5(text,text,text,text,timestamptz,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order_v5(text,text,text,text,timestamptz,text,text,text,text,jsonb) TO anon, authenticated;