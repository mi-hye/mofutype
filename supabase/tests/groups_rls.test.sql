begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(224);

-- Schema and API contract.
select tables_are(
  'public',
  array['groups', 'group_members', 'payment_orders', 'relation_unlocks'],
  'public has exactly the four product tables'
);
select has_type('public', 'unlock_status', 'unlock_status enum exists');
select enum_has_labels('public', 'unlock_status', array['pending', 'unlocked', 'failed'], 'unlock_status labels are exact');
select hasnt_type('public', 'animal_group', 'animal_group enum is removed');
select hasnt_column('public', 'group_members', 'animal_id', 'animal_id is removed');
select hasnt_column('public', 'group_members', 'animal_group', 'animal_group is removed');
select has_column('public', 'group_members', 'zodiac_id', 'zodiac_id exists');
select has_column('public', 'group_members', 'mbti', 'mbti exists');
select has_column('public', 'group_members', 'profile_payload', 'profile_payload exists');
select has_column('public', 'group_members', 'profile_version', 'profile_version exists');
select columns_are(
  'public',
  'group_members',
  array['id','group_id','user_id','nickname','mbti','profile_payload','joined_at','zodiac_id','profile_version'],
  'group_members columns are exact after the destructive reset'
);
select col_not_null('public', 'group_members', 'zodiac_id', 'zodiac_id is required');
select col_not_null('public', 'group_members', 'profile_payload', 'profile_payload is required');
select col_not_null('public', 'group_members', 'profile_version', 'profile_version is required');
select has_function('public', '_eto_profile_is_valid', array['text','text','jsonb'], 'eto profile validator exists');
select has_function('public', 'create_group_and_join', array['text','text','text','text','jsonb'], 'create RPC has only eto profile arguments');
select has_function('public', 'join_group', array['text','text','text','text','jsonb'], 'join RPC has only eto profile arguments');
select has_function('public', 'get_group_invite_preview', array['text'], 'invite preview RPC is preserved');
select has_function('public', 'unlock_relation_mock', array['uuid','uuid','uuid'], 'mock unlock RPC is preserved');
select is(
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'create_group_and_join'),
  1::bigint,
  'there is exactly one create RPC overload'
);
select is(
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname = 'join_group'),
  1::bigint,
  'there is exactly one join RPC overload'
);
select hasnt_function('public', '_profile_is_valid', array['text','text','text','jsonb'], 'old animal validator is removed');

select is((select prosecdef from pg_proc where oid = 'public._eto_profile_is_valid(text,text,jsonb)'::regprocedure), true, 'validator is security definer');
select is((select proconfig from pg_proc where oid = 'public._eto_profile_is_valid(text,text,jsonb)'::regprocedure), array['search_path=""']::text[], 'validator fixes an empty search path');
select is((select pg_get_userbyid(proowner) from pg_proc where oid = 'public._eto_profile_is_valid(text,text,jsonb)'::regprocedure), 'postgres', 'validator is owned by postgres');
select is((select prosecdef from pg_proc where oid = 'public.create_group_and_join(text,text,text,text,jsonb)'::regprocedure), true, 'create RPC is security definer');
select is((select proconfig from pg_proc where oid = 'public.create_group_and_join(text,text,text,text,jsonb)'::regprocedure), array['search_path=""']::text[], 'create RPC fixes an empty search path');
select is((select pg_get_userbyid(proowner) from pg_proc where oid = 'public.create_group_and_join(text,text,text,text,jsonb)'::regprocedure), 'postgres', 'create RPC is owned by postgres');
select is((select prosecdef from pg_proc where oid = 'public.join_group(text,text,text,text,jsonb)'::regprocedure), true, 'join RPC is security definer');
select is((select proconfig from pg_proc where oid = 'public.join_group(text,text,text,text,jsonb)'::regprocedure), array['search_path=""']::text[], 'join RPC fixes an empty search path');
select is((select pg_get_userbyid(proowner) from pg_proc where oid = 'public.join_group(text,text,text,text,jsonb)'::regprocedure), 'postgres', 'join RPC is owned by postgres');
select is((select prosecdef from pg_proc where oid = 'public.get_group_invite_preview(text)'::regprocedure), true, 'invite preview remains security definer');
select is((select proconfig from pg_proc where oid = 'public.get_group_invite_preview(text)'::regprocedure), array['search_path=""']::text[], 'invite preview keeps an empty search path');
select is((select pg_get_userbyid(proowner) from pg_proc where oid = 'public.get_group_invite_preview(text)'::regprocedure), 'postgres', 'invite preview remains owned by postgres');
select is((select prosecdef from pg_proc where oid = 'public.unlock_relation_mock(uuid,uuid,uuid)'::regprocedure), true, 'unlock RPC remains security definer');
select is((select proconfig from pg_proc where oid = 'public.unlock_relation_mock(uuid,uuid,uuid)'::regprocedure), array['search_path=""']::text[], 'unlock RPC keeps an empty search path');
select is((select pg_get_userbyid(proowner) from pg_proc where oid = 'public.unlock_relation_mock(uuid,uuid,uuid)'::regprocedure), 'postgres', 'unlock RPC remains owned by postgres');
select ok(pg_catalog.strpos(pg_catalog.upper(pg_get_functiondef('public.join_group(text,text,text,text,jsonb)'::regprocedure)), 'FOR UPDATE') > 0, 'join locks the group row before capacity checks');

