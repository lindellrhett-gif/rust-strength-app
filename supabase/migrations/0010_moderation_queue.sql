-- Rust Strength — Milestone 10: a moderation queue that can actually be worked
--
-- Reporting already wrote a row and nothing ever read it. App Review guideline
-- 1.2 expects an app with user-generated content to act on reports, and "we
-- collect them" is not acting on them.
--
-- This does not add a moderation UI to the app. For a solo operator with a
-- queue measured in single digits, the Supabase SQL editor IS the tool, and an
-- admin surface inside the consumer app would be new attack surface for no
-- gain. What was missing is a way to tell a handled report from an unhandled
-- one, and somewhere to write down what was decided.
--
-- The runbook lives in legal/MODERATION.md.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Report lifecycle
-- ---------------------------------------------------------------------------
do $$ begin
  create type report_status as enum ('open', 'actioned', 'dismissed');
exception when duplicate_object then null;
end $$;

alter table user_reports add column if not exists status report_status not null default 'open';
alter table user_reports add column if not exists reviewed_at timestamptz;
-- What was decided and why. Kept for the next report about the same person,
-- which is the one that usually matters.
alter table user_reports add column if not exists reviewer_note text;

-- The queue is always read "oldest open first", so index exactly that.
create index if not exists user_reports_open_idx
  on user_reports (created_at) where status = 'open';

-- ---------------------------------------------------------------------------
-- The queue itself.
--
-- security_invoker, so this view grants nothing new: a signed-in user querying
-- it still sees only the reports they filed, and the profile joins come back
-- null for anyone they cannot already see. Run as the service role — which is
-- what the SQL editor does — it returns everything.
-- ---------------------------------------------------------------------------
create or replace view v_open_reports
with (security_invoker = true) as
select
  r.id,
  r.created_at,
  r.status,
  r.reason,
  r.details,
  r.reviewed_at,
  r.reviewer_note,
  r.reported_id,
  reported.username     as reported_username,
  reported.display_name as reported_display_name,
  r.reporter_id,
  reporter.username     as reporter_username,
  -- How many times this person has been reported, by anyone, ever. A first
  -- report and a fifth report are not the same situation.
  (select count(*) from user_reports prior where prior.reported_id = r.reported_id) as reports_against
from user_reports r
left join profiles reported on reported.user_id = r.reported_id
left join profiles reporter on reporter.user_id = r.reporter_id
order by
  case when r.status = 'open' then 0 else 1 end,
  r.created_at;

-- ---------------------------------------------------------------------------
-- Free text a reported account has put in front of other people. This is what
-- a report is almost always about, and it saves digging through four tables.
--
-- SECURITY DEFINER with no friendship gate, so it is deliberately NOT granted
-- to `authenticated` — only the service role may call it.
-- ---------------------------------------------------------------------------
create or replace function rpc_admin_user_text(target uuid)
returns table (source text, value text)
language sql
security definer
set search_path = public
stable
as $$
  select 'username', p.username from profiles p where p.user_id = target
  union all
  select 'display_name', p.display_name from profiles p
    where p.user_id = target and p.display_name is not null
  union all
  select 'exercise', e.name from exercises e where e.user_id = target
  union all
  select 'machine', m.label from machines m where m.user_id = target
  union all
  select 'gym', g.name from gyms g where g.user_id = target
  union all
  select 'preset', t.name from workout_templates t where t.user_id = target
  union all
  select 'workout', w.name from workouts w
    where w.user_id = target and w.name is not null
  union all
  select 'activity', a.name from activities a
    where a.user_id = target and a.name is not null;
$$;

revoke all on function rpc_admin_user_text(uuid) from public;
revoke all on function rpc_admin_user_text(uuid) from authenticated;
revoke all on function rpc_admin_user_text(uuid) from anon;
