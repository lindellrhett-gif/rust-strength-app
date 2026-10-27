-- 0023_export_running.sql
--
-- "Download my data" covers running: runs (with their routes as GeoJSON),
-- best efforts, privacy zones, saved routes and running settings. The
-- export is how someone sees everything we hold about them, so it has to
-- grow with every new kind of data. Re-declared in full, as in 0008.
--
-- Deleting an account already removes all of these: every running table
-- references auth.users with ON DELETE CASCADE (0015).
--
-- Additive: version 1.0 calls this function and simply gets more in the file.

create or replace function rpc_export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
stable
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'account', (
      select jsonb_build_object('email', u.email, 'created_at', u.created_at)
      from auth.users u where u.id = uid
    ),
    'profile',     (select to_jsonb(p) from profiles p where p.user_id = uid),
    'workouts',    (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from workouts w where w.user_id = uid),
    'sets',        (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from sets s where s.user_id = uid),
    'activities',  (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from activities a where a.user_id = uid),
    'rest_days',   (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from rest_days r where r.user_id = uid),
    'templates',   (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from workout_templates t where t.user_id = uid),
    'planned',     (select coalesce(jsonb_agg(to_jsonb(pl)), '[]'::jsonb) from planned_sessions pl where pl.user_id = uid),
    'machines',    (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from machines m where m.user_id = uid),
    'gyms',        (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from gyms g where g.user_id = uid),
    'custom_exercises', (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from exercises e where e.user_id = uid),
    'friendships', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from friendships f
                    where f.requester_id = uid or f.addressee_id = uid),
    'blocks',      (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from user_blocks b where b.blocker_id = uid),
    'badges',      (select coalesce(jsonb_agg(to_jsonb(pb)), '[]'::jsonb) from profile_badges pb where pb.user_id = uid),
    'reactions',   (select coalesce(jsonb_agg(to_jsonb(fr)), '[]'::jsonb) from feed_reactions fr where fr.user_id = uid),
    -- Running (0015 onwards). Routes come out as GeoJSON, which any mapping
    -- tool can open (longitude, latitude, altitude in metres), with the
    -- seconds from the start at each point alongside as route_times.
    'runs',        (select coalesce(jsonb_agg(
                      (to_jsonb(rn) - 'route')
                      || jsonb_build_object('route', case when rn.route is null then null
                                                          else ST_AsGeoJSON(rn.route)::jsonb end)
                      || jsonb_build_object('route_times', (
                           select array_agg(ST_M(dp.geom)::int order by dp.path[1])
                           from ST_DumpPoints(rn.route) dp))
                    ), '[]'::jsonb) from runs rn where rn.user_id = uid),
    'run_best_efforts', (select coalesce(jsonb_agg(to_jsonb(be)), '[]'::jsonb) from run_best_efforts be where be.user_id = uid),
    'run_privacy_zones', (select coalesce(jsonb_agg(jsonb_build_object(
                      'id', z.id, 'label', z.label, 'radius_m', z.radius_m, 'created_at', z.created_at,
                      'lat', ST_Y(z.center::geometry), 'lon', ST_X(z.center::geometry)
                    )), '[]'::jsonb) from run_privacy_zones z where z.user_id = uid),
    'saved_routes', (select coalesce(jsonb_agg(
                      (to_jsonb(sr) - 'route') || jsonb_build_object('route', ST_AsGeoJSON(sr.route)::jsonb)
                    ), '[]'::jsonb) from saved_routes sr where sr.user_id = uid),
    'run_preferences', (select to_jsonb(rp) from run_preferences rp where rp.user_id = uid)
  ) into result;

  return result;
end $$;

revoke all on function rpc_export_my_data() from public, anon;
grant execute on function rpc_export_my_data() to authenticated;
