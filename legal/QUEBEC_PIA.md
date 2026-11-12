# Quebec: assessment of communications outside Quebec, and Law 25 checklist

Bluestem Software LLC's privacy impact assessment for communicating Quebec
residents' personal information outside Quebec, and its checklist against
Quebec's private-sector privacy Act, for Rust Strength. Written November 7,
2026, against app version 1.2 (branch `feature/nutrition`), migrations `0001`
to `0031` and legal documents 1.6.0.

**Not reviewed by a lawyer.** This file records what the code does and our
reasoning in good faith. It does not say the app meets Quebec's law or any
other law. Points we could not check, or where the law is unclear, are marked
**Uncertain** or **Not checked**.

**Status since this was written (November 7, 2026, later the same day).** The body
below describes the code as first found. Since then:

- **T4 (R2), fixed, half live.** Migrations `0033_profile_names.sql` and
  `0034_profiles_owner_only.sql` stop anyone but the owner reading a profile row;
  `0032_friendship_integrity.sql` also stops forced friendships and requests across
  a block. 0032 and 0033 went on the live database on November 7, 2026; 0034 waits
  for 1.2's release day.
- **L3, done.** Canada and Quebec breach steps and an incident register, kept five
  years, are in `legal/INCIDENT_RESPONSE.md`.
- **L4, done.** `legal/PRIVACY_REQUESTS.md` now has:
  - one 20-working-day deadline that meets every region;
  - 30 days for Canada and Quebec;
  - portability;
  - de-indexing by resetting the handle;
  - French replies.
- **L6, done.** Both sentences are reworded, in English and French: the GPS preview
  before Start, and "profiling".
- **L8, done.** "Keep private" and "Share" are equal buttons.
- **D4, done.** The share card's "Show the route" now starts off.
- **The Gmail mismatch in the Privacy Policy is fixed;** the provider itself is still
  consumer Gmail.
- **D1, decided November 7, 2026: option A.** The minimum age is 14 when the
  phone's region is Canada (`src/domain/age.ts`, `LEGAL.minimumAgeCanada`). The
  Terms (section 2) and the Privacy Policy (sections 10 and 13) say so in both
  languages.
- **Still open:**
  - replacing Gmail;
  - Open Food Facts;
  - the French review;
  - the governance summary;
  - retention limits;
  - the other items below not listed here.

**The law referred to.**
- "The Act": the Act respecting the protection of personal information in the
  private sector (CQLR c P-39.1), as amended by Law 25 (SQ 2021, c 25). Law
  25's changes came into force in stages between September 2022 and September
  2024, as we understand it. Every section used below is in force.
- "The Charter": the Charter of the French language (CQLR c C-11), as amended
  in 2022 (SQ 2022, c 14, known as Bill 96).

LégisQuébec refused automated access on November 7, 2026, so no section here
is quoted from the official text. Each is paraphrased from our understanding
of the English version and from secondary sources. Read the section on
LégisQuébec before relying on it. Where we are less sure of a number or its
wording, it says so.

**Keep it current.** Update Part 1 in the same change as any new recipient,
any change of hosting, or a recipient changing its terms. Review the whole
file at least once a year, together with `legal/RECORDS_OF_PROCESSING.md`.

---

## At a glance

### Recipients outside Quebec

| Recipient | Where | Sensitivity | Written agreement | Conclusion |
|---|---|---|---|---|
| Supabase (with AWS) | USA (AWS us-east-1) | High | Yes: Supabase's DPA | Adequate, with conditions (1.5.1) |
| Google, consumer Gmail | USA (not checked) | Low (codes) to Moderate (inbox) | **No** | **Not established.** Replace, or accept and record the risk (1.5.2) |
| RevenueCat | USA | Low to Moderate | **Not on file** | Likely adequate once its DPA is on file (1.5.3) |
| Apple | USA | Low to Moderate | Apple's developer agreement only | Acceptable (1.5.4) |
| Google, Sign in with Google | USA | Low | Google's developer terms only | Acceptable (1.5.5) |
| Open Food Facts | France (servers not checked) | Low | None | Acceptable on the legal framework. Accept and record, or proxy (1.5.6) |

### Decisions for the owner

1. **Quebec children under 14 (2.9). The largest open point.** The Act needs
   a parent's consent to collect information from a child under 14. The
   app's minimum age in Canada is 13, and it cannot tell Quebec from the rest
   of Canada. Options: raise Canada's minimum age to 14; build parental
   consent for 13-year-olds; or accept and record the risk.
   **Recommended: raise it to 14 for Canada, before Canada goes on sale.**
2. **The Gmail sender and support inbox (1.5.2).** Replace them before Canada
   goes on sale (recommended), or accept and record the risk.
3. **Open Food Facts (1.5.6).** Accept and record (recommended for now), or
   send its requests through our server.
4. **The share card's route switch (2.6).** It starts on. Recommended: start
   it off.
5. **French (2.14).** Whether to show the French documents first to French
   speakers, and whether the English-only app is acceptable under s 52.1. Both
   are judgement calls for a lawyer. The translations still need review.

---

# Part 1: Assessment of communications outside Quebec (s 17)

## 1.1 What the Act asks

**Section 17**, as we understand it:
- Before communicating personal information outside Quebec, an enterprise
  must assess the privacy impact. The assessment must take into account:
  1. the sensitivity of the information;
  2. the purposes it will be used for;
  3. the protection measures, including contractual ones, that would apply
     to it; and
  4. the legal framework in the State where it would go, including that
     State's personal information protection principles.
- The information may be communicated only if the assessment establishes
  that it would receive adequate protection, in particular in light of
  generally recognised principles of personal information protection.
- The communication must be the subject of a written agreement. The
  agreement takes into account the assessment's results and, where relevant,
  the terms agreed to reduce the risks it found.
- The same applies when the enterprise entrusts someone outside Quebec with
  collecting, using, communicating or keeping the information on its behalf.

**Section 18.3** (number and wording as we recall them; check): information
may be given without consent to a service provider that needs it to do work
for us. The mandate must be in writing. It must set out the measures the
provider takes to:
- keep the information confidential;
- use it only for the mandate; and
- not keep it after the mandate ends.

Supabase and RevenueCat work on our behalf, so both sections apply to them.

## 1.2 Does section 17 apply to us? Uncertain

- **We are not in Quebec.** Bluestem Software LLC is a US company. People in
  Quebec send their data straight from the app to systems the LLC runs in the
  United States.
- **Two open questions:**
  - whether the Act applies at all to an enterprise with no establishment in
    Quebec. As we understand it, the Commission d'accès à l'information takes
    the view that it does when the enterprise collects Quebecers'
    information. **Not checked.**
  - whether collecting directly from a Quebec resident into the US is a
    "communication outside Québec". The GDPR has the same question, noted in
    `legal/RECORDS_OF_PROCESSING.md` 1.3.
- **We assess anyway.** The Privacy Policy, section 13 (Canada), already
  says: "Before sending Quebec residents' information outside Quebec, we
  assessed the protection it receives there." This file is that assessment.
  The sentence is fully true only once this file is signed (Part 3) and the
  Gmail point in 1.5.2 is resolved or its risk accepted in writing.

## 1.3 How each recipient is assessed

- **What it receives**, from Privacy Policy section 5 (`src/legal/privacy.ts`),
  checked against the code.
- **Sensitivity.** The Act treats information as sensitive when its nature
  (medical, biometric or otherwise intimate) or the context of its use or
  communication gives a high reasonable expectation of privacy (s 12, as we
  understand it). Health information and precise run routes are sensitive.
  We rate each recipient Low, Moderate or High.
