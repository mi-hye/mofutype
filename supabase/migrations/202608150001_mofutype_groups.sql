create extension if not exists pgcrypto with schema extensions;

create type public.animal_group as enum ('MOON', 'EARTH', 'SUN');
create type public.unlock_status as enum ('pending', 'unlocked', 'failed');

create table public.groups (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 30),
  invite_token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  max_members integer not null default 30 check (max_members = 30),
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (nickname = btrim(nickname) and char_length(nickname) between 1 and 20),
  animal_id text not null check (animal_id in (
    'fawn', 'raccoon', 'black-panther', 'sheep',
    'wolf', 'monkey', 'tiger', 'koala',
    'cheetah', 'lion', 'elephant', 'pegasus'
  )),
  animal_group public.animal_group not null,
  mbti text check (mbti is null or mbti in (
    'ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP',
    'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'
  )),
  profile_payload jsonb not null constraint group_members_profile_payload_check check (coalesce(
    jsonb_typeof(profile_payload) = 'object'
    and profile_payload ->> 'calculationMode' is not null
    and profile_payload = jsonb_build_object(
      'version', 1,
      'animalId', animal_id,
      'animalGroup', animal_group::text,
      'mbti', mbti,
      'calculationMode', profile_payload ->> 'calculationMode'
    )
    and profile_payload ->> 'calculationMode' in ('date-time', 'date-only'),
    false
  )),
  joined_at timestamptz not null default now(),
  constraint group_members_animal_group_check check (
    animal_id not in (
      'fawn', 'raccoon', 'black-panther', 'sheep',
      'wolf', 'monkey', 'tiger', 'koala',
      'cheetah', 'lion', 'elephant', 'pegasus'
    )
    or (animal_id in ('fawn', 'raccoon', 'black-panther', 'sheep') and animal_group = 'MOON')
    or (animal_id in ('wolf', 'monkey', 'tiger', 'koala') and animal_group = 'EARTH')
    or (animal_id in ('cheetah', 'lion', 'elephant', 'pegasus') and animal_group = 'SUN')
  ),
  constraint group_members_group_user_key unique (group_id, user_id),
  constraint group_members_group_id_id_key unique (group_id, id)
);

create table public.relation_unlocks (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  member_low_id uuid not null,
  member_high_id uuid not null,
  status public.unlock_status not null default 'pending',
  payment_provider text not null,
  payment_reference text,
  unlocked_by uuid not null references auth.users(id),
  unlocked_at timestamptz,
  constraint relation_unlocks_ordered_pair_check check (member_low_id < member_high_id),
  constraint relation_unlocks_group_pair_key unique (group_id, member_low_id, member_high_id),
  constraint relation_unlocks_low_member_fk foreign key (group_id, member_low_id)
    references public.group_members(group_id, id) on delete cascade,
  constraint relation_unlocks_high_member_fk foreign key (group_id, member_high_id)
    references public.group_members(group_id, id) on delete cascade
);

create index group_members_user_id_idx on public.group_members(user_id);
create index group_members_group_joined_at_idx on public.group_members(group_id, joined_at);
create index relation_unlocks_group_status_idx on public.relation_unlocks(group_id, status);
create index relation_unlocks_low_member_idx on public.relation_unlocks(member_low_id);
create index relation_unlocks_high_member_idx on public.relation_unlocks(member_high_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.relation_unlocks enable row level security;

create function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
  );
$$;

alter function public.is_group_member(uuid) owner to postgres;
revoke all on function public.is_group_member(uuid) from public, anon, authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;

create policy groups_member_select
on public.groups for select
to authenticated
using (public.is_group_member(id));

create policy group_members_member_select
on public.group_members for select
to authenticated
using (public.is_group_member(group_id));

create policy relation_unlocks_member_select
on public.relation_unlocks for select
to authenticated
using (public.is_group_member(group_id));

grant select on public.groups, public.group_members, public.relation_unlocks to authenticated;
grant select on public.groups to service_role;
grant insert on public.group_members to service_role;
revoke insert, update, delete, truncate, references, trigger
  on public.groups, public.group_members, public.relation_unlocks
  from anon, authenticated;

