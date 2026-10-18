alter table public.orders add column customer_phone text, add column customer_email text;

create or replace function public.place_order_v2(
  _customer_name text, _customer_phone text, _customer_email text, _delivery_time text, _delivery_location text,
  _payment_method text, _note text, _items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _id uuid; _lines jsonb := '[]'::jsonb; _total integer := 0; it jsonb; d record; q integer;
begin
  if length(trim(coalesce(_customer_name,''))) = 0 or length(_customer_name) > 100 then raise exception 'Nom invalide'; end if;
  if trim(coalesce(_customer_phone,'')) !~ '^\+?[0-9 ]{8,20}$' then raise exception 'Téléphone invalide'; end if;
  if nullif(trim(coalesce(_customer_email,'')),'') is not null and (length(_customer_email) > 255 or trim(_customer_email) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then raise exception 'E-mail invalide'; end if;
  if length(trim(coalesce(_delivery_time,''))) = 0 or length(_delivery_time) > 50 then raise exception 'Heure invalide'; end if;
  if length(trim(coalesce(_delivery_location,''))) = 0 or length(_delivery_location) > 300 then raise exception 'Lieu invalide'; end if;
  if _payment_method not in ('mobile_money','cash') then raise exception 'Paiement invalide'; end if;
  if length(coalesce(_note,'')) > 500 then raise exception 'Note trop longue'; end if;
  if jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 or jsonb_array_length(_items) > 50 then raise exception 'Panier invalide'; end if;
  for it in select * from jsonb_array_elements(_items) loop
    q := (it->>'quantity')::int;
    if q is null or q < 1 or q > 99 then raise exception 'Quantité invalide'; end if;
    select id, name, price into d from public.dishes where id = (it->>'dish_id')::uuid and published;
    if not found then raise exception 'Plat indisponible'; end if;
    _lines := _lines || jsonb_build_object('dish_id', d.id, 'name', d.name, 'price', d.price, 'quantity', q);
    _total := _total + d.price * q;
  end loop;
  insert into public.orders(customer_name, customer_phone, customer_email, delivery_time, delivery_location, payment_method, note, items, total)
  values (trim(_customer_name), trim(_customer_phone), nullif(lower(trim(coalesce(_customer_email,''))),''), trim(_delivery_time), trim(_delivery_location), _payment_method, nullif(trim(coalesce(_note,'')),''), _lines, _total)
  returning id into _id;
  return _id;
end $$;
grant execute on function public.place_order_v2(text,text,text,text,text,text,text,jsonb) to anon, authenticated;