- **Purpose.** What the recipient does with it.
- **Contractual measures.** What is signed or accepted, and what is
  unverified.
- **Legal framework** where it goes (1.4).
- **Other measures**: technical controls and data minimisation.
- **Conclusion**, with the residual risk.

For "generally recognised principles" we use the ten principles in Schedule 1
of PIPEDA (from the CSA Model Code), which match the OECD Privacy Guidelines.
See 1.6.

## 1.4 The legal framework in the United States

This applies to every US recipient. It is a short summary.

### General privacy law

- **No general federal privacy law.** The US has no comprehensive federal
  privacy law for businesses like Quebec's Act or PIPEDA. Federal rules go
  sector by sector:
  - HIPAA covers health care providers, health plans and their business
    associates. Rust Strength is none of these.
  - COPPA covers children under 13, below the app's minimum age.
- **The FTC Act.** Section 5 forbids unfair or deceptive practices. The
  Federal Trade Commission uses it against companies that break their privacy
  promises, health apps among them (for example Flo Health in 2021, and
  GoodRx and BetterHelp in 2023).
- **The FTC's Health Breach Notification Rule** (16 CFR Part 318), as amended
  in 2024, may cover a health and fitness app like this one. Whether it does
  was **not checked**.
- **State laws.**
  - Around twenty states have general consumer privacy laws, California's
    among them (count not checked).
  - Washington, Nevada and Connecticut have laws for consumer health data.
  - Every state has a breach notification law.
- **Who state laws protect.** Each protects residents of its own state.
  Washington's health data law also covers data collected in Washington.
  Most general laws apply only above size thresholds. Virginia, where the
  servers are, protects Virginia residents. A Quebec resident gets little
  direct protection from any of them.

### Government access

- **FISA Section 702** (50 U.S.C. § 1881a).
  - **What it allows:** US intelligence agencies can require "electronic
    communication service providers" to help collect the communications and
    stored data of non-US persons reasonably believed to be outside the US,
    for foreign intelligence. Collection runs under yearly certifications
    approved by the Foreign Intelligence Surveillance Court.
  - **Why it matters here:** a Quebec resident is that kind of person.
    Hosting and cloud providers are likely within the definition, which a
    2024 law widened.
  - **Status:** the April 2024 reauthorisation ran to April 2026. Whether
    it was renewed after that, and on what terms, was **not checked**. We
    assume it is in force.
- **Executive Order 12333** governs intelligence collection outside the US
  that does not compel a provider.
- **Executive Order 14086** (2022).
  - **What it does:** signals intelligence must be necessary and
    proportionate, and there is a redress route (the Data Protection Review
    Court) for people from "qualifying states" designated by the Attorney
    General.
  - **Who it covers:** the EU/EEA and the UK are designated, as we understand
    it. Whether Canada is was **not checked**.
- **Law enforcement.** US authorities can get stored data:
  - from providers, with subpoenas, court orders or warrants under the
    Stored Communications Act;
  - from the LLC itself, the same way.
- **The CLOUD Act** (2018, 18 U.S.C. § 2713) confirms that a US provider must
  produce data in its possession, custody or control wherever it is stored.
  This data is stored in the US anyway, so ordinary US legal process reaches
  it directly. The CLOUD Act adds little here.
- **Constitutional protection.** The Fourth Amendment's protection against
  unreasonable searches gives non-US persons outside the US limited
  protection.

### What this means for a Quebec resident

US law alone does not give a Quebec resident protection comparable to the
Act's. There is no general right of access, correction or deletion, and no
independent privacy regulator with general powers. Government access powers
reach non-US persons with fewer safeguards than US persons get.

The realistic likelihood of government access is low. Training logs, food
diaries and run routes are not what these powers are aimed at. We have
received no request. But it cannot be ruled out, and the person affected would
usually not be told.

So for US recipients, adequate protection has to come mainly from contracts,
technical measures and our own commitments. The Privacy Policy, section 13,
says: "We apply this policy to it wherever it is." In the US, a broken
privacy promise is something the FTC can act on.

## 1.5 Recipient by recipient

### 1.5.1 Supabase, with AWS as its host

| | |
|---|---|
| Who | Supabase, contracting entity Supabase Pte. Ltd. Database, sign-in (Supabase Auth), Edge Functions and logs. Hosted by Amazon Web Services in us-east-1 (Virginia, USA), Supabase's sub-processor. Free plan |
| Role | Service provider working on our behalf (s 17, last part; s 18.3) |
| What it receives | Privacy Policy section 5: "Your account credentials and all app data described above". That is the email address and password hash; any Apple or Google account id; the profile; training, activities, runs with their full routes, privacy zones and saved routes; daily steps if shared; the food diary and the goal calculator's inputs, birth year included; friendships, blocks, reactions and reports; Pro status; the consent record. Also server logs with IP addresses and device user agents (`legal/RECORDS_OF_PROCESSING.md` P9). The phone's region is never sent (`src/lib/deviceRegion.ts`) |
| Sensitivity | **High.** Health information, precise timed routes that can show where someone lives, and data of teenagers |
| Purpose | Store and serve the app's data for the features the person uses. Nothing else |
| Contractual measures | Supabase's Data Processing Addendum (version 1, August 1, 2026), part of its Terms, accepted by using the service. Nothing to sign. It incorporates the EU Standard Contractual Clauses (Commission Implementing Decision (EU) 2021/914) and the UK Addendum. Details below |
| Legal framework | United States (1.4). Supabase Pte. Ltd is a Singapore company, so Singapore law may also bear on it. **Not checked:** Supabase's corporate structure, where its staff and support access data from, and its full sub-processor list |
| Other measures | `legal/RECORDS_OF_PROCESSING.md` 1.4, S1 to S10. The main ones: row-level security on every table, scoped to the owner; friends' data only through functions that check friendship, the sharing switch and blocks, returning summaries; TLS for all traffic; the `service_role` key only in Supabase; passwords hashed by Supabase Auth; deletion that cascades to every table. Minimisation: a random handle, no real name, no date of birth, Google's name and picture removed before storage (0029). **Known gap:** whole profile rows, bodyweight included, are readable by friends and pending requesters (RECORDS R2, high until fixed) |

**What the DPA provides.** It is a GDPR Article 28 processing agreement, so it
should contain Article 28's terms:
- processing only on our documented instructions;
- confidentiality of the people who handle the data;
- security measures;
- sub-processors only under written terms;
- help with requests and breaches;
- deletion or return at the end of the service;
- information and audits.

For EU and UK data, the SCCs add the importer's duties when a public authority
asks for data (Clause 15 of the 2021 clauses). Two points were **not checked
clause by clause**:
- whether the DPA covers personal data of people outside the EU and the UK,
  such as Quebec residents. This depends on how it defines the data it
  covers. Most such addenda cover all personal data the customer puts in the
  service. Confirm it;
- whether its breach notice timing suits the "promptly" in s 3.5.

**A standard agreement.** It cannot be negotiated and does not mention this
assessment. Section 17 asks for an agreement that "takes into account" the
assessment. Our view: an agreement whose terms cover the risks found here
meets that in substance. **Uncertain.**

**Conclusion: adequate protection, in our assessment, on the conditions in
1.8 (T2, T3, T4).**
- **Not from US law.** The US framework would not establish adequate
  protection on its own.
- **What does:** the DPA's processor terms, the technical measures, how
  little the app collects, and our own policy. That policy applies wherever
  the data is, and the FTC can act if we break it.
- **What remains:** US government access. Its likelihood is low for this
  kind of data.

**Residual risk: Low to Medium.** It is Medium until R2 is fixed, because
"you can only read your own rows" is one of the safeguards relied on here.

