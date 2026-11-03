CREATE TABLE public.extras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_available boolean NOT NULL DEFAULT true,
  categories text[] NOT NULL DEFAULT '{}',
  dish_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.extras TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extras TO authenticated;
GRANT ALL ON public.extras TO service_role;
ALTER TABLE public.extras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read extras" ON public.extras FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin insert extras" ON public.extras FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update extras" ON public.extras FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete extras" ON public.extras FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.place_order_v3(_customer_name text, _customer_phone text, _customer_email text, _delivery_time text, _delivery_type text, _delivery_location text, _payment_method text, _note text, _items jsonb)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  it jsonb; d record; q int; fmt text; p int; f jsonb; ex jsonb; e record; eq int;
  out_items jsonb := '[]'::jsonb; out_ex jsonb; base_name text; tot int := 0; new_id uuid;
BEGIN
  IF coalesce(length(trim(_customer_name)),0) < 1 OR length(_customer_name) > 100 THEN RAISE EXCEPTION 'Nom invalide'; END IF;
  IF _customer_phone !~ '^\+?[0-9 ]{8,20}$' THEN RAISE EXCEPTION 'Téléphone invalide'; END IF;
  IF length(coalesce(_customer_email,'')) > 255 THEN RAISE EXCEPTION 'E-mail invalide'; END IF;
  IF coalesce(length(trim(_delivery_time)),0) < 1 OR length(_delivery_time) > 50 THEN RAISE EXCEPTION 'Heure invalide'; END IF;
  IF _delivery_type NOT IN ('etudiant','externe') THEN RAISE EXCEPTION 'Type de livraison invalide'; END IF;
  IF coalesce(length(trim(_delivery_location)),0) < 3 OR length(_delivery_location) > 600 THEN RAISE EXCEPTION 'Lieu invalide'; END IF;
  IF _payment_method NOT IN ('mobile_money','cash') THEN RAISE EXCEPTION 'Paiement invalide'; END IF;
  IF length(coalesce(_note,'')) > 500 THEN RAISE EXCEPTION 'Note trop longue'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 OR jsonb_array_length(_items) > 50 THEN RAISE EXCEPTION 'Panier invalide'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    q := (it->>'quantity')::int;
    IF q IS NULL OR q < 1 OR q > 99 THEN RAISE EXCEPTION 'Quantité invalide'; END IF;
    SELECT * INTO d FROM dishes WHERE id = (it->>'dish_id')::uuid AND published AND is_available;
    IF NOT FOUND THEN RAISE EXCEPTION 'Un article n''est plus disponible'; END IF;
    fmt := nullif(it->>'format','');
    p := d.price;
    IF fmt IS NOT NULL THEN
      SELECT x INTO f FROM jsonb_array_elements(d.formats) x WHERE x->>'name' = fmt LIMIT 1;
      IF f IS NULL THEN RAISE EXCEPTION 'Format invalide'; END IF;
      p := (f->>'price')::int;
    ELSIF jsonb_array_length(d.formats) > 0 THEN RAISE EXCEPTION 'Choisis un format';
    END IF;
    out_ex := '[]'::jsonb;
    IF jsonb_typeof(it->'extras') = 'array' THEN
      IF jsonb_array_length(it->'extras') > 20 THEN RAISE EXCEPTION 'Trop de suppléments'; END IF;
      FOR ex IN SELECT * FROM jsonb_array_elements(it->'extras') LOOP
        eq := (ex->>'quantity')::int;
        IF eq IS NULL OR eq < 1 OR eq > 10 THEN RAISE EXCEPTION 'Quantité de supplément invalide'; END IF;
        SELECT * INTO e FROM extras WHERE id = (ex->>'id')::uuid AND is_available
          AND (d.id = ANY(dish_ids) OR d.category = ANY(categories));
        IF NOT FOUND THEN RAISE EXCEPTION 'Un supplément n''est plus disponible'; END IF;
        out_ex := out_ex || jsonb_build_object('id', e.id, 'name', e.name, 'price', e.price, 'quantity', eq);
        p := p + e.price * eq;
      END LOOP;
    END IF;
    base_name := d.name || coalesce(' (' || fmt || ')','');
    out_items := out_items || jsonb_build_object('dish_id', d.id, 'name', base_name, 'price', p, 'quantity', q, 'format', fmt, 'extras', out_ex);
    tot := tot + p * q;
  END LOOP;
  INSERT INTO orders(customer_name, customer_phone, customer_email, delivery_time, delivery_type, delivery_location, payment_method, note, items, total)
  VALUES (trim(_customer_name), trim(_customer_phone), nullif(trim(coalesce(_customer_email,'')),''), trim(_delivery_time), _delivery_type, trim(_delivery_location), _payment_method, nullif(trim(coalesce(_note,'')),''), out_items, tot)
  RETURNING id INTO new_id;
  RETURN new_id;
END $function$;