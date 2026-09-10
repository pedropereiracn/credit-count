-- 0003_functions.sql  Credit Count: the three elevated functions, and nothing more.
--
-- SECURITY DEFINER = runs with the privilege of whoever CREATED the function, not the caller.
-- That is, it ignores RLS. So the three rules below hold for all three:
--   1. `set search_path = ''` and every name schema-qualified. Without it, someone
--      puts a `profiles` table in their own schema and the function starts reading the fake one.
--   2. the body re-checks who is calling, because RLS will not check on its behalf.
--   3. `revoke all ... from public` BEFORE the grant. A new function is born executable
--      by `public`, and revoking only from anon and authenticated is the classic mistake.
--
-- If a fourth definer function ever exists, the 0005 audit breaks the build.

-- ---------------------------------------------------------------------------
-- 1. leaderboard()
--    THE RETURN TYPE IS THE LOCK. Three columns, and none of them can carry
--    which coaster anyone rode (FR7). There is no person parameter, so
--    "give me so-and-so's history" has no signature to be written into.
-- ---------------------------------------------------------------------------
create function public.leaderboard(page_size integer default 50, page_offset integer default 0)
returns table (rank integer, display_name text, credits integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- rank() computed INSIDE the set already filtered by show_on_leaderboard.
    -- If it were computed before the filter, a gap in the numbering (1, 2, 4) would reveal
    -- that someone hidden sits at position 3.
    rank() over (order by q.credits desc)::integer,
    q.display_name,
    q.credits
  from (
    select
      p.id,
      p.display_name,
      count(distinct r.coaster_id)::integer as credits
    from public.profiles p
    -- LEFT JOIN, not inner: FR7 says "for users who opted in", without requiring
    -- that they have ridden anything yet. Someone opted in with zero shows as zero.
    left join public.rides r on r.user_id = p.id
    where p.show_on_leaderboard
    group by p.id, p.display_name
  ) q
  -- tiebreak by name and then by id, so pagination does not repeat or skip a row
  order by q.credits desc, q.display_name, q.id
  -- the caller asks for the page size, the function sets the cap. No one rips
  -- the whole table out of a free-tier database in a single request.
  limit  least(greatest(coalesce(page_size, 50), 1), 100)
  offset greatest(coalesce(page_offset, 0), 0);
$$;

revoke all on function public.leaderboard(integer, integer) from public;
grant execute on function public.leaderboard(integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. handle_new_user()
--    Writes the profiles row that no client has permission to insert.
--    `role` is literal: form metadata never gets near it.
--    Callable by no one: PostgREST does not expose a function returning `trigger`,
--    and execute is revoked from `public`, which is the barrier that remains.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nome text;
begin
  -- order of attempts. Each step exists for a reason:
  nome := btrim(coalesce(new.raw_user_meta_data->>'display_name', ''));

  -- sign-up with no name (this is the OAuth case, if it ever arrives)
  if nome = '' then
    nome := btrim(coalesce(new.raw_user_meta_data->>'full_name', ''));
  end if;
  if nome = '' then
    nome := split_part(coalesce(new.email, ''), '@', 1);
  end if;

  -- truncate BEFORE trimming, never the other way: cutting at 40 can leave a trailing space,
  -- and the profiles_nome_aparado constraint would reject the row.
  nome := btrim(left(nome, 40));

  -- Safety net. Without it, a 1-character name blows the constraint INSIDE
  -- the trigger, and blowing up here returns no nice error: it takes down the whole sign-up.
  -- AC1 begins with "a new user can sign up", so this can never fail.
  if char_length(nome) < 2 then
    nome := 'rider_' || left(replace(new.id::text, '-', ''), 6);
  end if;

  insert into public.profiles (id, display_name, role, show_on_leaderboard)
  values (new.id, nome, 'enthusiast', false);
  --                     ^^^^^^^^^^^^ literal. It is this word that makes step 1
  --                     of the verification gate always come back as enthusiast.

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. merge_coasters()
--    Definer ignores RLS, so the body re-checks admin on the first line.
--    Returns ONE integer, how many rides moved: an aggregate over the catalogue,
--    never a person's name.
-- ---------------------------------------------------------------------------
create function public.merge_coasters(survivor uuid, loser uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  movidas       integer;
  nome_perdedor text;
begin
  -- is_admin() is invoker, but called in here it runs as the definer.
  -- This does NOT break the check: auth.uid() comes from the request JWT and does not change,
  -- so it keeps answering about who is really calling.
  if not public.is_admin() then
    raise exception 'only an admin may merge the catalogue' using errcode = '42501';
  end if;

  if survivor = loser then
    raise exception 'survivor and loser are the same coaster' using errcode = '22023';
  end if;

  select c.name into nome_perdedor from public.coasters c where c.id = loser;
  if nome_perdedor is null then
    raise exception 'the losing coaster does not exist' using errcode = '23503';
  end if;
  if not exists (select 1 from public.coasters where id = survivor) then
    raise exception 'the surviving coaster does not exist' using errcode = '23503';
  end if;

  -- Someone who rode BOTH ends up with two rides on the same coaster, and their credit
  -- drops from two to one. This is CORRECT: the duplicate was never two credits.
  -- It is also the only path by which an admin changes another person's total,
  -- and that is why the audit row below is not decoration.
  update public.rides set coaster_id = survivor where coaster_id = loser;
  get diagnostics movidas = row_count;

  delete from public.coasters where id = loser;

  insert into public.catalogue_audit
    (action, actor_id, survivor_id, loser_id, loser_name, rides_moved)
  values
    ('merge', (select auth.uid()), survivor, loser, nome_perdedor, movidas);

  return movidas;
end;
$$;

revoke all on function public.merge_coasters(uuid, uuid) from public;
grant execute on function public.merge_coasters(uuid, uuid) to authenticated;