### 1.5.2 Google, consumer Gmail

| | |
|---|---|
| Who | Google, through a consumer Gmail account, ruststrengthsupport@gmail.com |
| Role | Two jobs. (1) Supabase Auth sends sign-up confirmation codes and password reset codes through Gmail's SMTP server from that address. (2) It is the support inbox: privacy requests, reports, appeals and any other email people send us |
| What it receives | (1) The person's email address and a one-time code, each time a code is sent. Gmail likely keeps a copy of each in the Sent folder (**not checked**). (2) Everything people write to us, which can include health information, information about third parties (reports) and children's information |
| Sensitivity | Codes: **Low**. The inbox: **Moderate** |
| Purpose | Deliver codes; receive and answer email |
| Contractual measures | **None that fit.** Google's consumer Terms of Service and Privacy Policy govern Google's relationship with the account holder. They are not an agreement setting protection measures for our users' information, as s 17 and s 18.3 expect. Consumer Gmail has no data processing agreement |
| Legal framework | United States (1.4). Where Gmail stores the data: **not checked** |
| Other measures | Code emails contain only the address and the code, and codes expire under Supabase's setting. Two-factor sign-in on the account is recommended in `legal/PRIVACY_REQUESTS.md`; **not checked** that it is on |

**The Privacy Policy understates this.** Section 5's table says Gmail "sends
password reset emails" only. Section 1 and the code say it also sends sign-up
confirmation codes. The table does not mention the support inbox. The French
translation has the same gap (RECORDS 2.7, finding 3).

**Conclusion: adequate protection is not established.** The reason is mainly
the missing written agreement, not the data. Options:
1. **Replace it before Canada goes on sale. Recommended.**
   - **Codes:** send them through a transactional email provider that offers
     a written data processing agreement (Postmark, Resend, Mailtrap and
     similar). This is a change of SMTP settings in Supabase
     (`store/INTERNATIONAL.md`, Canada step 4).
   - **Support inbox:** move it to a business mailbox that comes with a
     processing agreement, for example Google Workspace, which as we
     understand it offers a Cloud Data Processing Addendum. Both need the
     LLC's own domain.
   - **Then:** delete old code emails from the Sent folder, and correct
     Privacy Policy section 5 in both languages.
2. **Accept and record the risk.** Sign it in Part 3. Low sensitivity for the
   codes makes this defensible for a short time. It does not meet the
   written-agreement rule. The inbox is the harder part to defend.

**Residual risk: Medium until replaced.**

### 1.5.3 RevenueCat

| | |
|---|---|
| Who | RevenueCat, Inc., USA |
| Role | Service provider working on our behalf: shows the Pro plans, checks purchases with Apple, tells the app whether the person has Pro, and runs the manage-plan and purchase-help screen |
| What it receives | Privacy Policy section 5: the random account id (the app calls `Purchases.logIn(userId)` with the account's UUID and sends no email or name, `src/lib/purchases.ts`); the plan, purchase date, price and currency, Apple's transaction ids, trial, renewal, refund and expiry; app and device details needed for purchases (app version, operating system, App Store country and currency); any answers in its purchase-help screen. Like any connection, the phone's IP address (assumed, **not checked**). No training, runs, food diary or other app data. Nothing at all while subscriptions are off: the SDK is not started (`subscriptionsOn`) |
| Sensitivity | **Low to Moderate.** Purchase information is financial in kind. That someone bought Pro hints that they may use the food diary. Pseudonymous at RevenueCat, but we can link it to the account |
| Purpose | Sell and check Pro |
| Contractual measures | RevenueCat's terms, accepted when its account was opened. As we understand it, RevenueCat offers a data processing agreement. **Not checked:** whether it has been accepted, its version and date, whether it covers information about people outside the EU, and how it handles deletion and breaches |
| Legal framework | United States (1.4) |
| Other measures | Only the public SDK key is in the app; the secret key and webhook secret are in Supabase Edge Function secrets. At account deletion, `delete-account` deletes the RevenueCat customer, but only when `REVENUECAT_SECRET_API_KEY` is set (RECORDS P1). Our copy of Pro status (`subscriptions`) is readable only by its owner and written only by the webhook |

**Conclusion: likely adequate, once a written DPA is on file.** The data is
small and pseudonymous, and it holds no health data. Until the DPA is
accepted and saved, the written-agreement rule is not shown to be met.
**Residual risk: Low** once T5 is done.

### 1.5.4 Apple

| | |
|---|---|
| Who | Apple, USA |
| Role | Its own controller under its own privacy policy, not our service provider. Three parts: Sign in with Apple, Apple Maps, App Store purchases |
| What it receives | **Sign in with Apple:** Apple confirms the person's Apple ID and sends us their email address (or private relay address) and an account id. At account deletion, `delete-account` sends Apple a fresh authorization code to revoke the app's access. **Apple Maps:** requests from the phone for the map of the area on screen, with the IP address. That includes the recording screen before and during a run, so Apple can infer roughly where the person is. Routes are drawn on the phone and not sent. **Purchases:** between the person and Apple, who is the seller |
| Sensitivity | Sign-in: **Low**. Maps: **Low to Moderate** (approximate location and time, not linked to the account by us) |
| Purpose | Sign-in at the person's choice; map display; payment |
| Contractual measures | Apple's developer agreement, which governs MapKit and Sign in with Apple. It is not a data protection agreement for our users. The developer account is an Individual account, not the LLC's (`legal/LEGAL_AUDIT.md` section 15, open question 1). How Apple handles Maps requests: **not checked** |
| Legal framework | United States (1.4) |
| Other measures | We ask Apple for the email only, not the name. The Sign in with Apple token is never stored |

**Conclusion: acceptable.**
- **Sign-in:** the person chooses it, and most of what moves comes from
  Apple to us.
- **Maps:** requests reveal little, and we do not link them to the account.

Whether Apple's developer agreement meets s 17's written-agreement rule for
the little we send is **uncertain**. **Residual risk: Low.**

### 1.5.5 Google, Sign in with Google

| | |
|---|---|
| Who | Google, USA |
| Role | Its own controller |
| What it receives | The sign-in request from Google's SDK on the phone. What else the SDK sends was **not checked**. Google sends us the email address, an account id, the person's name and a link to their picture. We drop the name and picture before storage (`strip_sign_in_profile`, 0029) |
| Sensitivity | **Low** |
| Purpose | Sign-in, at the person's choice |
| Contractual measures | Google's developer terms for its sign-in service, accepted when the sign-in client was set up. Which ones: **not checked**. Not a data protection agreement |
| Legal framework | United States (1.4) |

**Conclusion: acceptable.** The same reasoning as Apple's sign-in. **Residual
risk: Low.**

### 1.5.6 Open Food Facts

| | |
|---|---|
| Who | Open Food Facts, a French non-profit food database. Server location **not checked** |
| Role | Its own controller |
| What it receives | When the person scans or types a barcode, or searches for a packaged food: the barcode or the words searched, sent straight from the phone to `world.openfoodfacts.org` (`src/domain/nutrition/openFoodFacts.ts`), with the IP address and a User-Agent naming the app and its support address, not the person (`OFF_USER_AGENT`). Not the account, the diary or anything else logged |
| Sensitivity | **Low.** A search shows interest in a food. Open Food Facts could link it to an IP address, but not to our account |
| Purpose | Look up packaged foods for the food diary |
| Contractual measures | None. Open Food Facts' terms of use and the Open Database License cover its data, not personal information |
| Legal framework | France: the GDPR and French law, with an independent supervisory authority (the CNIL). Its principles are broadly comparable to the Act's |

**Conclusion: acceptable on the legal framework, but there is no written
agreement.** Whether s 17 applies to a request the person's own phone sends,
at their request, is **uncertain**. Options:
1. **Accept and record the risk. Recommended for now.** The sensitivity is
   low and the law there is comparable.
2. **Proxy the requests through a Supabase Edge Function.** Open Food Facts
   would then see our server rather than the person's IP address, and would
   receive no personal information. Costs: function calls, a little
   latency, and barcodes and search words passing through Supabase.

**Residual risk: Low.**

### 1.5.7 Not treated as communications by us

- **Accepted friends.** The person chooses to share and whom with. Friends
  may be anywhere. This is a communication to third persons with the person's
  consent (the sharing switches, 2.6). We do not treat it as a s 17
  communication. **Uncertain.**
- **Recipe websites.** The phone loads a page the person chose, as a browser
  would. Nothing is sent by us, and the link is not stored.
- **USDA FoodData Central.** The catalog is in our own database. Searching it
  sends nothing to the USDA.
- **GitHub Pages** hosts the website and logs visitors' IP addresses under
  GitHub's terms. No app data.
- **Expo / EAS** builds the app and receives no user data. The app does not
  use Expo's over-the-air updates (checked: no `expo-updates` in
  `package.json` or `app.json`).