create function public._profile_is_valid(
  p_animal_id text,
  p_animal_group text,
  p_mbti text,
  p_profile_payload jsonb
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(
    case p_animal_group
      when 'MOON' then p_animal_id in ('fawn', 'raccoon', 'black-panther', 'sheep')
      when 'EARTH' then p_animal_id in ('wolf', 'monkey', 'tiger', 'koala')
      when 'SUN' then p_animal_id in ('cheetah', 'lion', 'elephant', 'pegasus')
      else false
    end
    and (p_mbti is null or p_mbti in (
      'ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP',
      'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'
    ))
    and pg_catalog.jsonb_typeof(p_profile_payload) = 'object'
    and p_profile_payload = pg_catalog.jsonb_build_object(
      'version', 1,
      'animalId', p_animal_id,
      'animalGroup', p_animal_group,
      'mbti', p_mbti,
      'calculationMode', p_profile_payload ->> 'calculationMode'
    )
    and p_profile_payload ->> 'calculationMode' in ('date-time', 'date-only'),
    false
  );
$$;

alter function public._profile_is_valid(text, text, text, jsonb) owner to postgres;
revoke all on function public._profile_is_valid(text, text, text, jsonb) from public, anon, authenticated;

create function public.create_group_and_join(
  p_name text,
  p_nickname text,
  p_animal_id text,
  p_animal_group text,
  p_mbti text,
  p_profile_payload jsonb
)
returns table(group_id uuid, member_id uuid, invite_token text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_member_id uuid;
  v_invite_token text;
  v_name text := pg_catalog.btrim(p_name);
  v_nickname text := pg_catalog.btrim(p_nickname);
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if v_name is null or pg_catalog.char_length(v_name) not between 1 and 30 then
    raise exception using errcode = 'P0001', message = 'INVALID_PROFILE';
  end if;
  if v_nickname is null or pg_catalog.char_length(v_nickname) not between 1 and 20
     or not public._profile_is_valid(p_animal_id, p_animal_group, p_mbti, p_profile_payload) then
    raise exception using errcode = 'P0001', message = 'INVALID_PROFILE';
  end if;

  v_invite_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.groups(name, invite_token_hash, created_by)
  values (v_name, pg_catalog.encode(extensions.digest(v_invite_token, 'sha256'), 'hex'), v_user_id)
  returning id into v_group_id;

  insert into public.group_members(group_id, user_id, nickname, animal_id, animal_group, mbti, profile_payload)
  values (v_group_id, v_user_id, v_nickname, p_animal_id, p_animal_group::public.animal_group, p_mbti, p_profile_payload)
  returning id into v_member_id;

  return query select v_group_id, v_member_id, v_invite_token;
end;
$$;

alter function public.create_group_and_join(text, text, text, text, text, jsonb) owner to postgres;
revoke all on function public.create_group_and_join(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_group_and_join(text, text, text, text, text, jsonb) to authenticated;

create function public.join_group(
  p_invite_token text,
  p_nickname text,
  p_animal_id text,
  p_animal_group text,
  p_mbti text,
  p_profile_payload jsonb
)
returns table(group_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_member_id uuid;
  v_nickname text := pg_catalog.btrim(p_nickname);
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if p_invite_token is null or p_invite_token = '' then
    raise exception using errcode = 'P0001', message = 'INVALID_INVITE';
  end if;
  if v_nickname is null or pg_catalog.char_length(v_nickname) not between 1 and 20
     or not public._profile_is_valid(p_animal_id, p_animal_group, p_mbti, p_profile_payload) then
    raise exception using errcode = 'P0001', message = 'INVALID_PROFILE';
  end if;

  select g.id into v_group_id
  from public.groups g
  where g.invite_token_hash = pg_catalog.encode(extensions.digest(p_invite_token, 'sha256'), 'hex')
  for update;

  if v_group_id is null then
    raise exception using errcode = 'P0001', message = 'INVALID_INVITE';
  end if;

  select gm.id into v_member_id
  from public.group_members gm
  where gm.group_id = v_group_id and gm.user_id = v_user_id;
  if v_member_id is not null then
    return query select v_group_id, v_member_id;
    return;
  end if;

  if (select count(*) from public.group_members gm where gm.group_id = v_group_id) >= 30 then
    raise exception using errcode = 'P0001', message = 'GROUP_FULL';
  end if;

  insert into public.group_members(group_id, user_id, nickname, animal_id, animal_group, mbti, profile_payload)
  values (v_group_id, v_user_id, v_nickname, p_animal_id, p_animal_group::public.animal_group, p_mbti, p_profile_payload)
  returning id into v_member_id;
  return query select v_group_id, v_member_id;
end;
$$;

alter function public.join_group(text, text, text, text, text, jsonb) owner to postgres;
revoke all on function public.join_group(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.join_group(text, text, text, text, text, jsonb) to authenticated;

create function public.unlock_relation_mock(p_group_id uuid, p_member_a uuid, p_member_b uuid)
returns setof public.relation_unlocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_low uuid;
  v_high uuid;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception using errcode = 'P0001', message = 'FORBIDDEN';
  end if;
  if p_member_a is null or p_member_b is null or p_member_a = p_member_b then
    raise exception using errcode = 'P0001', message = 'INVALID_PAIR';
  end if;

  v_low := least(p_member_a, p_member_b);
  v_high := greatest(p_member_a, p_member_b);
  if (select count(*) from public.group_members gm
      where gm.group_id = p_group_id and gm.id in (v_low, v_high)) <> 2 then
    raise exception using errcode = 'P0001', message = 'INVALID_PAIR';
  end if;

  insert into public.relation_unlocks(
    group_id, member_low_id, member_high_id, status,
    payment_provider, payment_reference, unlocked_by, unlocked_at
  ) values (
    p_group_id, v_low, v_high, 'unlocked', 'mock', null, v_user_id, pg_catalog.now()
  )
  on conflict (group_id, member_low_id, member_high_id) do nothing;

  return query
  select ru.*
  from public.relation_unlocks ru
  where ru.group_id = p_group_id
    and ru.member_low_id = v_low
    and ru.member_high_id = v_high;
end;
$$;

alter function public.unlock_relation_mock(uuid, uuid, uuid) owner to postgres;
revoke all on function public.unlock_relation_mock(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.unlock_relation_mock(uuid, uuid, uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_members'
  ) then
    alter publication supabase_realtime add table public.group_members;
  end if;
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'relation_unlocks'
  ) then
    alter publication supabase_realtime add table public.relation_unlocks;
  end if;
end;
$$;
