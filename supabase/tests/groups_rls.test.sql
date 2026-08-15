begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select no_plan();

select has_type('public', 'animal_group', 'animal_group enum exists');
select enum_has_labels('public', 'animal_group', array['MOON', 'EARTH', 'SUN'], 'animal_group labels are exact');
select has_type('public', 'unlock_status', 'unlock_status enum exists');
select enum_has_labels('public', 'unlock_status', array['pending', 'unlocked', 'failed'], 'unlock_status labels are exact');
select has_table('public', 'groups', 'groups table exists');
select has_table('public', 'group_members', 'group_members table exists');
select has_table('public', 'relation_unlocks', 'relation_unlocks table exists');
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.groups'::regclass and contype = 'u' and conkey = array[(select attnum from pg_attribute where attrelid = 'public.groups'::regclass and attname = 'invite_token_hash')]::smallint[]),
  'invite token digest is unique'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.group_members'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (group_id, user_id)'),
  'membership is unique per group and user'
);
select ok(
  exists(select 1 from pg_constraint where conrelid = 'public.relation_unlocks'::regclass and contype = 'u' and pg_get_constraintdef(oid) = 'UNIQUE (group_id, member_low_id, member_high_id)'),
  'relation unlock is unique per canonical pair'
);
select ok(
  not exists(
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'groups' and column_name = 'invite_token'
  ),
  'raw invite tokens are never stored'
);
select has_column('public', 'groups', 'invite_token_hash', 'only an invite token digest column exists');
select has_function('public', 'is_group_member', array['uuid'], 'membership helper exists');
select has_function('public', 'create_group_and_join', array['text','text','text','animal_group','text','jsonb'], 'create RPC exists');
select has_function('public', 'join_group', array['text','text','text','animal_group','text','jsonb'], 'join RPC exists');
select has_function('public', 'unlock_relation_mock', array['uuid','uuid','uuid'], 'mock unlock RPC exists');

select ok((select relrowsecurity from pg_class where oid = 'public.groups'::regclass), 'groups has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.group_members'::regclass), 'group_members has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.relation_unlocks'::regclass), 'relation_unlocks has RLS enabled');

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
select id, 'authenticated', 'authenticated', email, '', now(), now()
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'creator@example.test'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'joiner@example.test'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'outsider@example.test'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'other-owner@example.test')
) users(id, email);

select throws_ok(
  $$select * from public.create_group_and_join('Team', 'Owner', 'fawn', 'MOON', null, '{"version":1}'::jsonb)$$,
  'P0001', 'UNAUTHENTICATED', 'create rejects unauthenticated callers with a stable error'
);
select throws_ok(
  $$select * from public.join_group('missing', 'Joiner', 'wolf', 'EARTH', null, '{"version":1}'::jsonb)$$,
  'P0001', 'UNAUTHENTICATED', 'join rejects unauthenticated callers with a stable error'
);

create temporary table created_group(group_id uuid, member_id uuid, invite_token text);
grant select, insert on created_group to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into created_group
select * from public.create_group_and_join('  Best Friends  ', '  Owner  ', 'fawn', 'MOON', 'INFP', '{"version":1,"label":"safe"}'::jsonb);
reset role;

select is((select name from public.groups where id = (select group_id from created_group)), 'Best Friends', 'create trims group name');
select is((select nickname from public.group_members where id = (select member_id from created_group)), 'Owner', 'create trims nickname');
select isnt((select invite_token from created_group), null, 'create returns a raw invite token once');
select isnt(
  (select invite_token_hash from public.groups where id = (select group_id from created_group)),
  (select invite_token from created_group),
  'stored invite value is a digest, not the raw token'
);
select is(
  (select invite_token_hash from public.groups where id = (select group_id from created_group)),
  encode(extensions.digest((select invite_token from created_group), 'sha256'), 'hex'),
  'stored invite digest resolves deterministically'
);

create temporary table joined_group(group_id uuid, member_id uuid);
grant select, insert on joined_group to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
insert into joined_group
select * from public.join_group((select invite_token from created_group), '  Joiner  ', 'wolf', 'EARTH', 'ENTJ', '{"version":1}'::jsonb);
insert into joined_group
select * from public.join_group((select invite_token from created_group), 'Ignored', 'lion', 'SUN', null, '{"version":1}'::jsonb);
reset role;