- **The LLC itself** is in the US. The owner reads data from the US, in the
  Supabase SQL editor, for moderation and requests.
- **Authorities**, only if the law requires, case by case.

## 1.6 Generally recognised principles

How the Supabase arrangement measures up against the ten principles in PIPEDA
Schedule 1. The other recipients receive much less (1.5).

| Principle | Where it comes from for data in the US | Gap |
|---|---|---|
| 1. Accountability | We stay responsible. Privacy Officer named (2.1). This file and the DPA | Governance summary not published (2.2) |
| 2. Identifying purposes | Privacy Policy sections 2 and 3 | |
| 3. Consent | Separate health consent (2.5); sharing off by default (2.6) | Children under 14 (2.9) |
| 4. Limiting collection | Minimisation in RECORDS 2.4 | |
| 5. Limiting use, disclosure, retention | DPA: Supabase processes only on our instructions. Data deleted with the account | No retention limits for some records (2.13) |
| 6. Accuracy | People edit or delete their own data in the app | |
| 7. Safeguards | RLS, TLS, hashed passwords, key handling (1.5.1) | R2 profile rows; free-plan backups not checked (RECORDS R10) |
| 8. Openness | Privacy Policy in English and French, on the website | Gmail row understated (1.5.2) |
| 9. Individual access | Download my data, in the app (2.10) | Some tables missing from the export (2.10) |
| 10. Challenging compliance | Email first, then the Commission d'accès à l'information (Privacy Policy section 13) | Request runbook uses 45 days, not 30 (2.10) |

US law adds little on its own (1.4). The protection rests on our practices and
the contract.

## 1.7 Conclusions

| Recipient | Adequate protection? | Written agreement | Residual risk |
|---|---|---|---|
| Supabase | Yes, in our assessment, on conditions T2 to T4 | Yes (DPA). Fit with s 17's wording uncertain | Low to Medium |
| Gmail | **Not established** | **No** | Medium |
| RevenueCat | Likely, once T5 is done | **Not on file** | Low once done |
| Apple | Acceptable | Developer agreement only | Low |
| Google Sign-In | Acceptable | Developer terms only | Low |
| Open Food Facts | Acceptable on the framework | None | Low |

## 1.8 Open actions for Part 1

| # | Action | When |
|---|---|---|
| T1 | Replace consumer Gmail for codes and the support inbox (1.5.2), or accept and record the risk in Part 3 | Before Canada goes on sale |
| T2 | Save a dated PDF of Supabase's DPA and Terms outside the repo. Check that the DPA covers all personal data in the project, not only EU and UK data | Before Canada |
| T3 | Read Supabase's sub-processor list and note where staff and support can access data | Before Canada |
| T4 | Fix R2: stop friends and pending requesters reading whole profile rows (RECORDS A8) | With 1.2 |
| T5 | Accept RevenueCat's DPA, save a dated copy, and note it here. Confirm `REVENUECAT_SECRET_API_KEY` is set in production (RECORDS A6) | Before Canada |
| T6 | Correct Privacy Policy section 5's Gmail row in English and French: sign-up codes too, and the support inbox (or the new providers after T1) | With T1 |
| T7 | Decide Open Food Facts: accept and record, or proxy (1.5.6) | Before Canada |
| T8 | Recheck government access at the next review: Section 702's status after April 2026, and whether Canada is a qualifying state under EO 14086 | Next review |
| T9 | Sign Part 3, so the Privacy Policy's "we assessed" sentence is true | Before Canada |

---

# Part 2: Law 25 checklist for Rust Strength

Status: **Done** (in the code or documents), **Partly done**, **Action
needed**, **Decision needed**, or **Judgement call** (a legal reading a lawyer
should check).

| # | Requirement | Section | Status |
|---|---|---|---|
| 2.1 | Person in charge of protecting personal information | s 3.1 | Done, except the postal address |
| 2.2 | Governance policies, published | s 3.2 | **Action needed** |
| 2.3 | Impact assessments for new projects | s 3.3 | Done for 1.2; keep up |
| 2.4 | Confidentiality incidents: register and notice | ss 3.5 to 3.8 | **Action needed** |
| 2.5 | Consent, express for sensitive information | ss 12, 14 | Done, with caveats |
| 2.6 | Most private settings by default | s 9.1 | Done, except the share card route switch |
| 2.7 | Technology that can identify, locate or profile | s 8.1 | Location done; profiling **judgement call** |
| 2.8 | Information at collection; published policy | ss 8, 8.2 | Done, except the Gmail row |
| 2.9 | **Minors under 14** | ss 4.1, 14 | **Decision needed** |
| 2.10 | Access, correction, portability | ss 27, 28, 32 | Partly done |
| 2.11 | De-indexing and stopping dissemination | s 28.1 | Covered by existing tools |
| 2.12 | Automated decisions; other rights | s 12.1 | Done in substance |
| 2.13 | Retention and destruction | s 23 | **Action needed** |
| 2.14 | French language | Charter ss 50.2, 52.1, 55 | Partly done; judgement calls |

## 2.1 Person in charge (s 3.1). Done, except the postal address

**The rule.** The person with the highest authority in the enterprise is in
charge of protecting personal information. They can delegate all or part of
the role in writing. The title and contact information must be published on
the enterprise's website.

**What we have.**
- The owner holds the role, by default, as the person with the highest
  authority. No delegation is needed.
- It is published by title, "Privacy Officer" (`LEGAL.privacyOfficerTitle`),
  with `ruststrengthsupport@gmail.com`, in Privacy Policy sections 13
  (Canada) and 14, on the website.
- The French version names the role in the Act's French term, "responsable
  de la protection des renseignements personnels", with the English title
  beside it.

**Gap.** `LEGAL.postalAddress` is still a TODO placeholder, and it prints
next to the title. Whether the email alone counts as "contact information" is
**uncertain**. Fill it in anyway; New Zealand needs it too.

## 2.2 Governance policies, published (s 3.2). Action needed

**The rule.** An enterprise must have governance policies and practices for
personal information, proportionate to its size. They must:
- frame how information is kept and destroyed;
- set out the roles and responsibilities of staff over the information's
  life cycle;
- set a process for complaints;
- be approved by the person in charge.

Detailed information about them must be published on the website in clear
and simple terms.

**What we have.** Runbooks in the repo, not published:
- `legal/PRIVACY_REQUESTS.md`;
- `legal/INCIDENT_RESPONSE.md`;
- `legal/MODERATION.md`;
- `legal/RECORDS_OF_PROCESSING.md`;
- this file.