select ok((select relrowsecurity from pg_class where oid = 'public.groups'::regclass), 'groups has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.group_members'::regclass), 'group_members has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.relation_unlocks'::regclass), 'relation_unlocks has RLS enabled');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.groups'::regclass and contype = 'u' and conkey = array[(select attnum from pg_attribute where attrelid = 'public.groups'::regclass and attname = 'invite_token_hash')]::smallint[]), 'invite digest is unique');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.group_members'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (group_id, user_id)'), 'membership is unique per group and user');
select ok(exists(select 1 from pg_constraint where conrelid = 'public.relation_unlocks'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (group_id, member_low_id, member_high_id)'), 'unlock is unique per canonical pair');
select ok(not exists(select 1 from information_schema.columns where table_schema = 'public' and table_name = 'groups' and column_name = 'invite_token'), 'raw invite tokens are never stored');
-- Exact privileges.
select ok(has_function_privilege('authenticated', 'public.create_group_and_join(text,text,text,text,jsonb)', 'EXECUTE'), 'authenticated can execute create RPC');
select ok(not has_function_privilege('anon', 'public.create_group_and_join(text,text,text,text,jsonb)', 'EXECUTE'), 'anon cannot execute create RPC');
select ok(not has_function_privilege('public', 'public.create_group_and_join(text,text,text,text,jsonb)', 'EXECUTE'), 'public cannot execute create RPC');
select ok(has_function_privilege('authenticated', 'public.join_group(text,text,text,text,jsonb)', 'EXECUTE'), 'authenticated can execute join RPC');
select ok(not has_function_privilege('anon', 'public.join_group(text,text,text,text,jsonb)', 'EXECUTE'), 'anon cannot execute join RPC');
select ok(not has_function_privilege('public', 'public.join_group(text,text,text,text,jsonb)', 'EXECUTE'), 'public cannot execute join RPC');
select ok(not has_function_privilege('authenticated', 'public._eto_profile_is_valid(text,text,jsonb)', 'EXECUTE'), 'authenticated cannot execute validator');
select ok(not has_function_privilege('anon', 'public._eto_profile_is_valid(text,text,jsonb)', 'EXECUTE'), 'anon cannot execute validator');
select ok(not has_function_privilege('public', 'public._eto_profile_is_valid(text,text,jsonb)', 'EXECUTE'), 'public cannot execute validator');
select ok(has_function_privilege('service_role', 'public._eto_profile_is_valid(text,text,jsonb)', 'EXECUTE'), 'service role can execute validator for table checks');
select ok(has_function_privilege('authenticated', 'public.get_group_invite_preview(text)', 'EXECUTE'), 'authenticated can execute invite preview');
select ok(not has_function_privilege('anon', 'public.get_group_invite_preview(text)', 'EXECUTE'), 'anon cannot execute invite preview');
select ok(not has_function_privilege('public', 'public.get_group_invite_preview(text)', 'EXECUTE'), 'public cannot execute invite preview');
select ok(has_function_privilege('authenticated', 'public.unlock_relation_mock(uuid,uuid,uuid)', 'EXECUTE'), 'authenticated can execute unlock RPC');
select ok(not has_function_privilege('anon', 'public.unlock_relation_mock(uuid,uuid,uuid)', 'EXECUTE'), 'anon cannot execute unlock RPC');
select ok(not has_function_privilege('public', 'public.unlock_relation_mock(uuid,uuid,uuid)', 'EXECUTE'), 'public cannot execute unlock RPC');
select ok(has_table_privilege('service_role', 'public.groups', 'SELECT'), 'service role keeps groups select for local E2E');
select ok(has_table_privilege('service_role', 'public.group_members', 'INSERT'), 'service role keeps member insert for local E2E');

-- The validator accepts every exact zodiac and MBTI value.
select ok(
  public._eto_profile_is_valid(
    zodiac_id,
    'INFP',
    jsonb_build_object(
      'version', 1, 'zodiacId', zodiac_id, 'mbti', 'INFP',
      'dayMaster', jsonb_build_object('element', 'WOOD', 'polarity', 'YANG'),
      'fiveElements', jsonb_build_object('WOOD', 2, 'FIRE', 1, 'EARTH', 1, 'METAL', 1, 'WATER', 1),
      'yinYang', jsonb_build_object('YIN', 3, 'YANG', 3),
      'calculationMode', 'date-only', 'boundaryState', 'exact',
      'engineVersion', 'mofu-eto-four-pillars-v1'
    )
  ),
  zodiac_id || ' zodiac is accepted'
)
from unnest(array['rat','ox','tiger','rabbit','dragon','snake','horse','sheep','monkey','rooster','dog','boar']) zodiac_id;

select ok(
  public._eto_profile_is_valid(
    'dragon',
    mbti,
    jsonb_build_object(
      'version', 1, 'zodiacId', 'dragon', 'mbti', mbti,
      'dayMaster', jsonb_build_object('element', 'WOOD', 'polarity', 'YANG'),
      'fiveElements', jsonb_build_object('WOOD', 2, 'FIRE', 1, 'EARTH', 1, 'METAL', 1, 'WATER', 1),
      'yinYang', jsonb_build_object('YIN', 3, 'YANG', 3),
      'calculationMode', 'date-only', 'boundaryState', 'exact',
      'engineVersion', 'mofu-eto-four-pillars-v1'
    )
  ),
  coalesce(mbti, 'NULL') || ' MBTI is accepted'
)
from unnest(array['ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP','ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ',null]::text[]) mbti;

select ok(public._eto_profile_is_valid(
  'dragon', 'INFP',
  '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":2,"EARTH":1,"METAL":2,"WATER":1},"yinYang":{"YIN":4,"YANG":4},"calculationMode":"date-time","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb
), 'date-time profile with totals of eight is accepted');
select ok(public._eto_profile_is_valid(
  'dragon', null,
  '{"version":1,"zodiacId":"dragon","mbti":null,"dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":null,"yinYang":null,"calculationMode":"date-only","boundaryState":"solar-term-ambiguous","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb
), 'solar-term-ambiguous date-only profile accepts both null distributions');
select ok(public._eto_profile_is_valid(
  'sheep', null,
  '{"version":1,"zodiacId":"sheep","mbti":null,"dayMaster":{"element":"EARTH","polarity":"YIN"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":2,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb
), 'helper accepts sheep vocabulary');
select ok(public._eto_profile_is_valid(
  'boar', null,
  '{"version":1,"zodiacId":"boar","mbti":null,"dayMaster":{"element":"WATER","polarity":"YIN"},"fiveElements":null,"yinYang":null,"calculationMode":"date-only","boundaryState":"solar-term-ambiguous","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb
), 'helper accepts boar with the exact ambiguous boundary vocabulary');

-- Invalid validator cases return false, including malformed values that must never leak native casts.
select is(public._eto_profile_is_valid(zodiac_id, mbti, payload), false, description)
from (values
  ('cat', 'INFP', '{"version":1,"zodiacId":"cat","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'unknown lowercase zodiac is rejected'),
  ('goat', null, '{"version":1,"zodiacId":"goat","mbti":null,"dayMaster":{"element":"EARTH","polarity":"YIN"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":2,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'legacy goat zodiac is rejected'),
  ('pig', null, '{"version":1,"zodiacId":"pig","mbti":null,"dayMaster":{"element":"WATER","polarity":"YIN"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":1,"METAL":1,"WATER":2},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'legacy pig zodiac is rejected'),
  ('Dragon', 'INFP', '{"version":1,"zodiacId":"Dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'uppercase zodiac is rejected'),
  ('dragon', 'infp', '{"version":1,"zodiacId":"dragon","mbti":"infp","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'lowercase MBTI is rejected'),
  ('dragon', 'XXXX', '{"version":1,"zodiacId":"dragon","mbti":"XXXX","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'invalid MBTI is rejected'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"rat","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'payload zodiac must equal scalar zodiac'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":null,"dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'payload MBTI must equal scalar MBTI'),
  ('dragon', 'INFP', '{"version":2,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'version must be exactly one'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"wrong"}'::jsonb, 'engine version is exact'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"approximate","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'calculation mode is exact'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"maybe","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'boundary state is exact'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"wood","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'day master element is exact'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"yang"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'day master polarity is exact'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG","extra":1},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'day master keys are exact'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'five element keys are exact'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":6,"YANG":0,"EXTRA":0},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'yin yang keys are exact'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":-1,"FIRE":2,"EARTH":2,"METAL":2,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'negative count is rejected'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":1.5,"FIRE":1.5,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'fractional count is rejected'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":"two","FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'string count returns false without a cast error'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":1e100000,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'huge numeric count returns false without leaking a cast error'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'date-only element total must be six'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":4,"YANG":4},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'date-only yin yang total must be six'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":2,"EARTH":1,"METAL":2,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-time","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'date-time yin yang total must be eight'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":null,"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"solar-term-ambiguous","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'ambiguous distributions must both be null'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":null,"calculationMode":"date-only","boundaryState":"solar-term-ambiguous","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'ambiguous reverse one-null distribution is rejected'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":null,"yinYang":null,"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'exact profiles cannot have null distributions'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"solar-term-ambiguous","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'ambiguous profiles cannot include counts'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":null,"yinYang":null,"calculationMode":"date-time","boundaryState":"solar-term-ambiguous","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'ambiguous date-time profiles are rejected'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":null,"yinYang":null,"calculationMode":"date-only","boundaryState":"ambiguous","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb, 'legacy plain ambiguous boundary is rejected'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1","birthDate":"2000-01-01"}'::jsonb, 'birthDate is rejected as an extra key'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1","birth_time":"12:00"}'::jsonb, 'birth_time is rejected as an extra key'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1","dob":"2000-01-01"}'::jsonb, 'dob is rejected as an extra key'),
  ('dragon', 'INFP', '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1","time":"12:00"}'::jsonb, 'time is rejected as an extra key')
) invalid(zodiac_id, mbti, payload, description);

-- Roles cannot bypass RPCs or table writes.
set local role anon;
select throws_ok($$select * from public.create_group_and_join('Team','Owner','dragon','INFP','{}'::jsonb)$$, '42501', 'permission denied for function create_group_and_join', 'anon cannot execute create RPC');
select throws_ok($$select * from public.join_group('token','Joiner','dragon','INFP','{}'::jsonb)$$, '42501', 'permission denied for function join_group', 'anon cannot execute join RPC');
select throws_ok($$select * from public.get_group_invite_preview(repeat('a',64))$$, '42501', 'permission denied for function get_group_invite_preview', 'anon cannot execute invite preview RPC');
select throws_ok($$select * from public.unlock_relation_mock('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012')$$, '42501', 'permission denied for function unlock_relation_mock', 'anon cannot execute unlock RPC');
select throws_ok(statement, '42501', 'permission denied for table ' || table_name, 'anon direct ' || operation || ' denied on ' || table_name)
from (values
  ('groups','INSERT','insert into public.groups default values'), ('groups','UPDATE','update public.groups set name=name'), ('groups','DELETE','delete from public.groups'),
  ('group_members','INSERT','insert into public.group_members default values'), ('group_members','UPDATE','update public.group_members set nickname=nickname'), ('group_members','DELETE','delete from public.group_members'),
  ('relation_unlocks','INSERT','insert into public.relation_unlocks default values'), ('relation_unlocks','UPDATE','update public.relation_unlocks set status=status'), ('relation_unlocks','DELETE','delete from public.relation_unlocks')
) denied(table_name, operation, statement);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select throws_ok(statement, '42501', 'permission denied for table ' || table_name, 'authenticated direct ' || operation || ' denied on ' || table_name)
from (values
  ('groups','INSERT','insert into public.groups default values'), ('groups','UPDATE','update public.groups set name=name'), ('groups','DELETE','delete from public.groups'),
  ('group_members','INSERT','insert into public.group_members default values'), ('group_members','UPDATE','update public.group_members set nickname=nickname'), ('group_members','DELETE','delete from public.group_members'),
  ('relation_unlocks','INSERT','insert into public.relation_unlocks default values'), ('relation_unlocks','UPDATE','update public.relation_unlocks set status=status'), ('relation_unlocks','DELETE','delete from public.relation_unlocks')
) denied(table_name, operation, statement);
reset role;

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
select id, 'authenticated', 'authenticated', email, '', now(), now()
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'creator@example.test'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'joiner@example.test'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'outsider@example.test'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'other-owner@example.test')
) users(id, email);

select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select * from public.create_group_and_join('Team','Owner','bad','bad','{}'::jsonb)$$, 'P0001', 'UNAUTHENTICATED', 'create checks auth before validation');
select throws_ok($$select * from public.join_group('missing','Joiner','bad','bad','{}'::jsonb)$$, 'P0001', 'UNAUTHENTICATED', 'join checks auth before validation');
select throws_ok($$select * from public.unlock_relation_mock('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012')$$, 'P0001', 'UNAUTHENTICATED', 'unlock keeps stable unauthenticated error');
set local role authenticated;
select throws_ok($$select * from public.get_group_invite_preview(repeat('a',64))$$, 'P0001', 'UNAUTHENTICATED', 'invite preview keeps stable unauthenticated body error');
reset role;

create temporary table created_group(group_id uuid, member_id uuid, invite_token text);
grant select, insert on created_group to authenticated;
grant select on created_group to service_role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into created_group
select * from public.create_group_and_join(
  '  Best Friends  ', '  Owner  ', 'dragon', 'INFP',
  '{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb
);
reset role;

select is((select name from public.groups where id=(select group_id from created_group)), 'Best Friends', 'create trims group name');
select is((select nickname from public.group_members where id=(select member_id from created_group)), 'Owner', 'create trims nickname');
select is((select zodiac_id from public.group_members where id=(select member_id from created_group)), 'dragon', 'create stores zodiac scalar');
select is((select profile_version from public.group_members where id=(select member_id from created_group)), 1, 'create stores profile version scalar');
select is(length((select invite_token from created_group)), 64, 'create returns 32 random bytes as hex');
select is((select invite_token_hash from public.groups where id=(select group_id from created_group)), encode(extensions.digest((select invite_token from created_group), 'sha256'), 'hex'), 'only the SHA256 invite digest is stored');
select is((select max_members from public.groups where id=(select group_id from created_group)), 30, 'group max remains fixed at 30');
select throws_ok($$insert into public.groups(name,invite_token_hash,created_by) values (' padded','bad-trim','00000000-0000-0000-0000-000000000001')$$, '23514', 'new row for relation "groups" violates check constraint "groups_name_check"', 'table rejects untrimmed group names');
select throws_ok($$insert into public.groups(name,invite_token_hash,created_by) values (repeat('x',31),'bad-length','00000000-0000-0000-0000-000000000001')$$, '23514', 'new row for relation "groups" violates check constraint "groups_name_check"', 'table rejects group names longer than 30');
select throws_ok($$insert into public.groups(name,invite_token_hash,created_by,max_members) values ('Bad max','bad-max','00000000-0000-0000-0000-000000000001',31)$$, '23514', 'new row for relation "groups" violates check constraint "groups_max_members_check"', 'table enforces fixed max_members at the table boundary');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.get_group_invite_preview((select invite_token from created_group))), 1::bigint, 'nonmember can preview a valid invite');
select is((select to_jsonb(preview) from public.get_group_invite_preview((select invite_token from created_group)) preview), jsonb_build_object('group_id',(select group_id from created_group),'name','Best Friends','member_count',1,'max_members',30), 'invite preview returns only safe metadata');
select is((select count(*) from public.get_group_invite_preview('not-a-token')), 0::bigint, 'malformed invite preview returns no rows');
reset role;

-- Representative table-boundary checks.
select throws_ok(format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003',' padded','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}',1)$sql$,(select group_id from created_group)), '23514', 'new row for relation "group_members" violates check constraint "group_members_nickname_check"', 'table rejects untrimmed nicknames');
select throws_ok(format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003',repeat('x',21),'dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}',1)$sql$,(select group_id from created_group)), '23514', 'new row for relation "group_members" violates check constraint "group_members_nickname_check"', 'table rejects nicknames longer than 20');
select throws_ok(format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Bad zodiac','Dragon','INFP','{}',1)$sql$,(select group_id from created_group)), '23514', null, 'table rejects invalid zodiac');
select throws_ok(format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Bad MBTI','dragon','infp','{}',1)$sql$,(select group_id from created_group)), '23514', null, 'table rejects invalid MBTI');
select throws_ok(format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Bad version','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}',2)$sql$,(select group_id from created_group)), '23514', null, 'table enforces scalar profile version');
select throws_ok(format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Mismatch','rat','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}',1)$sql$,(select group_id from created_group)), '23514', null, 'table requires scalar and payload equality');
select throws_ok(statement, '23514', null, description)
from (values
  (format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Missing key','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact"}',1)$sql$,(select group_id from created_group)), 'table rejects a missing top-level profile key'),
  (format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Extra key','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1","extra":true}',1)$sql$,(select group_id from created_group)), 'table rejects an extra profile key'),
  (format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Null field','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":null,"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}',1)$sql$,(select group_id from created_group)), 'table rejects an exact-profile null field'),
  (format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','MBTI mismatch','dragon',null,'{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}',1)$sql$,(select group_id from created_group)), 'table rejects scalar MBTI mismatch'),
  (format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Raw key','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1","birthDate":"2000-01-01"}',1)$sql$,(select group_id from created_group)), 'table rejects a raw birth key'),
  (format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Wrong total','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}',1)$sql$,(select group_id from created_group)), 'table rejects a wrong count total'),
  (format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Malformed count','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":"bad","FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}',1)$sql$,(select group_id from created_group)), 'table contains malformed JSON as a check violation without a native cast leak')
) invalid_table(statement, description);
select lives_ok(format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Ambiguous boar','boar',null,'{"version":1,"zodiacId":"boar","mbti":null,"dayMaster":{"element":"WATER","polarity":"YIN"},"fiveElements":null,"yinYang":null,"calculationMode":"date-only","boundaryState":"solar-term-ambiguous","engineVersion":"mofu-eto-four-pillars-v1"}',1)$sql$,(select group_id from created_group)), 'table accepts boar with the exact ambiguous domain payload');
delete from public.group_members where user_id='00000000-0000-0000-0000-000000000003';

set local role service_role;
select lives_ok(format($sql$insert into public.group_members(group_id,user_id,nickname,zodiac_id,mbti,profile_payload,profile_version) values (%L,'00000000-0000-0000-0000-000000000003','Service sheep','sheep',null,'{"version":1,"zodiacId":"sheep","mbti":null,"dayMaster":{"element":"EARTH","polarity":"YIN"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":2,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}',1)$sql$,(select group_id from created_group)), 'service role can insert a valid sheep profile through the table check');
reset role;
select is((select zodiac_id from public.group_members where user_id='00000000-0000-0000-0000-000000000003'),'sheep','service role insert persists the exact zodiac');
delete from public.group_members where user_id='00000000-0000-0000-0000-000000000003';

create temporary table joined_group(group_id uuid, member_id uuid);
grant select, insert on joined_group to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
insert into joined_group select * from public.join_group((select invite_token from created_group),'  Joiner  ','ox','ENTJ','{"version":1,"zodiacId":"ox","mbti":"ENTJ","dayMaster":{"element":"FIRE","polarity":"YIN"},"fiveElements":{"WOOD":2,"FIRE":2,"EARTH":1,"METAL":2,"WATER":1},"yinYang":{"YIN":4,"YANG":4},"calculationMode":"date-time","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb);
insert into joined_group select * from public.join_group((select invite_token from created_group),'Ignored','boar',null,'{"version":1,"zodiacId":"boar","mbti":null,"dayMaster":{"element":"WATER","polarity":"YIN"},"fiveElements":null,"yinYang":null,"calculationMode":"date-only","boundaryState":"solar-term-ambiguous","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb);
reset role;
select is((select count(*) from joined_group), 2::bigint, 'repeat join returns a result each time');
select is((select count(distinct member_id) from joined_group), 1::bigint, 'repeat join returns the original member');
select is((select count(*) from public.group_members where group_id=(select group_id from created_group) and user_id='00000000-0000-0000-0000-000000000002'), 1::bigint, 'repeat join does not duplicate membership');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.groups), 0::bigint, 'nonmember cannot read groups');
select is((select count(*) from public.group_members), 0::bigint, 'nonmember cannot read members');
select throws_ok($$select * from public.create_group_and_join('Bad','Bad','dragon','INFP','{}'::jsonb)$$, 'P0001', 'INVALID_PROFILE', 'malformed create profile returns stable INVALID_PROFILE');
select throws_ok(format($sql$select * from public.join_group(%L,'Bad','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":"bad","FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb)$sql$,(select invite_token from created_group)), 'P0001', 'INVALID_PROFILE', 'malformed join count returns stable INVALID_PROFILE without a native cast leak');
select throws_ok($$select * from public.join_group('not-a-token','Nope','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb)$$, 'P0001', 'INVALID_INVITE', 'invalid invite returns stable INVALID_INVITE');
select throws_ok(statement, 'P0001', 'INVALID_PROFILE', description)
from (values
  ($$select * from public.create_group_and_join('Missing','Bad','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact"}'::jsonb)$$, 'create RPC rejects a missing profile key'),
  ($$select * from public.create_group_and_join('Extra','Bad','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1","extra":true}'::jsonb)$$, 'create RPC rejects an extra profile key'),
  ($$select * from public.create_group_and_join('Null','Bad','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":null,"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb)$$, 'create RPC rejects a null derived field'),
  ($$select * from public.create_group_and_join('Scalar','Bad','rat','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb)$$, 'create RPC rejects scalar and payload mismatch'),
  ($$select * from public.create_group_and_join('Raw','Bad','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":2,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1","birth_time":"12:00"}'::jsonb)$$, 'create RPC rejects a raw birth key'),
  ($$select * from public.create_group_and_join('Totals','Bad','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb)$$, 'create RPC rejects a wrong count total'),
  ($$select * from public.create_group_and_join('Malformed','Bad','dragon','INFP','{"version":1,"zodiacId":"dragon","mbti":"INFP","dayMaster":{"element":"WOOD","polarity":"YANG"},"fiveElements":{"WOOD":"bad","FIRE":1,"EARTH":1,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb)$$, 'create RPC contains malformed JSON as stable INVALID_PROFILE without a native cast leak')
) invalid_rpc(statement, description);
reset role;

create temporary table other_group(group_id uuid, member_id uuid, invite_token text);
grant select, insert on other_group to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
insert into other_group select * from public.create_group_and_join('Other','Other owner','boar',null,'{"version":1,"zodiacId":"boar","mbti":null,"dayMaster":{"element":"WATER","polarity":"YIN"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":1,"METAL":1,"WATER":2},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.groups), 1::bigint, 'member reads only their group');
select is((select count(*) from public.group_members), 2::bigint, 'member reads only members in their group');
reset role;

insert into auth.users (id,aud,role,email,encrypted_password,created_at,updated_at)
select ('10000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','capacity-'||n||'@example.test','',now(),now()
from generate_series(1,29) n;
do $capacity$
declare n integer;
begin
  for n in 1..28 loop
    perform set_config('request.jwt.claim.sub',('10000000-0000-0000-0000-'||lpad(n::text,12,'0')),true);
    perform * from public.join_group((select invite_token from created_group),'Member '||n,'sheep',null,'{"version":1,"zodiacId":"sheep","mbti":null,"dayMaster":{"element":"EARTH","polarity":"YIN"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":2,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb);
  end loop;
end
$capacity$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000029',true);
select throws_ok(format($sql$select * from public.join_group(%L,'Thirty first','sheep',null,'{"version":1,"zodiacId":"sheep","mbti":null,"dayMaster":{"element":"EARTH","polarity":"YIN"},"fiveElements":{"WOOD":1,"FIRE":1,"EARTH":2,"METAL":1,"WATER":1},"yinYang":{"YIN":3,"YANG":3},"calculationMode":"date-only","boundaryState":"exact","engineVersion":"mofu-eto-four-pillars-v1"}'::jsonb)$sql$,(select invite_token from created_group)), 'P0001', 'GROUP_FULL', '31st unique user is rejected');
reset role;
select is((select count(*) from public.group_members where group_id=(select group_id from created_group)), 30::bigint, 'capacity remains fixed at 30');

create temporary table unlock_result(id uuid,group_id uuid,member_low_id uuid,member_high_id uuid,status public.unlock_status,payment_provider text,payment_reference text,unlocked_by uuid,unlocked_at timestamptz);
grant select, insert on unlock_result to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
insert into unlock_result select * from public.unlock_relation_mock((select group_id from created_group),(select member_id from created_group),(select member_id from joined_group limit 1));
insert into unlock_result select * from public.unlock_relation_mock((select group_id from created_group),(select member_id from joined_group limit 1),(select member_id from created_group));
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
insert into unlock_result select * from public.unlock_relation_mock((select group_id from created_group),(select member_id from joined_group limit 1),(select member_id from created_group));
reset role;
select is((select count(distinct id) from unlock_result),1::bigint,'reversed duplicate unlocks are idempotent');
select is((select count(*) from public.relation_unlocks where group_id=(select group_id from created_group)),1::bigint,'only one unlock row exists for a pair');
select ok((select member_low_id < member_high_id from unlock_result limit 1),'unlock pair is canonical');
select is((select count(distinct unlocked_by) from unlock_result),1::bigint,'duplicate unlock preserves first unlocked_by audit');
select is((select count(distinct unlocked_at) from unlock_result),1::bigint,'duplicate unlock preserves first unlocked_at audit');
select is((select count(*) from unlock_result where unlocked_by <> '00000000-0000-0000-0000-000000000001'),0::bigint,'reversed cross-caller duplicate preserves the first caller as unlocked_by');
select is((select count(distinct status) from unlock_result),1::bigint,'reversed cross-caller duplicate preserves status');
select is((select status::text from unlock_result limit 1),'unlocked','unlock status remains unlocked');
select is((select count(distinct payment_provider) from unlock_result),1::bigint,'reversed cross-caller duplicate preserves payment provider');
select is((select payment_provider from unlock_result limit 1),'mock','unlock payment provider remains mock');
select is((select count(*) from unlock_result where payment_reference is not null),0::bigint,'reversed cross-caller duplicate preserves null payment reference');
select throws_ok(format($sql$insert into public.relation_unlocks(group_id,member_low_id,member_high_id,status,payment_provider,unlocked_by) values (%L,%L,%L,'unlocked','mock','00000000-0000-0000-0000-000000000001')$sql$,(select group_id from created_group),(select member_id from created_group),(select member_id from created_group)), '23514', null, 'canonical pair check rejects identical members');
select throws_ok(format($sql$insert into public.relation_unlocks(group_id,member_low_id,member_high_id,status,payment_provider,unlocked_by) values (%L,greatest(%L::uuid,%L::uuid),least(%L::uuid,%L::uuid),'unlocked','mock','00000000-0000-0000-0000-000000000001')$sql$,(select group_id from created_group),(select member_id from created_group),(select member_id from joined_group limit 1),(select member_id from created_group),(select member_id from joined_group limit 1)), '23514', 'new row for relation "relation_unlocks" violates check constraint "relation_unlocks_ordered_pair_check"', 'ordered pair check rejects a distinct reversed pair at the table boundary');
select throws_ok(format($sql$insert into public.relation_unlocks(group_id,member_low_id,member_high_id,status,payment_provider,unlocked_by) values (%L,least(%L::uuid,%L::uuid),greatest(%L::uuid,%L::uuid),'unlocked','mock','00000000-0000-0000-0000-000000000001')$sql$,(select group_id from created_group),(select member_id from created_group),(select member_id from other_group),(select member_id from created_group),(select member_id from other_group)), '23503', null, 'same-group composite foreign keys reject cross-group pairs');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select is((select count(*) from public.relation_unlocks),1::bigint,'member can select their group unlock');
select throws_ok(format($sql$select * from public.unlock_relation_mock(%L,%L,%L)$sql$,(select group_id from created_group),(select member_id from created_group),(select member_id from other_group)), 'P0001', 'INVALID_PAIR', 'cross-group unlock returns stable INVALID_PAIR');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select is((select count(*) from public.relation_unlocks),0::bigint,'nonmember cannot select unlock rows');
select throws_ok(format($sql$select * from public.unlock_relation_mock(%L,%L,%L)$sql$,(select group_id from created_group),(select member_id from created_group),(select member_id from joined_group limit 1)), 'P0001', 'FORBIDDEN', 'nonmember unlock returns stable FORBIDDEN');
reset role;

select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='group_members'),'group_members remains in realtime');
select ok(exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='relation_unlocks'),'relation_unlocks remains in realtime');

select * from finish();
rollback;