select is((select count(*) from joined_group), 2::bigint, 'repeat join returns a result each time');
select is((select count(distinct member_id) from joined_group), 1::bigint, 'repeat join returns the original member');
select is(
  (select count(*) from public.group_members where group_id = (select group_id from created_group) and user_id = '00000000-0000-0000-0000-000000000002'),
  1::bigint,
  'repeat join does not duplicate membership'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is((select count(*) from public.groups), 0::bigint, 'nonmember cannot read groups');
select is((select count(*) from public.group_members), 0::bigint, 'nonmember cannot read members');
reset role;

create temporary table other_group(group_id uuid, member_id uuid, invite_token text);
grant select, insert on other_group to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
insert into other_group
select * from public.create_group_and_join('Other', 'Other owner', 'lion', 'SUN', null, '{"version":1}'::jsonb);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is((select count(*) from public.groups), 1::bigint, 'member reads only their group');
select is((select count(*) from public.group_members), 2::bigint, 'member reads members in their group only');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select * from public.join_group('not-a-token', 'Nope', 'fawn', 'MOON', null, '{"version":1}'::jsonb)$$,
  'P0001', 'INVALID_INVITE', 'invalid invite returns a stable error'
);
select throws_ok(
  $$select * from public.create_group_and_join('Bad animal', 'Nope', 'dragon', 'MOON', null, '{"version":1}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'invalid animal is rejected'
);
select throws_ok(
  $$select * from public.create_group_and_join('Bad MBTI', 'Nope', 'fawn', 'MOON', 'XXXX', '{"version":1}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'invalid MBTI is rejected'
);
select throws_ok(
  $$select * from public.create_group_and_join('Raw birth', 'Nope', 'fawn', 'MOON', null, '{"version":1,"birthDate":"2000-01-01"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'camelCase raw birth keys are rejected'
);
select throws_ok(
  $$select * from public.create_group_and_join('Raw birth', 'Nope', 'fawn', 'MOON', null, '{"version":1,"birth_time":"12:30"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'snake_case raw birth keys are rejected'
);
select throws_ok(
  $$select * from public.create_group_and_join('No version', 'Nope', 'fawn', 'MOON', null, '{"label":"missing"}'::jsonb)$$,
  'P0001', 'INVALID_PROFILE', 'profile payload requires a version'
);
reset role;

insert into auth.users (id, aud, role, email, encrypted_password, created_at, updated_at)
select ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
       'authenticated', 'authenticated', 'capacity-' || n || '@example.test', '', now(), now()
from generate_series(1, 29) n;

do $capacity$
declare
  n integer;
begin
  for n in 1..28 loop
    perform set_config('request.jwt.claim.sub', ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0')), true);
    perform * from public.join_group((select invite_token from created_group), 'Member ' || n, 'koala', 'EARTH', null, '{"version":1}'::jsonb);
  end loop;
end
$capacity$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000029', true);
select throws_ok(
  format($sql$select * from public.join_group(%L, 'Thirty first', 'koala', 'EARTH', null, '{"version":1}'::jsonb)$sql$, (select invite_token from created_group)),
  'P0001', 'GROUP_FULL', '31st unique user is rejected'
);
reset role;
select is((select count(*) from public.group_members where group_id = (select group_id from created_group)), 30::bigint, 'capacity remains fixed at 30');

create temporary table unlock_result(id uuid, group_id uuid, member_low_id uuid, member_high_id uuid, status public.unlock_status, payment_provider text, payment_reference text, unlocked_by uuid, unlocked_at timestamptz);
grant select, insert on unlock_result to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
insert into unlock_result select * from public.unlock_relation_mock(
  (select group_id from created_group),
  (select member_id from created_group),
  (select member_id from joined_group limit 1)
);
insert into unlock_result select * from public.unlock_relation_mock(
  (select group_id from created_group),
  (select member_id from joined_group limit 1),
  (select member_id from created_group)
);
reset role;

select is((select count(distinct id) from unlock_result), 1::bigint, 'reversed unlock calls are idempotent');
select is((select count(*) from public.relation_unlocks where group_id = (select group_id from created_group)), 1::bigint, 'only one unlock row exists for a pair');
select is((select status::text from unlock_result limit 1), 'unlocked', 'mock unlock is immediately unlocked');
select is((select payment_provider from unlock_result limit 1), 'mock', 'mock provider is recorded');
select ok((select member_low_id < member_high_id from unlock_result limit 1), 'unlock pair is stored in canonical UUID order');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select throws_ok(
  format($sql$select * from public.unlock_relation_mock(%L, %L, %L)$sql$,
    (select group_id from created_group), (select member_id from created_group), (select member_id from other_group)),
  'P0001', 'INVALID_PAIR', 'cross-group unlock pair is rejected'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select throws_ok(
  format($sql$select * from public.unlock_relation_mock(%L, %L, %L)$sql$,
    (select group_id from created_group), (select member_id from created_group), (select member_id from joined_group limit 1)),
  'P0001', 'FORBIDDEN', 'unrelated user cannot unlock a relation'
);
select is((select count(*) from public.relation_unlocks), 0::bigint, 'unrelated user cannot read unlocks');
reset role;

select ok(
  exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_members'),
  'group_members is in the realtime publication'
);
select ok(
  exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'relation_unlocks'),
  'relation_unlocks is in the realtime publication'
);

select * from finish();
rollback;