The Privacy Policy covers part of it: retention (section 7), deletion
(section 8) and complaints (section 13, "email us first").

**Action.** Publish a short page or Privacy Policy section, in English and
French, approved by the owner as person in charge. It should say:
- who is responsible: one person does everything;
- how long each kind of record is kept and how it is destroyed (2.13);
- how complaints are handled and how fast;
- that incidents are logged and assessed (2.4);
- that new features are assessed first (2.3).

## 2.3 Impact assessments for projects (s 3.3). Done for 1.2; keep up

**The rule.** An enterprise must assess any project to acquire, develop or
overhaul an information system or an electronic service delivery system that
involves personal information. The assessment must be proportionate, and
the person in charge consulted from the start. The project must let
information collected from the person be given back to them in a structured,
commonly used technological format.

**What we have.**
- `legal/RECORDS_OF_PROCESSING.md` Part 2 (the GDPR impact assessment) and
  this file cover 1.2, including the food diary and Pro.
- RECORDS 2.10 lists what triggers a new review: the AI coach listed as a
  Pro feature (`src/domain/subscription.ts`), public profiles or messages,
  new data sources such as Apple Health, an Android app, any new recipient,
  and a change of hosting.

**Action.** Treat RECORDS 2.10 as the Quebec trigger list too. Before any of
those ships, update RECORDS Part 2 and Part 1 of this file, and check that
the new data is in the export.

## 2.4 Confidentiality incidents (ss 3.5 to 3.8). Action needed

**The rule.**
- **What counts (s 3.6):** access, use or communication not authorised by
  law, loss of the information, or any other breach of its protection.
- **What to do (s 3.5):**
  - take reasonable steps to reduce the risk of injury and stop it
    happening again;
  - if there is a risk of serious injury, promptly notify the Commission
    d'accès à l'information and each person concerned. Others who could
    reduce the risk may also be told.
- **How to judge the risk (s 3.7):** weigh the sensitivity of the
  information, the likely consequences of its use, and the likelihood of
  misuse, consulting the person in charge.
- **The register (s 3.8):** keep a register of every incident, serious or
  not, and give it to the Commission if asked.
- **The Regulation respecting confidentiality incidents** sets what the
  notices and the register must contain. As we understand it, register
  entries are kept at least five years after the incident becomes known.
  **Not checked** against the text.

PIPEDA has a similar duty for the rest of Canada, as we understand it:
- report to the Privacy Commissioner of Canada, and tell the people
  affected, where there is a real risk of significant harm;
- keep a record of every breach of security safeguards for 24 months.

**What we have.**
- `legal/INCIDENT_RESPONSE.md`, as read on November 7, 2026, covers the US,
  New Zealand and Australia. It has no Canada or Quebec step and no register.
- The Privacy Policy (section 13, Canada) already promises to tell people
  and the Commission.

**Action.**
- Add a Canada and Quebec section to `legal/INCIDENT_RESPONSE.md`: the
  Commission's notice (its form is on cai.gouv.qc.ca), notice to people,
  and the OPC report.
- Start a single incident register, kept outside the repo, that serves
  Quebec, PIPEDA and the GDPR (RECORDS 2.7, finding 5). Keep entries at
  least five years. Record incidents that turn out not to be serious too.

## 2.5 Consent, and sensitive information (ss 12, 14). Done, with caveats

**The rule.**
- **Section 14:** consent must be manifest, free and enlightened, and given
  for specific purposes. It must be asked for each purpose, in clear and
  simple terms, separately from other information.
- **Section 12:** using information for a new purpose needs consent, given
  expressly when the information is sensitive. It also defines sensitive
  information (1.3).
- **Section 13:** giving information to third persons needs consent unless
  an exception applies. Section 18.3 is the exception for service providers.

**What we have.**
- **A separate health consent.** An unticked checkbox, separate from the
  Terms checkbox, required to sign up (`app/(auth)/sign-up.tsx`) and on the
  consent screen (`src/components/ConsentScreen.tsx`). Its label,
  `HEALTH_CONSENT_LABEL` in `src/domain/consent.ts`, reads: "I consent to
  Rust Strength using my health information, such as my training, runs,
  steps, bodyweight and food diary, as the Privacy Policy describes".
- **How it is recorded.** By `terms_version` 1.6.0 or later and
  `terms_accepted_at` on the profile. No 1.6.0 version can be accepted
  without the box.
- **Sharing with friends.** It needs the person's own act: the first-friend
  question (`src/components/SharePrompt.tsx`) or the Profile switch.
- **Withdrawing.** Privacy Policy sections 2 and 13 explain how.

**Caveats.**
- **Consent is a condition of using the app.** "Free" consent is in tension
  with that (RECORDS R12). The Act's view of consent that a core service
  needs is **uncertain**.
- **Only the latest acceptance is kept** (`useAcceptTerms` overwrites it;
  RECORDS finding 6).
- **The checkbox labels are English only.** A French speaker can read the
  French documents first, but whether consent through an English label is
  "enlightened" for them is **uncertain**. An option: show the three labels
  in French when the phone's language is French.
- **Sign in with Apple or Google creates the account first.** The email
  address and provider id are stored before the age and consent boxes,
  which appear next on the consent screen. An account that never gets past
  that screen keeps them, with no clean-up (2.13).
- **The sharing question leans towards sharing.** "Share" is the main button
  and "Not now" the secondary one (RECORDS finding 7, action A19).
- **A 13-year-old in Quebec cannot give this consent** (2.9).

## 2.6 Most private settings by default (s 9.1). Done, except the share card

**The rule.** An enterprise offering the public a technological product or
service with privacy settings must make sure those settings give the highest
level of confidentiality by default, with no action by the person. Browser
cookie settings are excluded. Secondary sources differ on whether the text
adds a reasonableness qualifier; **not checked**.

| Setting | Default | Where |
|---|---|---|
| "Show my sessions in the feed" (`profiles.share_workouts`) | **Off** for new accounts from 1.2. Asked once, at the first accepted friend | 0031 (applied on release day), 0030, `src/domain/sharePrompt.ts` |
| "Share daily steps" (`profiles.share_steps`) | **Off** | 0024 |
| A run's map (`runs.map_visibility`) and the default for new runs (`run_preferences.map_default`) | **Private** | 0015 |
| A run's own feed switch (`activities.share_to_feed`, `run_preferences.share_default`) | On, but no run reaches the feed while "Show my sessions in the feed" is off | 0015, 0021 |
| "Show the route" on a run's share card | **On** | `app/share/run/[id].tsx`, `useState(true)` |
| Found by username search | Not findable until the person chooses their own handle. After that, any signed-in user can find the username and display name, with no switch | 0007 |
| "Alert when rest is over" | Off; a local notification only | Profile |

**Notes.**
- **Accounts made before 1.2 keep their setting**, which was on by default.
  Canada was not on sale before 1.2, so Canadian-storefront accounts all
  start off. A Quebec resident who signed up through another country's
  storefront would keep it on, and we cannot tell who they are. Accepted.
- **Run feed switches.** A run's own switch starting on is defensible: it
  matters only after the person has turned feed sharing on themselves.
- **Search** has no setting, so s 9.1 is not engaged on its face. A switch to
  hide from search is RECORDS A20.

**Action. Decision for the owner.** Make "Show the route" on the share card
start off, to match the map default. The card is made on the phone, shared
only when the person taps Share, and its route is trimmed. Whether s 9.1
reaches a switch like this is **uncertain**. Starting it off costs one tap.

## 2.7 Identify, locate or profile (s 8.1). Location done; profiling a judgement call

