create function public.get_group_invite_preview(p_invite_token text)
returns table(group_id uuid, name text, member_count bigint, max_members integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  if p_invite_token is null or p_invite_token !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  return query
  select
    g.id,
    g.name,
    (select pg_catalog.count(*) from public.group_members gm where gm.group_id = g.id),
    g.max_members
  from public.groups g
  where g.invite_token_hash = pg_catalog.encode(
    extensions.digest(p_invite_token, 'sha256'),
    'hex'
  );
end;
$$;

alter function public.get_group_invite_preview(text) owner to postgres;
revoke all on function public.get_group_invite_preview(text) from public, anon, authenticated;
grant execute on function public.get_group_invite_preview(text) to authenticated;
