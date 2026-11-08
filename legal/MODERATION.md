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

---

## Users outside the United States (added November 7, 2026)

Version 1.2 is meant for Canada, the UK and the EU as well. Their rules add a
few steps to the routine above. They're small at this size, but they apply
from the first user there. Not reviewed by a lawyer.

### Reports can come from anyone

The Terms (section 6) say anyone, with or without an account, can report
illegal content by email. Treat an email to the support address that points at
something in the app the same as an in-app report:
- log it (see "Keep a record" below);
- find the account with `rpc_admin_user_text`;
- decide.

If they gave a name and address, tell them what you decided.

This is the EU Digital Services Act's notice-and-action duty (Article 16),
which applies to hosting services of every size.

### Always tell the person why

Whenever you reset a name, ban or delete an account, email the account's
address. The Terms promise it, and Article 17 of the Act requires it for EU
users. Do it for everyone; it's the same email. Skip it only if the law
forbids telling them, or telling them would put someone at risk.

Template:

> Subject: About your Rust Strength account
>
> We have [reset your username / suspended your account until DATE /
> deleted your account] on DATE.
>
> Why: [what was written, or what happened, in a sentence].
> This breaks section 4 of our Terms of Service ([the rule]) [and/or: is
> illegal under [the law], as far as we can tell].
>
> How we decided: a person reviewed it. We don't use automated tools to
> moderate content.
>
> If you think we got it wrong, reply to this email and a person will look at
> it again.

Reply in French to someone who writes in French.

### Threats to someone's life or safety

If a report or anything you read gives you reason to suspect a crime that
threatens someone's life or safety:
- **In the US:** call 911, or the local police where the person is, when it's
  urgent.
- **For an EU user:** the Act (Article 18) also requires telling the police or
  judicial authorities of the EU country concerned, with what you know.

Keep a copy of what you saw. Don't delete the account first, unless it is
actively being used to cause harm: the evidence goes with it.

### Complaints about moderation

People can email to complain:
- about a decision;
- about how a report was handled;
- about how the app meets its UK Online Safety Act duties (Terms, section 6).

Answer every complaint, normally within 14 days, saying what you looked at and
what you decided. For the UK Act's assessments and the measures they rely on,
see `legal/UK_ONLINE_SAFETY.md`.

### Keep a record outside the database

A report row is deleted when either account is deleted, so the database isn't
a record. Keep a private log (the same kind of spreadsheet as for privacy
requests, outside this repo), one row per report, notice or complaint:
- the date;
- who reported it, if known;
- what it was about;
- what you decided and why;
- when you told the person.

Keep rows for two years, and avoid copying in more of anyone's text than you
need. The UK Act expects records of moderation and of the risk assessments.
Under the EU Act, the record is the evidence the reasons were given.

### What doesn't apply at this size

Under the Digital Services Act, micro and small enterprises don't have to:
- publish transparency reports (Article 15);
- meet the extra duties of online platforms (Articles 19 to 28).

Bluestem Software LLC is a micro enterprise. Every hosting service must still
have:
- the contact point (Articles 11 and 12, in the Terms);
- the legal representative (Article 13, still to be appointed);
- clear moderation rules (Article 14, Terms sections 4 and 6);
- the duties above (Articles 16 to 18).

### Answer in French

Quebec users have the right to be served in French. When a report, complaint
or reply arrives in French, answer in French. A translation tool is fine.