**The rule.** An enterprise that collects information with technology able to
identify, locate or profile a person must first tell the person that the
technology is used, and how to activate those functions. The word "activate"
is commonly read to mean the functions start off. "Profiling" is defined as
collecting and using personal information to assess characteristics of a
person, in particular work performance, economic situation, health, personal
preferences, interests or behaviour.

### Locating

**What the code does** (checked):
- **Permission.** "While Using the App" only, asked when the person taps
  "Allow location and start" on the recording screen, or places a privacy
  zone where they stand (`requestForegroundPermissionsAsync`). Never
  "Always". No geofencing.
- **During a run.** Background location runs from Start to Finish, with
  iOS's location indicator showing (`startLocationUpdatesAsync`,
  `showsBackgroundLocationIndicator: true`, `src/lib/runTracker.ts`).
- **On the recording screen before Start.** With permission already
  granted, the screen watches GPS to show signal quality and centre the map
  (`watchPositionAsync` in `app/run/record.tsx`). The position stays in the
  screen's memory. It is not stored or sent to us. Apple receives map
  requests for that area (1.5.4).
- **Placing a privacy zone.** One reading, when the person taps to place it
  where they stand (`getCurrentPositionAsync`, `app/run/privacy-zones.tsx`).

**Disclosure.** Privacy Policy section 1 lists the permission and when it is
asked. The Consumer Health Data Privacy Policy says location is used only
while recording.

**Wording gap.** Privacy Policy section 1 says: "Location is used only
between Start and Finish; nothing is tracked at any other time." The
pre-Start preview is a use of location, although nothing is recorded. Add one
sentence, in English and French, for example: "Before you start, the
recording screen also uses your location to show the GPS signal and centre
the map; that is not saved or sent to us."

**Status: Done**, with that wording fix. The function is off until the person
grants permission and opens the recording screen or taps Start.

### Identifying

The app has no biometrics, face recognition, contact upload or advertising
identifiers.
- **Username search.** It identifies an account only after the person
  chooses a handle.
- **Sign in with Apple and Google.** These identify the person to us to sign
  them in.

Neither is, in our reading, the identification s 8.1 is aimed at. **Status:
Not applicable, by our reading. Uncertain.**

### Profiling

**What the app works out from what the person logs:**
- estimated one-rep maxes and next-weight suggestions
  (`src/domain/recommender.ts`);
- generated workouts from equipment, untrained muscle groups and strength
  history (`src/domain/generator.ts`);
- a calorie goal from height, weight, birth year, sex and activity (the goal
  calculator);
- streaks, consistency, levels, badges and the body chart.

Several of these assess characteristics related to health and performance.
- **Read broadly**, they are profiling functions.
- **Read narrowly**, they are the service itself, worked out for the
  person's own use, not to classify them for anyone else.

**Uncertain.**

**What we have.**
- The calorie calculator runs only if the person chooses to use it.
- The weight suggestions and one-rep max estimates run as soon as sets are
  logged and cannot be turned off. They are the core of the app.
- Privacy Policy section 3 lists these uses. It also says: "We do not use
  your information for advertising, profiling, or automated decisions with
  legal effects." Under the Act's broad definition, the word "profiling"
  there could be read as inaccurate.

**Action (judgement call).** Reword that sentence in both languages, for
example: "We do not use your information for advertising, or to profile you
for anyone else. The app's estimates (one-rep max, next weight, calorie goal)
are worked out from what you log, for you, and the calorie goal only if you
use the calculator." Whether the suggestions must be switchable to meet
"activate" is a question for a lawyer. Our view is that they need not be,
because they are the function the person signs up for.

## 2.8 Information at collection; published policy (ss 8, 8.2). Done, except the Gmail row

**The rule.**
- **Section 8:** when collecting, tell the person:
  - the purposes and the means of collection;
  - their rights of access and correction, and to withdraw consent;
  - the third persons, or categories of them, the information goes to;
  - that it may be communicated outside Quebec.
- **Section 8.2:** an enterprise collecting through technological means must
  publish a privacy policy in clear and simple terms on its website.

**What we have.** The Privacy Policy, in English and French, on the website
and in the app:
- purposes: sections 2 and 3;
- recipients: section 5;
- storage in the US and the Quebec assessment: section 13;
- rights and withdrawal: sections 2, 8, 9 and 13.

**Gap.** The Gmail row in section 5 (T6).

## 2.9 Minors under 14 (ss 4.1, 14). Decision for the owner

**The law.**
- **Section 4.1:** personal information about a minor under 14 may not be
  collected from the minor without the consent of the person having parental
  authority or the tutor, unless collecting it is clearly for the minor's
  benefit.
- **Section 14:** the consent of a minor under 14 is given by the person
  having parental authority or the tutor. A minor of 14 or over can consent
  themselves.

**The app today.**
- **Minimum age.** 13 everywhere except the EU/EEA, where it is 16
  (`src/domain/age.ts`, `LEGAL.minimumAge`). Canada is 13.
- **Where someone is.** Read from the phone's region setting through
  expo-localization (`src/lib/deviceRegion.ts`). It is self-declared and not
  stored. Every Canadian phone reports "CA", so **the app cannot tell Quebec
  from the rest of Canada**.
- **Age check.** A checkbox, "I am at least 13 years old". No date of birth.
- **Consent.** The app relies on the person's own consent to health
  information (2.5).
- **Sign-in order.** With Sign in with Apple or Google, the email address is
  stored before the age box appears.

**The problem.** A 13-year-old in Quebec can sign up. Collecting their
information then needs a parent's consent (s 4.1), and their own health
consent is not valid (s 14). The "clearly for the minor's benefit" exception
is arguable for a training log. It is weak for an app that also holds health
information, a food diary, precise run routes and a friends feed. We would
not rely on it. **Uncertain**: no guidance on that exception was found or
checked.

**Timing.** Canada is not on sale yet (`store/INTERNATIONAL.md`). Deciding
now affects no Canadian-storefront account.

### Option A: raise Canada's minimum age to 14

- **The change:**
  - give region `CA` a minimum of 14 in `src/domain/age.ts`, with a new
    value in `src/legal/config.ts` and tests;
  - Terms section 2, Privacy Policy sections 10 and 13, and both French
    translations.
- **Version:** if done before 1.6.0 is published, it can be part of 1.6.0.
  After that it is likely a minor bump, and every user accepts again
  (`src/domain/consent.ts`).
- **Pros:**
  - meets ss 4.1 and 14 for Quebec without collecting any more data;
  - fits the existing region rule;
  - affects no existing Canadian account.
- **Cons:**
  - it also excludes 13-year-olds in the other provinces, where PIPEDA sets
    no fixed age;
  - the region signal stays weak: a Quebec 13-year-old with a US region
    setting sees 13 (RECORDS R9);
  - the Apple and Google sign-in order is unchanged.
- **Wording:** whether the documents say "14 in Canada" (matching the code)
  or "14 in Quebec" (matching the law) is for the owner.
- **Variant A2:** when the region is `CA`, ask "Do you live in Quebec?" and
  require 14 only for a yes. It keeps 13 for the other provinces, at the
  cost of one more self-declared question.

### Option B: parental consent for 13-year-olds in Canada

- **The change:**
  - ask Canadian users for their age or birth year;
  - for a 13-year-old, collect a parent's email, send them a request, and
    hold the account until the parent agrees;
  - record that consent, and give the parent a way to withdraw it and to
    make requests.
- **Pros:** keeps 13-year-olds.
- **Cons:**
  - a substantial build;
  - more data from everyone in Canada (an age), plus the parent's details;
  - the child's email is still collected before the parent agrees, unless
    sign-up is rebuilt around it;
  - checking that the adult really is a parent is hard;
  - one person must handle the parents' requests.

