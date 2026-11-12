# Answering privacy requests

What to do when someone emails ruststrengthsupport@gmail.com to see, correct,
delete or stop their data. The deadlines differ by country (section 7). To
keep one process, **answer every request within 20 working days**, New
Zealand's limit and the shortest of them; that meets every other deadline the
Privacy Policy gives. Nothing here has been reviewed by a lawyer.

## 1. The same day: log it

Keep a private log, a spreadsheet outside this repo, with one row per request:
- the date received;
- the email address;
- the country they say they live in, if they say;
- what they asked for;
- the date you answered;
- what you did.

Keep rows for at least two years. Don't put the log in the repo.

The **clock starts when the email arrives**, not when you confirm who they
are.

**Answer in the language they wrote in.** If someone writes in French, answer
in French: Quebec's language law gives consumers the right to be served in
French. A translation tool is fine.

## 2. Confirm it's them

- **From the account's email address:** that is enough. Look the account up in
  Supabase (Authentication > Users, search the address).
- **From another address:** reply asking them to write from the address on the
  account, or to make the request from inside the app (Download my data,
  Delete account). Don't act on it until they do. If they can't, ask for
  something only the account holder would know, such as their username and
  roughly when they signed up. Ask for no more than you need.

Never send someone's data to an address that isn't on their account.

## 3. Do it

| They ask to | Do this |
|---|---|
| See their data, or know what you hold | Point them to Profile > Privacy & legal > Download my data. If they can't sign in, run the export for them in the Supabase SQL editor (below) and send the result only to the account's address. Either way, include the list of who receives their data from Privacy Policy section 5 (and, for health data, Consumer Health Data Privacy Policy section 3), with the contact addresses there |
| Correct something | Most of it can be changed in the app. Otherwise correct the row for them, and tell them what you changed |
| Delete their data | Point them to Profile > Privacy & legal > Delete account, or delete the account for them in Supabase (Authentication > Users > Delete user), which removes everything through the cascades. If they have Pro, also delete their customer in RevenueCat. Tell them Apple's purchase record stays with Apple |
| Delete only some of it | Most of it can be deleted in the app. Otherwise delete the rows they name, as them |
| Stop (withdraw consent) | Explain the switches (feed, Share daily steps, run maps) and that deleting what a feature holds stops it. Health information is what the app records, so withdrawing that consent entirely means deleting the account; say so plainly, and don't push |
| Restrict or object (UK and EU) | Ask what they want stopped. Security, abuse prevention and moderation rely on our legitimate interests; if they object to one of those, weigh it and answer with reasons |
| Have their data to take elsewhere (UK, EU, Quebec) | The Download my data export is JSON, a structured, commonly used format. Send it as a file if they ask |
| De-index, or stop their name being findable (Quebec) | Their handle is searchable only once they chose it. Offer to reset it to a random one, which takes them out of search |
| Something unclear | Ask what they want. The clock keeps running |

**Known gaps in the export** (November 7, 2026, from
`legal/RECORDS_OF_PROCESSING.md`):
- It leaves out the exercises inside presets and planned sessions, the reports
  they filed, and their sign-in provider identity.
- If someone asks for everything, add those by hand from the SQL editor until
  the export is fixed.

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

## 4. Answer within 20 working days

Answer in writing, from the support address. If you truly need longer, use
the extension their country allows (section 7). Tell them **before the first
deadline runs out**, with the reason.

Requests are free.
- **Washington:** up to twice a year per person.
- **UK and EU:** a fee is allowed only for requests that are manifestly
  unfounded or excessive. Don't charge one.

## 5. If you say no

Say why, and tell them how to challenge it:
- **Washington:** they can appeal by replying with "Appeal" in the subject.
  Answer an appeal in writing within 45 days, with your reasons. If you still
  say no, include: "You can file a complaint with the Washington State Attorney
  General at https://www.atg.wa.gov/file-complaint".
- **Everywhere else:** offer to look at it again if they reply, and give the
  regulator from section 7.

## 6. Things that make this easier

- Turn on two-factor sign-in for the Supabase, GitHub, Apple Developer,
  RevenueCat, Expo and Gmail accounts. Only you should have access to the
  database.
- Supabase's Data Processing Addendum is part of its Terms of Service
  automatically (https://supabase.com/legal/dpa), so there is nothing to sign.
  It includes the EU standard contractual clauses and the UK Addendum.
- Once a UK or EU representative is appointed, requests may reach you through
  them. Treat those the same way, with the same deadline.
- If someone reports a data breach, follow INCIDENT_RESPONSE.md.

## 7. By country

Added November 7, 2026. These follow what the Privacy Policy (section 13)
promises; where a law allows longer, the policy's shorter promise wins.

| Where they live | Their rights | Deadline in the policy | Extension | Regulator, if they're not satisfied |
|---|---|---|---|---|
| Washington | See, delete, withdraw consent, appeal | 45 days | Once, up to 45 more, with notice | Washington State Attorney General, https://www.atg.wa.gov/file-complaint |
| California and other US states | Know, access, correct, delete | 45 days | Once, up to 45 more, with notice | The state's attorney general or privacy agency |
| New Zealand | Access and correction | 20 working days | Possible under the Privacy Act, with notice and reasons; avoid it | Privacy Commissioner, https://www.privacy.org.nz |
| Australia | Access and correction | 30 days | None promised | OAIC, https://www.oaic.gov.au |
| Canada | Access, correction, withdraw consent | 30 days | Once, up to 30 more, with notice | Office of the Privacy Commissioner of Canada, https://www.priv.gc.ca |
| Quebec | Access, correction, withdraw consent, portability, de-indexing | 30 days | Not in the Quebec Act; don't plan on one | Commission d'accès à l'information, https://www.cai.gouv.qc.ca |
| UK | Access, rectification, erasure, restriction, portability, objection, withdraw consent | One month | Up to two more months for complex or many requests, with notice in the first month | ICO, https://ico.org.uk |
| EU, Iceland, Liechtenstein, Norway | As the UK | One month | As the UK | The data protection authority where they live (https://www.edpb.europa.eu/about-edpb/about-edpb/members_en) |

The extension rules are summarised from memory of each law, not checked
against the text today. If you are about to rely on one, check it first.
