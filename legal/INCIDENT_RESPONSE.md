# Incident response plan — Gym App

A short, actually-usable plan. Most US state breach-notification laws expect notice
"without unreasonable delay"; several set an outer limit of 30–45 days.

## What could be exposed

Everything lives in one Supabase project. A compromise of that project, or of the
`service_role` key, would expose:

- **Email addresses** and **hashed** passwords (bcrypt, via Supabase Auth)
- Bodyweight, training history, activity data (distance, steps, calories)
- Recorded runs, including their routes (precise location), saved routes and privacy
  zones, which can show where someone lives
- Usernames, display names, friend relationships
- Gym and machine names the user typed
- Abuse reports

Not at risk, because it is never collected: payment details, government IDs, photos,
contacts, biometrics.

**Most likely realistic causes:** a leaked `service_role` key, a misconfigured or
disabled RLS policy on a new table, or a compromised Supabase account login.

## Prevention checklist

- [ ] Supabase account has MFA enabled
- [ ] `service_role` key exists **only** in Supabase — never in the app, never in git
- [ ] Every new table gets RLS enabled **and** a policy in the same migration
- [ ] `.env` stays gitignored
- [ ] Review Supabase logs monthly for unusual query volume

## If you suspect a breach

**Hour 0–1 — contain**
1. Rotate the `service_role` key and the database password in the Supabase dashboard.
2. If accounts were accessed, force sign-out: Supabase Dashboard → Authentication →
   revoke refresh tokens.
3. Do not delete logs — you need them.

**Hour 1–24 — assess**
4. What was accessed, whose data, over what window? Check Supabase logs.
5. Write it down as you go, with timestamps. This record matters later.
6. Determine whether the data was encrypted or hashed (passwords are; the rest is not).

**Day 1–3 — decide**
7. Was personal information actually acquired by an unauthorised person? If yes,
   notification duties likely apply. **Contact an attorney at this point** — the
   thresholds and deadlines vary by state and you should not guess.

**Within the legal deadline — notify**
8. Notify affected users by email: what happened, when, what data, what you have done,
   what they should do (change their password; change it anywhere they reused it).
9. Notify state Attorneys General where required — several states require this above a
   threshold number of residents.
10. If more than 500 residents of a state are affected, additional requirements usually
    apply.

**Users outside the United States.** Check whether any affected accounts are there.
The app does not record anyone's country, so look at what the breach exposed and ask
users if you need to.

- **New Zealand** (Privacy Act 2020, Part 6). A notifiable privacy breach is one that
  has caused, or is likely to cause, serious harm. Tell the Privacy Commissioner as
  soon as practicable (the NotifyUs form at https://www.privacy.org.nz) and the
  people affected. Failing to notify the Commissioner is an offence.
- **Australia** (Notifiable Data Breaches scheme, Privacy Act 1988 Part IIIC). If you
  suspect an eligible data breach, finish assessing it within 30 days. If it is likely
  to cause serious harm, tell the OAIC (the statement form at https://www.oaic.gov.au)
  and the people affected as soon as practicable. The Privacy Policy treats the Act as
  applying, so follow this even though the small-business exemption might cover us.
- **United Kingdom** (UK GDPR Articles 33 and 34). Report a personal data breach to
  the ICO within **72 hours** of becoming aware of it (https://ico.org.uk), unless it
  is unlikely to result in a risk to people. If it is likely to result in a high risk,
  tell the people affected without undue delay. If you can't report everything in
  72 hours, report what you know and add the rest later.
- **EU, Iceland, Liechtenstein, Norway** (GDPR Articles 33 and 34). The same 72-hour
  rule. With no office in the EU there is no lead authority, so report to the data
  protection authority of each country where affected people live, through the EU
  representative once one is appointed.
- **Canada** (PIPEDA). If a breach of security safeguards creates a real risk of
  significant harm, report it to the Office of the Privacy Commissioner
  (https://www.priv.gc.ca) and tell the people affected as soon as feasible.
- **Quebec** (private-sector Act, as amended by Law 25). If a confidentiality incident
  presents a risk of serious injury, notify the Commission d'accès à l'information
  (https://www.cai.gouv.qc.ca) and the people concerned promptly. Take reasonable
  steps to reduce the harm straight away.

**Keep a register of every incident, reported or not.** The UK and EU (Article 33(5)),
Canada (a record of every breach of security safeguards, kept for 24 months) and
Quebec (a register of confidentiality incidents, kept at least five years after the
incident) all require one. Keeping every row five years meets all of them. Keep it outside the
repo, like the privacy request log:

| Date found | What happened | Data and people affected | Countries | Risk assessed as | Reported to (date) | People told (date) | What was fixed |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

These summaries were written from memory of each law on November 7, 2026, not checked
against the text that day. Check the deadline for each country when it happens. That
is also the moment to call a lawyer.

**After**
11. Fix the root cause and write down what changed.
12. Re-run the prevention checklist.

## Contacts

- Supabase support: https://supabase.com/support
- Attorney: _[fill in before launch]_
- Support inbox: _[see `src/legal/config.ts`]_
