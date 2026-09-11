# Moderation runbook

Rust Strength lets people write usernames, display names, and names for their
own exercises, machines, gyms, presets, workouts and activities. Accepted
friends see that text. That makes this an app with user-generated content, and
App Store Review Guideline 1.2 expects three things of one:

1. A way to report objectionable content or users. **Built** — any profile has a
   Report action.
2. A way to block an abusive user. **Built** — blocking also tears down the
   friendship in both directions.
3. **Acting on reports promptly.** That is this document. Apple's wording is
   "ejecting the offending user", and reviewers have been known to ask what the
   process is.

There is no moderation screen inside the app. With one operator and a queue in
single digits, the Supabase SQL editor is the tool, and an admin surface inside
the consumer app would be new attack surface for no benefit. Revisit that if the
queue ever stops fitting on one screen.

---

## The routine

**Check the queue once a day while the app is live.** It takes ten seconds when
it is empty, which it usually will be. Put it next to something you already do
daily.

Open the Supabase dashboard for the project, go to **SQL Editor**, and run:

```sql
select * from v_open_reports where status = 'open';
```

Empty result, you are done.

---

## Working a report

**1. Read what the reported account has actually written.**

```sql
select * from rpc_admin_user_text('<reported_id from the queue>');
```

That returns every piece of free text that account has put in front of another
person, in one list. Most reports are about a username or a display name.

**2. Look at whether this is a pattern.** The queue's `reports_against` column
counts every report ever filed against that account. One report from one person
is a different situation from four reports from four people.

**3. Decide, and act.**

*Offensive username or display name* — clear it and force them to pick again:

```sql
update profiles
set username = 'lifter_' || substr(md5(random()::text), 1, 6),
    display_name = null,
    username_chosen = false
where user_id = '<reported_id>';
```

Setting `username_chosen` back to false means they stop appearing in search
until they choose a new handle, and the app prompts them to.

*Harassment, or a repeat offender* — ban the account. Supabase has this built
in: **Authentication → Users → find the user → Ban user**. Pick a duration.
A banned user cannot sign in; their data is untouched, so a ban is reversible
in a way that deletion is not.

*Serious or repeated abuse* — delete the account outright. In the same
Authentication → Users screen, delete the user. Everything cascades. This cannot
be undone.

*Nothing wrong* — dismiss it. Do not leave it open.

**4. Close the report. Always.** An open queue that is really all handled is
worse than no queue.

```sql
update user_reports
set status = 'actioned',        -- or 'dismissed'
    reviewed_at = now(),
    reviewer_note = 'Reset username; first offence.'
where id = '<report id>';
```

The note is for the next report about the same person, which is the one where
history matters.

---

## If you want to be told instead of remembering

Supabase can fire a **Database Webhook** on insert into `user_reports` and call
an email service. Two things to weigh before you do it:

- An email provider that receives report contents becomes a **subprocessor**,
  and the privacy policy's "who we share with" section would need to say so.
- The report row contains the reporter's id, the reported id, and whatever the
  reporter typed. Send as little of that as you can — a "there is a new report"
  ping with no content is enough to make you go and look.

With no users yet, the daily check is the proportionate answer. Set up the
webhook when the queue starts arriving faster than you check it.

---

## What to tell App Review

If they ask about content moderation, the honest answer is short:

> Users can report any profile from the Friends tab and can block any user,
> which also removes the friendship. Reports go to a queue the developer reviews
> daily. Depending on severity the response is resetting an offensive username,
> banning the account, or deleting it. There is no public content and no
> free-text messaging between users — the only user-written text another person
> can see is a username, a display name, and the names someone gives their own
> exercises and sessions.

That last sentence is worth keeping true. Adding comments or direct messages
would change the moderation burden completely.
