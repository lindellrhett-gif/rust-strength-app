# Incident response plan — Gym App

A short, actually-usable plan. Most US state breach-notification laws expect notice
"without unreasonable delay"; several set an outer limit of 30–45 days.

## What could be exposed

Everything lives in one Supabase project. A compromise of that project, or of the
`service_role` key, would expose:

- **Email addresses** and **hashed** passwords (bcrypt, via Supabase Auth)
- Bodyweight, training history, activity data (distance, steps, calories)
- Usernames, display names, friend relationships
- Gym and machine names the user typed
- Abuse reports

Not at risk, because it is never collected: payment details, government IDs, location,
photos, contacts, biometrics.

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

**After**
11. Fix the root cause and write down what changed.
12. Re-run the prevention checklist.

## Contacts

- Supabase support: https://supabase.com/support
- Attorney: _[fill in before launch]_
- Support inbox: _[see `src/legal/config.ts`]_
