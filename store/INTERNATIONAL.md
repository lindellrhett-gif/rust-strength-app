# Selling outside the United States

Where each country stands, and what's left before you tick it in App Store
Connect. Updated November 7, 2026. **Not reviewed by a lawyer.** The rules
change, so recheck anything older than a few months before acting on it.

## Where things stand

| Country | Ships with | Done in code and documents | Left for you | 
|---|---|---|---|
| New Zealand | The live 1.1.1, now ([PR #8](https://github.com/lindellrhett-gif/rust-strength-app/pull/8)) | Privacy Policy section; Terms consumer-law wording; breach steps | The postal address; merge #8; publish the site |
| Australia | The live 1.1.1, now (PR #8) | As New Zealand, plus the under-16 social media self-assessment (`legal/AU_SOCIAL_MEDIA_AGE.md`) | As New Zealand |
| Canada | 1.2 | Privacy Policy section (PIPEDA and Quebec); health consent; sharing off by default; French Terms and Privacy Policy; Quebec assessment (`legal/QUEBEC_PIA.md`) | Get the French checked; the email provider. Minimum age 14 in Canada (decided November 7, 2026) |
| United Kingdom | 1.2 | UK GDPR section; health consent; sharing off by default; records and impact assessment (`legal/RECORDS_OF_PROCESSING.md`); Online Safety Act assessments (`legal/UK_ONLINE_SAFETY.md`); moderation and breach steps | A UK representative; the ICO fee check; the email provider |
| EU, Iceland, Liechtenstein, Norway | 1.2 | As the UK, plus a minimum age of 16 there and the Digital Services Act duties in the Terms and moderation runbook | An EU representative; trader status; the email provider |
| Mainland China | Not planned | | Needs an ICP filing number; leave it off |

## New Zealand and Australia, on the live app now

1. **Postal address.** Put the LLC's mailing address in `postalAddress` in
   `src/legal/config.ts`, on the `feature/nz-australia` branch (PR #8) and on
   the 1.2 branch. A registered agent's address or a PO box is fine.
   New Zealand's Privacy Act requires one, and the site build refuses to
   publish while it is a placeholder.
2. **Merge PR #8** into `main`.
3. **Publish the site** from `C:\dev\gym-app` on `main`, with
   `rust-strength-site` checked out next to it: run `npm run legal`, then
   commit and push the site repo. Check that `privacy.html` has section 13,
   "If you live outside the United States", with your address in it.
4. **App Store Connect → Pricing and Availability → App Availability:** add
   New Zealand and Australia. 1.1.1 has nothing to buy, so there are no
   product prices to check yet.
5. Nothing else is needed. The live app still shows its bundled 1.5.0
   documents without the new section; the website carries 1.5.1, and 1.2
   brings it into the app. A patch version, so nobody is asked to accept
   again.

The Australian Privacy Act might not apply (businesses under A$3 million
turnover are usually exempt, unless they provide a "health service"). The
documents are written as if it does, which is safe either way.

## Canada, with 1.2

1. **The French translations** (`src/legal/fr/`) are drafts that two reviewers
   have checked against the English, but not a French-speaking lawyer. Have a
   fluent French speaker, ideally a Quebec lawyer, read them before Canada
   goes on. Both versions are stated to be equally valid, so a mistranslation
   is a real risk.
2. **Quebec under 14: decided November 7, 2026.** The minimum age is 14
   when the phone's region is Canada, since Quebec's law requires a parent's
   consent under 14 and the app can't tell Quebec from the rest of Canada
   (`src/domain/age.ts`). Done in the app and the documents.
3. **Answer French emails in French.** Quebec's language law gives consumers
   the right to be served in French. A translation tool is fine.
4. **Replace the Gmail sender** for sign-up and password codes with a
   transactional email provider that offers a written data processing
   agreement (Postmark, Resend, Mailtrap and similar). Consumer Gmail has
   none. This also unblocks the UK and the EU.
5. Then tick Canada.

## United Kingdom, with 1.2

1. **Appoint a UK representative** (UK GDPR Article 27). Services that do this
   charge a yearly fee; compare a few. Put their name, address and email in
   `ukRepresentative` in `src/legal/config.ts`, bump `version` by a patch
   (1.6.0 to 1.6.1, so nobody is asked to accept again), update the two
   `*_FR_SOURCE_VERSION` constants to match, rebuild and republish the site.
2. **Check the ICO data protection fee.** The ICO has a short self-assessment
   on its site. Its site blocked automated checks, so this wasn't confirmed.
3. **The email provider** (Canada, step 4).
4. **Keep `legal/UK_ONLINE_SAFETY.md` current**, and do its open actions.
5. Then tick the United Kingdom.

## EU, Iceland, Liechtenstein and Norway, with 1.2

1. **Appoint an EU representative** (GDPR Article 27) and a **Digital Services
   Act legal representative** (Article 13). One firm usually does both.
   Choose one based in Ireland or Malta: the Act asks for a contact language
   that is official where the representative is, and English is official in
   both. Fill in `euRepresentative` the same way as the UK one.
2. **Trader status.** After the account conversion, declare Bluestem Software
   LLC a trader in App Store Connect → Business. EU users will see the LLC's
   D-U-N-S address, a phone number and an email; use business ones. Apple
   removes apps without verified trader status from the EU App Store.
3. **The email provider** (Canada, step 4).
4. Then tick the EU countries, Iceland, Liechtenstein and Norway.

The app already asks for 16 rather than 13 when the phone's region is in one
of those countries (`src/domain/age.ts`).

## In App Store Connect, for any country

- **Pick the countries.** App → **Pricing and Availability** → App
  Availability → Edit.
- **Check the products.** Open Pro Monthly, Pro Yearly and Pro Lifetime and
  make sure each one's Availability includes the new countries.
- **Review the prices** Apple generates from the US price. Prices in the EU,
  the UK, Australia and New Zealand include VAT or GST, so you keep less per
  sale than in the US.
- **Check the free month** covers the new countries.
- **Answer anything new** it asks per country. Export compliance is already
  answered (standard encryption only).
- **Optional:** English (U.K.), English (Australia) and English (Canada)
  listings, copied from the U.S. text.

Apple sells the app and subscriptions in each country, collects the VAT or
GST, and handles refunds. Fill in any tax forms App Store Connect asks for
under Business.

## The documents

| File | What it is |
|---|---|
| `src/legal/privacy.ts`, section 13 | What each country's law asks the Privacy Policy to say |
| `src/legal/terms.ts`, sections 2, 6, 15 and 18 | The age rule, reporting and moderation, consumer law by country, languages |
| `src/legal/fr/` | The French Terms and Privacy Policy |
| `legal/AU_SOCIAL_MEDIA_AGE.md` | Why Australia's under-16 social media rule doesn't cover the app |
| `legal/RECORDS_OF_PROCESSING.md` | The UK and EU record of processing and the impact assessment |
| `legal/UK_ONLINE_SAFETY.md` | The UK Online Safety Act risk assessments |
| `legal/QUEBEC_PIA.md` | Quebec's assessment for data stored outside Quebec, and its checklist |
| `legal/MODERATION.md`, `legal/INCIDENT_RESPONSE.md`, `legal/PRIVACY_REQUESTS.md` | What to do with reports, breaches and requests, by country |

## Leave out for now

- **Mainland China.** Apple requires an ICP filing number, which in practice
  needs a Chinese business or partner.
- **Everywhere else** (South Korea, Japan, Brazil, India and so on). Each has
  its own privacy law. Add them one at a time if people ask.
