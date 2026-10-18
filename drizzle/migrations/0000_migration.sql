create type public.app_role as enum ('admin','user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- First account ever created becomes admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.handle_first_admin();

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer not null check (price >= 0),
  image_url text,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.dishes to anon, authenticated;
grant insert, update, delete on public.dishes to authenticated;
grant all on public.dishes to service_role;
alter table public.dishes enable row level security;
create policy "public reads published" on public.dishes for select to anon, authenticated using (published or public.has_role(auth.uid(),'admin'));
create policy "admin insert" on public.dishes for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin update" on public.dishes for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin delete" on public.dishes for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  delivery_time text not null,
  delivery_location text not null,
  payment_method text not null check (payment_method in ('mobile_money','cash')),
  note text,
  items jsonb not null,
  total integer not null,
  status text not null default 'nouvelle',
  created_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "admin read orders" on public.orders for select to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admin update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin'));
alter publication supabase_realtime add table public.orders;

create or replace function public.place_order(
  _customer_name text, _delivery_time text, _delivery_location text,
  _payment_method text, _note text, _items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _id uuid; _lines jsonb := '[]'::jsonb; _total integer := 0; it jsonb; d record; q integer;
begin
  if length(trim(coalesce(_customer_name,''))) = 0 or length(_customer_name) > 100 then raise exception 'Nom invalide'; end if;
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
  insert into public.orders(customer_name, delivery_time, delivery_location, payment_method, note, items, total)
  values (trim(_customer_name), trim(_delivery_time), trim(_delivery_location), _payment_method, nullif(trim(coalesce(_note,'')),''), _lines, _total)
  returning id into _id;
  return _id;
end $$;
grant execute on function public.place_order(text,text,text,text,text,jsonb) to anon, authenticated;

insert into public.dishes(name, price) values
 ('Riz sauce arachide', 1500),
 ('Akoumé sauce gombo', 1500),
 ('Poulet braisé & alloco', 2500),
 ('Spaghetti sautés', 1000);