### Option C: accept and record the risk

- **The idea:** keep 13. Rely on the probably small number of 13-year-olds,
  the private defaults, and the "benefit" exception.
- **Cons:**
  - on its face this does not meet ss 4.1 and 14 for 13-year-old Quebecers;
  - the Commission can impose administrative monetary penalties;
  - the Act provides penal fines, and punitive damages of at least $1,000
    for an intentional or grossly negligent infringement (s 93.1);
  - the maximums are large: as we understand it, up to $10 million or 2% of
    worldwide turnover for administrative penalties (s 90.12), and higher
    for fines (s 91). Check the figures before relying on them.

**Recommendation: Option A, raising Canada's minimum age to 14, before Canada
goes on sale.** It is the smallest change, needs no new data, and removes the
conflict for the people the app can identify. Variant A2 is reasonable if
keeping 13-year-olds elsewhere in Canada matters to the owner.

**Not decided here.** Record the decision and its date in Part 3.

## 2.10 Access, correction and portability (ss 27, 28, 32). Partly done

**The rule.**
- **Section 27:** a person may access their information. They may also ask
  for information collected from them, in computerised form, in a
  structured, commonly used technological format. This covers information
  collected from them, not what was created or inferred from it. It also
  applies when they ask for it to go to a person or body authorised by law
  to collect it.
- **Section 28:** a person may have their information corrected.
- **Section 32:** answer within 30 days of receiving the request. No answer
  in time counts as a refusal.

**What we have.**
- **Download my data** (Profile > Privacy & legal) calls
  `rpc_export_my_data` (0027). It returns JSON, pretty-printed by
  `useExportMyData` (`src/data/privacy.ts`).
- **Routes** come out as GeoJSON, with the seconds from the start at each
  point.
- **Delivery.** Through the iOS share sheet, as text
  (`Share.share({ message })` in `app/legal/privacy-center.tsx`), so the
  person can save or send it where they like.
- JSON and GeoJSON are structured and commonly used. Our reading is that this
  meets the format rule.
- **Correction.** Most data can be edited or deleted in the app. Anything
  else is by email.

**Gaps.**
- **Missing tables.** The export leaves out `workout_exercises` (planned
  slots), `template_exercises` (the exercises inside presets), reports the
  person filed (`user_reports`) and the sign-in provider identity (RECORDS
  finding 4, action A10). Presets were collected from the person, so they
  count for portability.
- **Text, not a file.** The screen says "as a JSON file", but it is shared
  as a text message. A large export with many routes may be awkward to save
  that way. Consider writing a `.json` file and sharing the file.
- **No in-app route to send it to a third party.** Requests for it to go to
  a body authorised by law are handled by email. Add that to
  `legal/PRIVACY_REQUESTS.md`.
- **45 days, not 30.** `legal/PRIVACY_REQUESTS.md`, as read on November 7,
  2026, sets one 45-day deadline for everyone, with a 45-day extension. That
  follows Washington's law. Quebec allows 30 days (s 32), and the Privacy
  Policy promises Canadians 30. Add 30 days for Canada and Quebec to the
  runbook.

## 2.11 De-indexing and stopping dissemination (s 28.1). Covered by existing tools

**The rule.** A person may ask an enterprise to stop disseminating
information about them, or to de-index a hyperlink attached to their name.
This applies when the dissemination breaks the law or a court order, or
causes them serious injury that clearly outweighs the public interest and
free expression. Our summary of the conditions; check the text.

**What we have.** The app publishes nothing on the open web. No profile is
indexed by search engines. Inside the app, a username and display name can
be found by signed-in users once a handle is chosen. Someone can:
- change their username or display name;
- remove or block a person;
- report a name (we can reset it, `legal/MODERATION.md`);
- delete their account.

**Action.** Add a line to `legal/PRIVACY_REQUESTS.md`: a request to stop
showing information about someone is handled like a report.

## 2.12 Automated decisions and other rights (s 12.1). Done in substance

**The rule.** An enterprise that makes a decision based only on automated
processing must tell the person, at the latest when it tells them of the
decision. On request it must also tell them:
- the information used;
- the reasons and main factors;
- their right to have the information corrected.

The person can submit observations to someone who can review the decision.
Wording as we understand it.

**What we have.** The nearest thing to an automated decision is the food
diary's rule that nobody under 18 by the birth year typed gets a weight-loss
goal (`src/domain/nutrition/goalForm.ts`). The goal screen says so at the
time: "Weight-loss goals are for adults, so the age decides which goals
are...", and explains each refusal (`app/nutrition/goals.tsx`). The person
can correct the birth year, or email us. Whether a gate like this is a
"decision" is **uncertain**. The weight suggestions are suggestions, not
decisions.

**Other rights.** The Privacy Policy, section 13 (Canada), covers:
- withdrawing consent;
- complaining to the Commission d'accès à l'information;
- being told about the technology (2.7).

## 2.13 Retention and destruction (s 23). Action needed

**The rule.** Once the purposes for which information was collected are
achieved, destroy it, or anonymise it to use for serious and legitimate
purposes, subject to any period another law requires. Anonymisation must
follow the government's regulation on it, as we understand it. The app does
not anonymise; it deletes.

**What we have.**
- **While the account exists:** data is kept.
- **At account deletion:** everything goes at once, through cascades
  (RECORDS P1).
- **On the phone:** the offline copy lasts up to 7 days
  (`src/lib/queryClient.ts`) and is cleared on sign-out.
- **Daily steps:** turning off "Share daily steps" deletes the uploaded
  totals.

**Gaps.** Most are already RECORDS actions A14 and A15.
- No limit for accounts unused for a long time. Once someone has stopped
  using the app, the purpose may be "achieved".
- No limit for closed reports, support emails, or the request log ("at least
  two years", no upper limit).
- Accounts made with Sign in with Apple or Google that never pass the
  consent screen keep an email address and provider id indefinitely (2.5).
- Code emails stay in Gmail's Sent folder (1.5.2).
- Supabase's backup and log retention on the free plan, and whether Auth
  audit entries outlive deletion: **not checked**.

**Action.** Write a retention schedule and put its summary in the published
governance page (2.2). Suggested limits for the owner to set:
- **closed reports:** 12 months;
- **support emails:** 2 years;
- **request log:** 3 years;
- **incident register:** 5 years;
- **unconfirmed sign-in accounts:** deleted after 30 days;
- **dormant accounts:** warned, then deleted after a long period, such as 3
  years.

These are suggestions, not legal requirements.

## 2.14 French language (Charter). Partly done; judgement calls

### Section 55: contracts of adhesion

**The rule.** As amended in 2022, in force from June 1, 2023, as we
understand it: the parties to a contract of adhesion and its related documents
must first be given the French version. They may then choose to be bound by
another language's version only if that is their express wish. The Terms are
a contract of adhesion, and the Privacy Policy is a related document.

**What we have.**
- **Translations.** French Terms and Privacy Policy (`src/legal/fr/terms.ts`,
  `src/legal/fr/privacy.ts`), with a test that keeps their version in step
  with `LEGAL.version`.
- **Equal validity.** Both versions are stated to be equally valid (Terms
  section 18, and the French Privacy Policy).
- **Where the French is linked** (`FrenchLegalLinks`, "Version française"):
  - on sign-up, after the checkboxes and the English links;
  - on the consent screen, after the English links and before the
    checkboxes;
  - in Profile > Privacy & legal;
  - on the website, as `conditions.html` and `confidentialite.html`.

**Not yet reviewed.** Two reviewers checked the translations against the
English, but no French-speaking lawyer has (`store/INTERNATIONAL.md`, Canada
step 1). Because both versions bind, a mistranslation is a real risk.

**Judgement call.** Both versions bind, so nobody is bound by the English
"only". Whether a French link beside the English counts as giving the French
version "first" is **uncertain**. Options that follow the wording more
closely:
- when the phone's language is French (expo-localization's `languageCode`),
  show the French links first, or open the French documents first;
