CREATE TABLE public.shop_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  immediate_open boolean NOT NULL DEFAULT true,
  open_time time NOT NULL DEFAULT '08:00',
  close_time time NOT NULL DEFAULT '20:00',
  lead_minutes integer NOT NULL DEFAULT 60 CHECK (lead_minutes BETWEEN 0 AND 1440),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_settings TO anon, authenticated;
GRANT UPDATE ON public.shop_settings TO authenticated;
GRANT ALL ON public.shop_settings TO service_role;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read settings" ON public.shop_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin update settings" ON public.shop_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.shop_settings (id) VALUES (1);

ALTER TABLE public.orders ADD COLUMN order_type text NOT NULL DEFAULT 'immediate' CHECK (order_type IN ('immediate','preorder'));
ALTER TABLE public.orders ADD COLUMN scheduled_at timestamptz;

CREATE OR REPLACE FUNCTION public.place_order_v4(_customer_name text, _customer_phone text, _customer_email text, _order_type text, _scheduled_at timestamptz, _delivery_type text, _delivery_location text, _payment_method text, _note text, _items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.shop_settings; _id uuid; _t time; _label text;
BEGIN
  SELECT * INTO s FROM public.shop_settings WHERE id = 1;
  IF _order_type = 'immediate' THEN
    IF NOT s.immediate_open THEN RAISE EXCEPTION 'Les commandes immédiates sont fermées pour le moment. Choisis la pré-commande.'; END IF;
    _scheduled_at := NULL; _label := 'Immédiate';
  ELSIF _order_type = 'preorder' THEN
    IF _scheduled_at IS NULL THEN RAISE EXCEPTION 'Choisis la date et l''heure de livraison.'; END IF;
    IF _scheduled_at < now() + make_interval(mins => s.lead_minutes) THEN
      RAISE EXCEPTION 'Choisis un horaire au moins % minutes à l''avance.', s.lead_minutes; END IF;
    IF _scheduled_at > now() + interval '30 days' THEN RAISE EXCEPTION 'Pré-commande possible jusqu''à 30 jours à l''avance.'; END IF;
    _t := (_scheduled_at AT TIME ZONE 'Africa/Lome')::time;
    IF _t < s.open_time OR _t > s.close_time THEN
      RAISE EXCEPTION 'Livraison possible entre % et %.', to_char(s.open_time,'HH24:MI'), to_char(s.close_time,'HH24:MI'); END IF;
    _label := 'Pré-commande ' || to_char(_scheduled_at AT TIME ZONE 'Africa/Lome', 'DD/MM/YYYY HH24:MI');
  ELSE RAISE EXCEPTION 'Type de commande invalide'; END IF;
  _id := public.place_order_v3(_customer_name, _customer_phone, _customer_email, _label, _delivery_type, _delivery_location, _payment_method, _note, _items);
  UPDATE public.orders SET order_type = _order_type, scheduled_at = _scheduled_at WHERE id = _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.place_order_v4(text,text,text,text,timestamptz,text,text,text,text,jsonb) TO anon, authenticated;