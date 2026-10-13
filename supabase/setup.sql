-- Orvella member database: profiles, events, bookings and favorites.
--
-- How to use: Supabase > SQL Editor > New query, paste this whole file, Run.
-- It is safe to run again (it only adds what is missing and refreshes the rules).
--
-- Who can see what (Row Level Security):
--   events     everyone can read (the public list of pop-ups)
--   profiles   each member reads only their own
--   bookings   each member reads only their own; nobody can add or change
--              bookings from a browser (only the site's server code can)
--   favorites  each member reads, adds and removes only their own

-- ---------- Profiles ----------
-- One row per account, kept in step with the sign-up details automatically.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
-- Email / text sign-up choices (from the sign-up and profile forms) and when they were last changed
alter table public.profiles add column if not exists email_opt_in boolean not null default false;
alter table public.profiles add column if not exists sms_opt_in boolean not null default false;
alter table public.profiles add column if not exists opt_in_at timestamptz;

-- ---------- Events ----------
-- id is the event page's name, e.g. 'sunrise-beach-pilates' for
-- events/sunrise-beach-pilates.html. starts_at is empty for "Coming soon" events.
create table if not exists public.events (
  id text primary key,
  title text not null,
  starts_at timestamptz,
  location text,
  image text,
  ticket_tailor_event_id text unique,
  created_at timestamptz not null default now()
);

-- ---------- Bookings ----------
-- Each booking belongs to an email. When someone with a confirmed account has
-- that email, it is linked to them (user_id) automatically, now or when they
-- sign up later. Bookings come from the admin page, the Sunrise mat map, and
-- later Ticket Tailor (source + ticket_tailor_order_id are ready for it).
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events (id) on update cascade,
  user_id uuid references auth.users (id) on delete set null,
  email text not null,
  name text,
  phone text,
  status text not null default 'booked' check (status in ('booked', 'attended', 'cancelled')),
  source text not null default 'manual' check (source in ('manual', 'mat_map', 'ticket_tailor')),
  ticket_tailor_order_id text unique,
  mat text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_user_id_idx on public.bookings (user_id);
create index if not exists bookings_email_idx on public.bookings (email);
create index if not exists bookings_event_id_idx on public.bookings (event_id);

-- ---------- Favorites ----------
create table if not exists public.favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id text not null references public.events (id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

-- ---------- Automatic linking ----------
create or replace function public.try_timestamptz(t text) returns timestamptz
language plpgsql immutable set search_path = '' as $$
begin
  return t::timestamptz;
exception when others then
  return null;
end $$;

-- Keep profiles in step with accounts, and link bookings to an account once its
-- email is confirmed (so nobody can claim bookings by signing up with someone
-- else's email).
create or replace function public.sync_account() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name, email, phone, email_opt_in, sms_opt_in, opt_in_at)
  values (new.id, new.raw_user_meta_data ->> 'first_name', new.email, new.raw_user_meta_data ->> 'phone',
          coalesce(new.raw_user_meta_data ->> 'email_opt_in', '') = 'true',
          coalesce(new.raw_user_meta_data ->> 'sms_opt_in', '') = 'true',
          public.try_timestamptz(new.raw_user_meta_data ->> 'opt_in_at'))
  on conflict (id) do update
    set first_name = excluded.first_name, email = excluded.email, phone = excluded.phone,
        email_opt_in = excluded.email_opt_in, sms_opt_in = excluded.sms_opt_in, opt_in_at = excluded.opt_in_at;

  if new.email_confirmed_at is not null then
    update public.bookings
      set user_id = new.id, updated_at = now()
      where user_id is null and lower(email) = lower(new.email);
  end if;
  return new;
end $$;

drop trigger if exists on_account_change on auth.users;
create trigger on_account_change
  after insert or update of email, email_confirmed_at, raw_user_meta_data on auth.users
  for each row execute function public.sync_account();

-- New or edited bookings: tidy the email and link it to a confirmed account.
create or replace function public.link_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.email := lower(trim(new.email));
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.email is distinct from lower(trim(old.email)) then
    new.user_id := null; -- email was corrected, so look the account up again
  end if;
  if new.user_id is null then
    select u.id into new.user_id from auth.users u
      where lower(u.email) = new.email and u.email_confirmed_at is not null
      limit 1;
  end if;
  return new;
end $$;

drop trigger if exists on_booking_save on public.bookings;
create trigger on_booking_save
  before insert or update on public.bookings
  for each row execute function public.link_booking();

-- Accounts that existed before this setup was run
insert into public.profiles (id, first_name, email, phone, email_opt_in, sms_opt_in, opt_in_at)
  select id, raw_user_meta_data ->> 'first_name', email, raw_user_meta_data ->> 'phone',
         coalesce(raw_user_meta_data ->> 'email_opt_in', '') = 'true',
         coalesce(raw_user_meta_data ->> 'sms_opt_in', '') = 'true',
         public.try_timestamptz(raw_user_meta_data ->> 'opt_in_at')
  from auth.users
  on conflict (id) do nothing;

-- ---------- Who can see what ----------
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.bookings enable row level security;
alter table public.favorites enable row level security;

revoke all on public.profiles, public.events, public.bookings, public.favorites from anon, authenticated;
grant select on public.events to anon, authenticated;
grant select on public.profiles to authenticated;
grant select on public.bookings to authenticated;
grant select, insert, delete on public.favorites to authenticated;

drop policy if exists "Events are public" on public.events;
create policy "Events are public" on public.events
  for select to anon, authenticated using (true);

drop policy if exists "Members see their own profile" on public.profiles;
create policy "Members see their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Members see their own bookings" on public.bookings;
create policy "Members see their own bookings" on public.bookings
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Members see their own favorites" on public.favorites;
create policy "Members see their own favorites" on public.favorites
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Members add their own favorites" on public.favorites;
create policy "Members add their own favorites" on public.favorites
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Members remove their own favorites" on public.favorites;
create policy "Members remove their own favorites" on public.favorites
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- The pop-ups on the site today ----------
-- Times are stored in UTC: Sat Nov 7 2026, 7:00 AM Eastern = 12:00 UTC.
insert into public.events (id, title, starts_at, location) values
  ('sunrise-beach-pilates', 'Sunrise Beach Pilates', '2026-11-07 12:00:00+00', 'Location announced soon'),
  ('matcha-and-pilates', 'Matcha & Pilates', null, null),
  ('pilates-petals-and-mocktails', 'Pilates, Petals & Mocktails', null, null),
  ('sunset-rooftop-pilates', 'Sunset Rooftop Pilates & Live DJ', null, null)
on conflict (id) do nothing;