- show the three checkbox labels in French for French-language phones
  (2.5).

### Section 50.2: the right to be informed and served in French

**The rule.** An enterprise offering goods or services to consumers must
respect their right to be informed and served in French. Exact wording
**not checked**.

**What we have.** Terms section 6 offers the contact point "in English or
French". `store/INTERNATIONAL.md` (Canada step 3) says to answer French emails
in French, with a translation tool if needed.

**Action.** Add that to `legal/PRIVACY_REQUESTS.md` and `legal/MODERATION.md`:
- a message in French gets a reply in French;
- decisions on reports for a French speaker are explained in French.

### Section 52.1: software

**The rule.** Software must be available in French unless no French version
exists. As we understand it, a version in another language may be offered
only if a French version is available on terms no less favourable and with
equivalent features.

**What we have.** The app is in English only, and no French version exists.
On its face the exception applies.

**Judgement call.** Three open points:
- whether the Office québécois de la langue française treats an app this
  way;
- whether translating some in-app text, such as the consent labels, would
  create a partial "French version" that must then be offered in full;
- whether the 2022 amendments changed s 52.1.

**Not checked.** A lawyer should confirm before Canada goes on sale.

### Not assessed here

- **Section 52 of the Charter** (catalogues, brochures and similar commercial
  publications). The App Store listing and the website are in English,
  apart from the French documents. A French (Canada) App Store listing is a
  cheap step.
- **Quebec's Consumer Protection Act** rules on language and distance
  contracts. Terms section 15 keeps its protections.

---

# Part 3: Open questions, decisions and sign-off

## 3.1 Decisions for the owner

| # | Decision | Options | Recommended | Section |
|---|---|---|---|---|
| D1 | **Quebec children under 14** | A: Canada's minimum age 14 (or A2: 14 only for a yes to "Do you live in Quebec?"); B: parental consent for 13-year-olds; C: accept and record the risk | A, before Canada goes on sale | 2.9 |
| D2 | Gmail as code sender and support inbox | Replace before Canada; or accept and record the risk | Replace | 1.5.2 |
| D3 | Open Food Facts | Accept and record; or proxy through an Edge Function | Accept and record for now | 1.5.6 |
| D4 | Share card "Show the route" default | Keep on; or start off | Start off | 2.6 |
| D5 | French first for French-language phones, and French checkbox labels | Show French first; or keep side by side | Ask a lawyer with the translation review | 2.14 |
| D6 | Retention limits | The figures in 2.13, or others | Set them | 2.13 |

## 3.2 Actions

| # | Action | When | Section |
|---|---|---|---|
| T1 to T9 | Part 1's actions | See 1.8 | 1.8 |
| L1 | Fill in `LEGAL.postalAddress` | Before Canada | 2.1 |
| L2 | Publish a governance summary in English and French, approved by the owner | Before Canada | 2.2 |
| L3 | Add Canada and Quebec breach steps to `legal/INCIDENT_RESPONSE.md`, and start one incident register kept at least five years | Before Canada | 2.4 |
| L4 | Add 30-day deadlines for Canada and Quebec, portability to a third party, stopping dissemination, and French replies to `legal/PRIVACY_REQUESTS.md` | Before Canada | 2.10, 2.11, 2.14 |
| L5 | Add the missing tables to `rpc_export_my_data` (RECORDS A10), and consider sharing the export as a `.json` file | With 1.2 or soon after | 2.10 |
| L6 | Reword the Privacy Policy's "profiling" sentence and the "only between Start and Finish" sentence, in English and French | Before Canada | 2.7 |
| L7 | Have a French-speaking lawyer review the translations, s 55 presentation and s 52.1 | Before Canada | 2.14 |
| L8 | Give "Share" and "Not now" equal weight on the sharing question (RECORDS A19) | With 1.2 or soon after | 2.5 |
| L9 | Treat RECORDS 2.10 as the trigger list for Quebec impact assessments | Ongoing | 2.3 |
| L10 | Consider a French (Canada) App Store listing | Optional | 2.14 |

## 3.3 Uncertain points to put to a lawyer

1. Whether the Act, and s 17 in particular, applies to a US enterprise
   collecting directly from Quebec residents (1.2).
2. Whether a standard, non-negotiable DPA meets s 17's written agreement
   that "takes into account" the assessment (1.5.1).
3. Whether developer agreements with Apple and Google, or none at all for
   Open Food Facts, are enough where those recipients act on their own
   account (1.5.4 to 1.5.6).
4. The "clearly for the minor's benefit" exception in s 4.1 (2.9).
5. Whether consent that the app requires is "free" (2.5).
6. Whether the app's estimates are "profiling" under s 8.1 (2.7).
7. Whether the share card switch is a privacy setting under s 9.1 (2.6).
8. The Charter: s 55 presentation, s 52.1, and s 52 for the store listing
   (2.14).

## 3.4 Sign-off

I hold the role of person in charge of the protection of personal information
for Bluestem Software LLC (s 3.1). I have read this assessment. I accept the
conclusions in 1.7 and the residual risks recorded there, and I will carry out
or decide the items in 3.1 and 3.2.

| | |
|---|---|
| Name | ______________________ |
| Role | Owner, Bluestem Software LLC; person in charge of the protection of personal information |
| D1 (Quebec under 14) decided | Option A, minimum age 14 across Canada, November 7, 2026 |
| D2 (Gmail) decided | ______________________ (option and date; if accepted, the reason) |
| D3 (Open Food Facts) decided | ______________________ |
| Signature | ______________________ |
| Date | ______________________ |
| Next review due | ______________________ |

## 3.5 Review

Review at least once a year, and before any of these:
- a new recipient of personal information;
- a change of hosting provider or region;
- any recipient changing its terms;
- the AI coach, Apple Health, an Android app, or anything else on the
  RECORDS 2.10 list.

Also review after a confidentiality incident or a complaint to the
Commission.

| Review | Date | By | What changed |
|---|---|---|---|
| First version | November 7, 2026 | | Written for 1.2 and legal 1.6.0 |
| | | | |

## Sources

LégisQuébec blocked automated access when this was written, and the other
links were not re-checked. Open each one before relying on it.

- Act respecting the protection of personal information in the private sector
  (CQLR c P-39.1): https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1
- Charter of the French language (CQLR c C-11):
  https://www.legisquebec.gouv.qc.ca/en/document/cs/C-11
- Regulation respecting confidentiality incidents: search LégisQuébec (its
  citation was not checked)
- Commission d'accès à l'information (guidance, incident notice form):
  https://www.cai.gouv.qc.ca
- PIPEDA, Schedule 1 (the ten principles):
  https://laws-lois.justice.gc.ca/eng/acts/P-8.6/
- Supabase Data Processing Addendum: https://supabase.com/legal/dpa
- FISA Section 702, 50 U.S.C. § 1881a; CLOUD Act, 18 U.S.C. § 2713; Executive
  Order 14086 (October 7, 2022); FTC Health Breach Notification Rule,
  16 CFR Part 318
- Secondary sources consulted for the wording of ss 8.1, 9.1 and 17: law-firm
  summaries of Bill 64 (BLG, Mondaq) and an industry guide (IAB Canada, June
  2022). Not authoritative.
