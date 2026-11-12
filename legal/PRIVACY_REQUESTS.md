# Answering privacy requests

What to do when someone emails ruststrengthsupport@gmail.com to see, delete or
stop their data. The deadlines come from Washington's My Health My Data Act
(RCW 19.373.040), which is the strictest law the app may be under. Following
them for everyone keeps one process. Nothing here has been reviewed by a
lawyer.

## 1. The same day: log it

Keep a private log, a spreadsheet outside this repo, with one row per request:
date received, the email address, what they asked for, the date you answered,
and what you did. Keep rows for at least two years. Don't put the log in the
repo.

The **45-day clock starts when the email arrives**, not when you confirm who
they are.

## 2. Confirm it's them

- **From the account's email address:** that is enough. Look the account up in
  Supabase (Authentication > Users, search the address).
- **From another address:** reply asking them to write from the address on the
  account, or to make the request from inside the app (Download my data,
  Delete account). Don't act on it until they do. If they can't, ask for
  something only the account holder would know, such as their username and
  roughly when they signed up.

Never send someone's data to an address that isn't on their account.

## 3. Do it

| They ask to | Do this |
|---|---|
| See their data, or know what you hold | Point them to Profile > Privacy & legal > Download my data. If they can't sign in, run the export for them in the Supabase SQL editor (below) and send the result only to the account's address. Either way, include the list of who receives health data from the Consumer Health Data Privacy Policy, section 3, with the contact addresses there |
| Delete their data | Point them to Profile > Privacy & legal > Delete account, or delete the account for them in Supabase (Authentication > Users > Delete user), which removes everything through the cascades. If they have Pro, also delete their customer in RevenueCat. Tell them Apple's purchase record stays with Apple |
| Delete only some of it | Most of it can be deleted in the app. Otherwise delete the rows they name, as them |
| Stop (withdraw consent) | Explain the switches (feed, Share daily steps, run maps) and that deleting what a feature holds stops it. If they want everything stopped, that is deleting the account |
| Something unclear | Ask what they want. The clock keeps running |

**Exporting for someone who can't sign in.** In the Supabase SQL editor, with
their user ID from Authentication > Users in place of `USER-ID`. It reads only;
the `rollback` undoes the role change:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"USER-ID","role":"authenticated"}', true);
select public.rpc_export_my_data();
rollback;
```

## 4. Answer within 45 days

Answer in writing, from the support address. If you truly need longer, you may
extend once by up to 45 more days, but you must tell them **within the first
45 days**, with the reason.

Requests are free, up to twice a year per person.

## 5. If you say no

Say why, and tell them they can appeal by replying with "Appeal" in the
subject. Answer an appeal in writing within 45 days, with your reasons. If you
still say no, include this:

> You can file a complaint with the Washington State Attorney General at
> https://www.atg.wa.gov/file-complaint

## 6. Things that make this easier

- Turn on two-factor sign-in for the Supabase, GitHub, Apple Developer,
  RevenueCat, Expo and Gmail accounts. Only you should have access to the
  database.
- Supabase's Data Processing Addendum is part of its Terms of Service
  automatically (https://supabase.com/legal/dpa), so there is nothing to sign.
- If someone reports a data breach, follow INCIDENT_RESPONSE.md.
