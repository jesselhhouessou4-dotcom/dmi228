DROP POLICY IF EXISTS "public read extras" ON public.extras;
CREATE POLICY "public read available extras" ON public.extras FOR SELECT TO anon, authenticated
USING (is_available OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "public read settings" ON public.shop_settings;
CREATE POLICY "public read settings" ON public.shop_settings FOR SELECT TO anon, authenticated
USING (id = 1);