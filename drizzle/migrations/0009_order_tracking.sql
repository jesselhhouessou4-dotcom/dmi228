CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1001;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number text UNIQUE DEFAULT ('DMI-' || nextval('public.order_number_seq'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancel_notified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.track_order(_number text)
RETURNS TABLE(order_number text, status text, items jsonb, total integer, delivery_location text, order_type text, scheduled_at timestamptz, payment_method text, cancel_reason text, cancelled_by text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.order_number, o.status, o.items, o.total, o.delivery_location, o.order_type, o.scheduled_at, o.payment_method, o.cancel_reason, o.cancelled_by, o.created_at
  FROM public.orders o WHERE o.order_number = upper(trim(_number)) LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.track_order(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_order_client(_number text, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.orders SET status = 'annulée', cancelled_by = 'client', cancel_reason = nullif(left(trim(coalesce(_reason,'')), 300), '')
  WHERE order_number = upper(trim(_number)) AND status = 'nouvelle';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN RAISE EXCEPTION 'Ta commande est déjà en préparation, contacte-nous au 99 84 85 22'; END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_order_client(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.order_number_of(_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT order_number FROM public.orders WHERE id = _id AND created_at > now() - interval '10 minutes'
$$;
GRANT EXECUTE ON FUNCTION public.order_number_of(uuid) TO anon, authenticated;