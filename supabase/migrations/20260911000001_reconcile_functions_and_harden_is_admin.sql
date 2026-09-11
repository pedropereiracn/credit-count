-- 20260911000001_reconcile_functions_and_harden_is_admin.sql
--
-- Two fixes from the delivery-readiness review. Append-only: it never edits an
-- applied migration, it re-declares on top of them.
--
-- 1. The "English throughout" pass edited the already-applied dated migrations
--    (0001-0004) in place instead of appending a new one. The live database still
--    runs the pre-translation Portuguese bodies, so what the repository shows is no
--    longer byte-for-byte what runs in production (CLAUDE.md rule 10). This migration
--    reconciles production to the repository by re-declaring the four functions with
--    the exact English bodies from 0002 and 0003. The signatures, return types,
--    search_path and behaviour are identical: this is a text reconciliation only.
--
-- 2. The 0002 grant reset and the 20260910000002 hardening closed the default
--    anon/authenticated EXECUTE grant on the three SECURITY DEFINER functions, but
--    left is_admin() with the default grant. It is harmless today only because anon
--    has no SELECT on profiles, so the call dies with 401 before returning. A grant
--    that is safe only because of a second layer is luck, not design (the same
--    argument 20260910000002 makes about the views). Closed here, and checks.sql now
--    fails the build if anon can execute any function except leaderboard.

-- ---------------------------------------------------------------------------
-- is_admin(): SECURITY INVOKER, reads its own row under RLS.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- leaderboard(): THE RETURN TYPE IS THE LOCK. Three columns, none of which can
-- carry which coaster anyone rode (FR7). No person parameter.
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard(page_size integer default 50, page_offset integer default 0)
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

-- ---------------------------------------------------------------------------
-- handle_new_user(): writes the profiles row no client may insert. create or
-- replace keeps the on_auth_user_created trigger in place.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
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

-- ---------------------------------------------------------------------------
-- merge_coasters(): definer ignores RLS, so the body re-checks admin first.
-- Returns ONE integer (rides moved), never a person's name.
-- ---------------------------------------------------------------------------
create or replace function public.merge_coasters(survivor uuid, loser uuid)
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

-- ---------------------------------------------------------------------------
-- is_admin() grant: the fix of point 2 above. Mirror the hardening pattern:
-- revoke the default, then grant only to the role that needs it. Catalogue
-- policies call is_admin() as the authenticated caller, so authenticated keeps
-- execute; anon never touches an admin policy and loses it.
-- ---------------------------------------------------------------------------
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;
