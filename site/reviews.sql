-- Reviews for the ChatHup website. Run once in Supabase → SQL Editor.
-- Anyone may read and add a review; nobody can edit or delete through the API.
create table if not exists public.site_reviews (
  id         bigint generated always as identity primary key,
  name       text not null check (char_length(btrim(name)) between 1 and 40),
  rating     smallint not null check (rating between 1 and 5),
  body       text not null default '' check (char_length(body) <= 500),
  version    text not null default '' check (char_length(version) <= 20),
  created_at timestamptz not null default now()
);
create index if not exists site_reviews_created_at_idx on public.site_reviews (created_at desc);

alter table public.site_reviews enable row level security;

drop policy if exists "reviews are public" on public.site_reviews;
create policy "reviews are public" on public.site_reviews for select to anon, authenticated using (true);

drop policy if exists "anyone can add a review" on public.site_reviews;
create policy "anyone can add a review" on public.site_reviews for insert to anon, authenticated with check (true);

-- Clients only ever send these columns; id and created_at come from the server.
revoke all on public.site_reviews from anon, authenticated;
grant select on public.site_reviews to anon, authenticated;
grant insert (name, rating, body, version) on public.site_reviews to anon, authenticated;

-- Slow down floods: at most 20 new reviews per minute across the site.
create or replace function public.site_reviews_throttle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.site_reviews where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many reviews, try again shortly' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists site_reviews_throttle on public.site_reviews;
create trigger site_reviews_throttle before insert on public.site_reviews
  for each row execute function public.site_reviews_throttle();
