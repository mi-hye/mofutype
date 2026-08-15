truncate table public.groups cascade;

drop function public.create_group_and_join(text, text, text, text, text, jsonb);
drop function public.join_group(text, text, text, text, text, jsonb);
drop function public._profile_is_valid(text, text, text, jsonb);

alter table public.group_members
  drop constraint group_members_profile_payload_check,
  drop constraint group_members_animal_group_check,
  drop constraint group_members_animal_id_check,
  drop constraint group_members_mbti_check,
  drop column animal_id,
  drop column animal_group,
  add column zodiac_id text not null,
  add column profile_version integer not null;

drop type public.animal_group;

create function public._eto_profile_is_valid(
  p_zodiac_id text,
  p_mbti text,
  p_profile_payload jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_day_master jsonb;
  v_five_elements jsonb;
  v_yin_yang jsonb;
  v_element text;
  v_polarity text;
  v_mode text;
  v_boundary text;
  v_key text;
  v_value jsonb;
  v_five_total integer := 0;
  v_yin_yang_total integer := 0;
  v_expected_total integer;
begin
  if p_zodiac_id is null
     or p_zodiac_id not in (
       'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
       'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'
     )
     or (p_mbti is not null and p_mbti not in (
       'ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP',
       'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'
     ))
     or pg_catalog.jsonb_typeof(p_profile_payload) <> 'object' then
    return false;
  end if;

  v_day_master := p_profile_payload -> 'dayMaster';
  v_five_elements := p_profile_payload -> 'fiveElements';
  v_yin_yang := p_profile_payload -> 'yinYang';
  v_element := v_day_master ->> 'element';
  v_polarity := v_day_master ->> 'polarity';
  v_mode := p_profile_payload ->> 'calculationMode';
  v_boundary := p_profile_payload ->> 'boundaryState';

  if pg_catalog.jsonb_typeof(v_day_master) <> 'object'
     or v_element not in ('WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER')
     or v_polarity not in ('YIN', 'YANG')
     or v_day_master <> pg_catalog.jsonb_build_object(
       'element', v_element,
       'polarity', v_polarity
     )
     or v_mode not in ('date-only', 'date-time')
     or v_boundary not in ('exact', 'ambiguous') then
    return false;
  end if;

  if v_boundary = 'ambiguous' then
    if v_mode <> 'date-only'
       or v_five_elements <> 'null'::jsonb
       or v_yin_yang <> 'null'::jsonb then
      return false;
    end if;
  else
    if pg_catalog.jsonb_typeof(v_five_elements) <> 'object'
       or v_five_elements <> pg_catalog.jsonb_build_object(
         'WOOD', v_five_elements -> 'WOOD',
         'FIRE', v_five_elements -> 'FIRE',
         'EARTH', v_five_elements -> 'EARTH',
         'METAL', v_five_elements -> 'METAL',
         'WATER', v_five_elements -> 'WATER'
       )
       or pg_catalog.jsonb_typeof(v_yin_yang) <> 'object'
       or v_yin_yang <> pg_catalog.jsonb_build_object(
         'YIN', v_yin_yang -> 'YIN',
         'YANG', v_yin_yang -> 'YANG'
       ) then
      return false;
    end if;

    for v_key, v_value in
      select entry.key, entry.value
      from pg_catalog.jsonb_each(v_five_elements) as entry
    loop
      if pg_catalog.jsonb_typeof(v_value) <> 'number'
         or v_value::text !~ '^(0|[1-9][0-9]*)$'
         or pg_catalog.length(v_value::text) > 2 then
        return false;
      end if;
      v_five_total := v_five_total + v_value::text::integer;
    end loop;

    for v_key, v_value in
      select entry.key, entry.value
      from pg_catalog.jsonb_each(v_yin_yang) as entry
    loop
      if pg_catalog.jsonb_typeof(v_value) <> 'number'
         or v_value::text !~ '^(0|[1-9][0-9]*)$'
         or pg_catalog.length(v_value::text) > 2 then
        return false;
      end if;
      v_yin_yang_total := v_yin_yang_total + v_value::text::integer;
    end loop;

    v_expected_total := case v_mode when 'date-only' then 6 else 8 end;
    if v_five_total <> v_expected_total or v_yin_yang_total <> v_expected_total then
      return false;
    end if;
  end if;

  return coalesce(
    p_profile_payload = pg_catalog.jsonb_build_object(
      'version', 1,
      'zodiacId', p_zodiac_id,
      'mbti', p_mbti,
      'dayMaster', pg_catalog.jsonb_build_object(
        'element', v_element,
        'polarity', v_polarity
      ),
      'fiveElements', v_five_elements,
      'yinYang', v_yin_yang,
      'calculationMode', v_mode,
      'boundaryState', v_boundary,
      'engineVersion', 'mofu-eto-four-pillars-v1'
    ),
    false
  );
exception
  when others then
    return false;
end;
$$;

alter function public._eto_profile_is_valid(text, text, jsonb) owner to postgres;
revoke all on function public._eto_profile_is_valid(text, text, jsonb) from public, anon, authenticated;

alter table public.group_members
  add constraint group_members_zodiac_id_check check (zodiac_id in (
    'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
    'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'
  )),
  add constraint group_members_mbti_check check (mbti is null or mbti in (
    'ISTJ', 'ISFJ', 'INFJ', 'INTJ', 'ISTP', 'ISFP', 'INFP', 'INTP',
    'ESTP', 'ESFP', 'ENFP', 'ENTP', 'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ'
  )),
  add constraint group_members_profile_version_check check (profile_version = 1),
  add constraint group_members_profile_payload_check check (
    public._eto_profile_is_valid(zodiac_id, mbti, profile_payload)
    and profile_payload -> 'version' = pg_catalog.to_jsonb(profile_version)
  );

create function public.create_group_and_join(
  p_name text,
  p_nickname text,
  p_zodiac_id text,
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
  if v_nickname is null
     or pg_catalog.char_length(v_nickname) not between 1 and 20
     or not public._eto_profile_is_valid(p_zodiac_id, p_mbti, p_profile_payload) then
    raise exception using errcode = 'P0001', message = 'INVALID_PROFILE';
  end if;

  v_invite_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.groups(name, invite_token_hash, created_by)
  values (
    v_name,
    pg_catalog.encode(extensions.digest(v_invite_token, 'sha256'), 'hex'),
    v_user_id
  )
  returning id into v_group_id;

  insert into public.group_members(
    group_id, user_id, nickname, zodiac_id, mbti, profile_payload, profile_version
  )
  values (
    v_group_id, v_user_id, v_nickname, p_zodiac_id, p_mbti, p_profile_payload, 1
  )
  returning id into v_member_id;

  return query select v_group_id, v_member_id, v_invite_token;
end;
$$;

alter function public.create_group_and_join(text, text, text, text, jsonb) owner to postgres;
revoke all on function public.create_group_and_join(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_group_and_join(text, text, text, text, jsonb) to authenticated;

create function public.join_group(
  p_invite_token text,
  p_nickname text,
  p_zodiac_id text,
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
  if v_nickname is null
     or pg_catalog.char_length(v_nickname) not between 1 and 20
     or not public._eto_profile_is_valid(p_zodiac_id, p_mbti, p_profile_payload) then
    raise exception using errcode = 'P0001', message = 'INVALID_PROFILE';
  end if;

  select g.id into v_group_id
  from public.groups g
  where g.invite_token_hash = pg_catalog.encode(
    extensions.digest(p_invite_token, 'sha256'),
    'hex'
  )
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

  if (select pg_catalog.count(*) from public.group_members gm where gm.group_id = v_group_id) >= 30 then
    raise exception using errcode = 'P0001', message = 'GROUP_FULL';
  end if;

  insert into public.group_members(
    group_id, user_id, nickname, zodiac_id, mbti, profile_payload, profile_version
  )
  values (
    v_group_id, v_user_id, v_nickname, p_zodiac_id, p_mbti, p_profile_payload, 1
  )
  returning id into v_member_id;

  return query select v_group_id, v_member_id;
end;
$$;

alter function public.join_group(text, text, text, text, jsonb) owner to postgres;
revoke all on function public.join_group(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.join_group(text, text, text, text, jsonb) to authenticated;
