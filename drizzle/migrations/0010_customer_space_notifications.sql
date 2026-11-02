CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL DEFAULT '', usual_location text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(name, usual_location) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin profile read" ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE FUNCTION public.create_customer_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.profiles(id,name) VALUES(new.id,left(coalesce(new.raw_user_meta_data->>'name',new.raw_user_meta_data->>'full_name',''),100)) ON CONFLICT(id) DO NOTHING; RETURN new; END $$;
CREATE TRIGGER customer_profile_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_customer_profile();
INSERT INTO public.profiles(id,name) SELECT id,left(coalesce(raw_user_meta_data->>'name',raw_user_meta_data->>'full_name',''),100) FROM auth.users ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.orders ADD COLUMN user_id uuid;
CREATE INDEX orders_customer_idx ON public.orders(user_id,created_at DESC);
CREATE POLICY "customer own orders" ON public.orders FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.customer_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, order_id uuid REFERENCES public.orders(id), title text NOT NULL, message text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_notifications TO authenticated;
GRANT UPDATE(read_at) ON public.customer_notifications TO authenticated;
GRANT ALL ON public.customer_notifications TO service_role;
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.customer_notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "own notifications mark read" ON public.customer_notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE INDEX notifications_customer_idx ON public.customer_notifications(user_id,created_at DESC);
CREATE FUNCTION public.attach_order_customer() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN new.user_id:=auth.uid(); RETURN new; END $$;
CREATE TRIGGER attach_order_customer BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.attach_order_customer();
CREATE FUNCTION public.notify_customer_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE label text; BEGIN
 IF new.user_id IS NULL THEN RETURN new; END IF;
 IF TG_OP='UPDATE' THEN IF new.status IS NOT DISTINCT FROM old.status THEN RETURN new; END IF; END IF;
 label:=CASE new.status WHEN 'nouvelle' THEN 'Reçue' WHEN 'en_preparation' THEN 'En préparation' WHEN 'en_livraison' THEN 'En livraison' WHEN 'livrée' THEN 'Livrée' WHEN 'annulée' THEN 'Annulée' ELSE new.status END;
 INSERT INTO public.customer_notifications(user_id,order_id,title,message) VALUES(new.user_id,new.id,label,'Commande '||coalesce(new.order_number,'')||' : '||label||CASE WHEN new.status='annulée' AND new.cancelled_by='admin' THEN ' par notre équipe'||CASE WHEN nullif(new.cancel_reason,'') IS NOT NULL THEN ' — '||new.cancel_reason ELSE '' END ELSE '' END);
 RETURN new; END $$;
CREATE TRIGGER customer_order_notification AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_customer_order();
CREATE FUNCTION public.admin_customers() RETURNS TABLE(id uuid,name text,email text,usual_location text,created_at timestamptz,order_count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès interdit'; END IF;
 RETURN QUERY SELECT p.id,p.name,u.email::text,p.usual_location,p.created_at,(SELECT count(*) FROM public.orders o WHERE o.user_id=p.id) FROM public.profiles p JOIN auth.users u ON u.id=p.id ORDER BY p.created_at DESC; END $$;
REVOKE ALL ON FUNCTION public.admin_customers() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_customers() TO authenticated;
CREATE FUNCTION public.admin_broadcast(_title text,_message text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès interdit'; END IF;
 IF length(trim(_title)) NOT BETWEEN 1 AND 100 OR length(trim(_message)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Titre ou message invalide'; END IF;
 INSERT INTO public.customer_notifications(user_id,title,message) SELECT id,trim(_title),trim(_message) FROM public.profiles;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.admin_broadcast(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_broadcast(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.track_order(_number text) RETURNS TABLE(order_number text,status text,items jsonb,total integer,delivery_location text,order_type text,scheduled_at timestamptz,payment_method text,cancel_reason text,cancelled_by text,created_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT o.order_number,o.status,o.items,o.total,o.delivery_location,o.order_type,o.scheduled_at,o.payment_method,o.cancel_reason,o.cancelled_by,o.created_at FROM public.orders o WHERE o.order_number=upper(trim(_number)) AND (o.user_id IS NULL OR o.user_id=auth.uid() OR public.has_role(auth.uid(),'admin')) LIMIT 1 $$;
CREATE OR REPLACE FUNCTION public.cancel_order_client(_number text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n int; BEGIN
 UPDATE public.orders SET status='annulée',cancelled_by='client',cancel_reason=nullif(left(trim(coalesce(_reason,'')),300),'') WHERE order_number=upper(trim(_number)) AND status='nouvelle' AND (user_id IS NULL OR user_id=auth.uid());
 GET DIAGNOSTICS n=ROW_COUNT; IF n=0 THEN RAISE EXCEPTION 'Ta commande est déjà en préparation, contacte-nous au 99 84 85 22'; END IF; END $$;