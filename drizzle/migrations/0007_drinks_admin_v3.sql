ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS dishes_category_check;
ALTER TABLE public.dishes ADD CONSTRAINT dishes_category_check CHECK (category IN ('plat','dessert','boisson'));
ALTER TABLE public.dishes ADD COLUMN IF NOT EXISTS formats jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.dishes ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;
ALTER TABLE public.dishes ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.dishes ADD COLUMN IF NOT EXISTS in_carousel boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_type text;

CREATE OR REPLACE FUNCTION public.place_order_v3(
  _customer_name text, _customer_phone text, _customer_email text, _delivery_time text,
  _delivery_type text, _delivery_location text, _payment_method text, _note text, _items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it jsonb; d record; q int; fmt text; p int; f jsonb;
  out_items jsonb := '[]'::jsonb; tot int := 0; new_id uuid;
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
    out_items := out_items || jsonb_build_object('dish_id', d.id, 'name', d.name || coalesce(' (' || fmt || ')',''), 'price', p, 'quantity', q, 'format', fmt);
    tot := tot + p * q;
  END LOOP;
  INSERT INTO orders(customer_name, customer_phone, customer_email, delivery_time, delivery_type, delivery_location, payment_method, note, items, total)
  VALUES (trim(_customer_name), trim(_customer_phone), nullif(trim(coalesce(_customer_email,'')),''), trim(_delivery_time), _delivery_type, trim(_delivery_location), _payment_method, nullif(trim(coalesce(_note,'')),''), out_items, tot)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
GRANT EXECUTE ON FUNCTION public.place_order_v3(text,text,text,text,text,text,text,text,jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list()
RETURNS TABLE(user_id uuid, email text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  RETURN QUERY SELECT r.user_id, u.email::text FROM user_roles r JOIN auth.users u ON u.id = r.user_id WHERE r.role = 'admin' ORDER BY u.email;
END $$;

CREATE OR REPLACE FUNCTION public.admin_add(_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(trim(_email));
  IF uid IS NULL THEN RAISE EXCEPTION 'Aucun compte avec cet e-mail. La personne doit d''abord créer son compte sur /auth.'; END IF;
  INSERT INTO user_roles(user_id, role) VALUES (uid,'admin') ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Tu ne peux pas te retirer toi-même'; END IF;
  DELETE FROM user_roles WHERE user_id = _user_id AND role = 'admin';
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_list(), public.admin_add(text), public.admin_remove(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list(), public.admin_add(text), public.admin_remove(uuid) TO authenticated;