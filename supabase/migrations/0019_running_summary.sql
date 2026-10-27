-- 0019_running_summary.sql
--
-- Running totals for a span of time, worked out on the server. The running
-- hub works from the full history on the phone; this is the interface for
-- anything that needs the same numbers without it, starting with the AI
-- coach. It counts every run, including ones logged by hand before running
-- existed (an activity of kind 'run' with no detail row), converted to
-- metres from their own unit.
--
-- SECURITY INVOKER and filtered to auth.uid(): each person only ever sees
-- their own totals. Signed-in users only, as in 0016. Additive.

create or replace function rpc_running_summary(p_start timestamptz, p_end timestamptz)
returns table (
  runs             int,
  distance_m       double precision,
  moving_seconds   bigint,
  longest_m        double precision,
  elevation_gain_m double precision,
  hard_runs        int
)
language sql
security invoker
stable
set search_path = public
as $$
  with r as (
    select
      coalesce(
        rn.distance_m,
        a.distance * case a.distance_unit when 'mi' then 1609.344 when 'km' then 1000 when 'm' then 1 end
      ) as d,
      coalesce(rn.moving_seconds, a.duration_seconds) as mt,
      rn.elevation_gain_m as gain,
      rn.effort
    from activities a
    left join runs rn on rn.activity_id = a.id
    where a.kind = 'run'
      and a.user_id = auth.uid()
      and a.performed_at >= p_start
      and a.performed_at < p_end
  )
  select
    count(*)::int,
    coalesce(sum(d), 0),
    coalesce(sum(mt), 0),
    coalesce(max(d), 0),
    coalesce(sum(gain), 0),
    -- Effort 8 and up is a hard session, as in src/domain/running/load.ts.
    (count(*) filter (where effort >= 8))::int
  from r
  where d > 0;
$$;

revoke all on function rpc_running_summary(timestamptz, timestamptz) from public, anon;
grant execute on function rpc_running_summary(timestamptz, timestamptz) to authenticated;
