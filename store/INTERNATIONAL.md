# Selling outside the United States

Notes for later. Rust Strength is sold in the United States only. That was
decided for the first release and still holds for 1.2. This file lists what it
takes to add more countries.

Checked November 6, 2026. **Not reviewed by a lawyer.** These rules change, so
recheck each item before acting on it.

## The short version

- **Turning a country on takes a minute in App Store Connect.** The real work is
  legal paperwork, and it varies a lot by region.
- **Easiest first:** New Zealand, then Australia and Canada.
- **Harder:** the UK and the EU. Health data gets extra protection there, and
  both need a paid local representative.
- **Leave out:** mainland China.
- **The app itself is mostly ready:**
  - kg and lb, kcal and kJ already exist.
  - Open Food Facts barcodes work worldwide (the USDA catalog is US foods, but
    search still works).
  - Sign in with Apple and Google work everywhere.
  - Apple handles currencies, VAT and refunds.

## 1. App Store Connect

1. **Pick the countries.** App → **Pricing and Availability** → App
   Availability → Edit, and tick them.
2. **Check product availability.** Open Pro Monthly, Pro Yearly and Pro
   Lifetime, and make sure each one's own Availability includes the new
   countries.
3. **Review the prices** Apple generates from the US price. Prices in the EU,
   UK, Australia and New Zealand include VAT or GST, so you keep less per sale
   than in the US.
4. **Check the free month.** The one-month offer was set to all territories;
   confirm it covers the new ones.
5. **Answer anything new it asks per country**, such as age rating or
   regulatory questions.
   - Export compliance is already answered: the app uses only standard
     encryption (`ITSAppUsesNonExemptEncryption` is false), so nothing changes.
6. **Optional listings.** Add English (U.K.), English (Australia) and English
   (Canada) listings by copying the U.S. text. Without them, those stores show
   the English (U.S.) listing, which is fine.

**Taxes.** Apple sells the app and subscriptions in each country, collects and
pays the VAT or GST, and handles refunds. You shouldn't need to register for
tax abroad, but fill in any tax forms App Store Connect asks for under Business.

**EU trader status.** Apple removes apps from the EU App Store when the
developer's trader status isn't verified.
- Bluestem Software LLC selling subscriptions is a trader.
- Declare it in App Store Connect → Business once the account conversion is done.
- EU users will see the LLC's address from its D-U-N-S record, plus a phone
  number and email. Use business ones, not personal.

## 2. Needed for any new country

- **Privacy Policy.** It's written for US law and says so. Each region needs its
  own section: people's rights there, how to ask, and which regulator to
  complain to. `build-legal.js` builds it the same way as now.
- **Terms.** Choosing North Dakota law can't take away consumer protections in
  the buyer's own country.
  - Add a sentence saying mandatory local consumer rights still apply.
  - Word the warranty disclaimer and the liability limits "to the extent the law
    allows".
- **Where the data lives.** Supabase hosts it in `us-east-1` (Virginia), so
  everyone else's data travels to the US.
  - The policy already says it's stored in the US.
  - Regions that regulate transfers also need the legal basis named, which is
    Supabase's data processing agreement.
- **Privacy requests.** `legal/PRIVACY_REQUESTS.md` uses Washington's 45 days.
  The GDPR allows one month. Add each region's deadline.
- **Data breaches.** `legal/INCIDENT_RESPONSE.md` covers US state laws. Add each
  region's regulator and deadline (72 hours under the GDPR).
- **Moderation.** Friends see usernames, display names, and the names people
  give exercises, gyms and presets. That makes this a user-to-user service.
  - The UK, the EU and Australia regulate those even at small sizes (details
    below).
  - Reporting and blocking already exist; what's missing is mostly paperwork.

## 3. Region by region

### New Zealand (lightest)
- **Privacy Act 2020.** Tell people their data is stored in the US, and report
  any breach likely to cause serious harm to the Privacy Commissioner.
- Add a New Zealand section to the Privacy Policy.

### Australia
- **Privacy Act 1988.** Businesses under A$3 million turnover are usually
  exempt, but not ones that provide a "health service" and hold health
  information.
  - Whether a fitness app counts is a question for a lawyer.
  - Plan as if it applies: an Australian section in the policy, overseas
    storage disclosed, and serious breaches reported to the OAIC.
- **Under-16 social media ban** (in force since December 10, 2025).
  - Services whose sole or primary purpose is supporting users' health are
    excluded. Platforms assess this themselves.
  - Rust Strength's main purpose is training, and the friends feed is
    secondary, so it likely falls outside the ban. Write that assessment down
    and keep it.
  - If it ever doesn't hold, the minimum age in Australia becomes 16.
- **Online Safety Act.** It has industry codes for user-to-user services.
  Reporting and blocking cover the core of them.
- **Australian Consumer Law.** Its guarantees can't be excluded. The Terms
  wording in section 2 covers this.

### Canada
- **PIPEDA**, the federal privacy law. It needs:
  - meaningful consent;
  - a named person accountable for privacy (you);
  - serious breaches reported to the Privacy Commissioner;
  - the policy to say the data is stored in the US.
- **Quebec's Law 25:**
  - **A person in charge of personal information.** By default that's the head
    of the business, so you. Their title and contact details go on the website.
  - **A privacy impact assessment** before sending Quebec users' data outside
    Quebec, which every account does.
  - **Most private settings by default.** The friends feed being on by default
    conflicts with this.
- **Quebec's French language law.** It requires French versions of consumer
  contracts, which would mean the Terms.
  - You can't leave Quebec out of the Canadian App Store.
  - Ask a lawyer whether it reaches a US app. It may mean translating the
    Terms and the Privacy Policy.

### United Kingdom
- **UK GDPR.** Bodyweight, food, steps and probably training logs are health
  data, a special category.
  - **Explicit consent:** a one-time consent screen, with a way to withdraw it.
  - **The policy:** a lawful basis for each purpose, UK rights, and how to
    complain to the ICO.
  - **Requests:** answered within one month.
- **UK representative.** Needed because the LLC has no UK office. The
  exemption only covers occasional processing, and this isn't occasional. Paid
  services act as representatives for a yearly fee.
- **Records of processing.** The small-business exemption doesn't apply to
  health data, so a written record is needed.
- **ICO fee.** Check whether you owe the ICO data protection fee.
- **Children's Code.** It applies because 13 to 17 year olds can use the app.
  It expects high-privacy defaults, which again means the feed off by default,
  at least for under-18s.
- **Online Safety Act.** It applies to user-to-user services of any size. Ofcom
  publishes guidance for small services. The duties:
  - an illegal content risk assessment;
  - a children's access assessment, and a children's risk assessment if
    children are likely to use the app, which at 13+ they are;
  - a reporting and complaints process;
  - Terms that explain all of this.

### European Union
The GDPR also covers Iceland, Liechtenstein and Norway.

- **Trader status.** Covered in section 1.
- **GDPR.** Everything in the UK list above, plus:
  - an EU representative;
  - breaches reported within 72 hours;
  - complaints go to each country's own data protection authority.
- **Age.** The age at which a child can consent to an app ranges from 13 to 16
  by country. It's 16 in Germany, the Netherlands and Ireland, among others.
  - With a 13+ minimum and consent for health data, under-16s there may need a
    parent's consent.
  - Simplest fix: make the minimum age 16 in the EU, or everywhere.
- **Digital Services Act.** The app stores what users write and shows it to
  their friends, which makes it a hosting service. It needs:
  - a contact point;
  - a way to report illegal content (the Report action, plus a process);
  - telling a user why their content or account was removed;
  - a description of moderation in the Terms;
  - a legal representative in the EU, often the same company as the GDPR
    representative.
- **Supabase transfers.** Confirm its data processing agreement includes the EU
  transfer clauses (and the UK addendum).
- **Language.** Some countries, France for one, require consumer terms in their
  language. Ask whether English-only is acceptable.
- **Impact assessment.** Processing health data at scale can require a data
  protection impact assessment. At today's size it may not; ask.

### Leave out for now
- **Mainland China.** Apple requires an ICP filing number, which in practice
  needs a Chinese business or partner. China also has its own privacy law.
- **Everywhere else** (South Korea, Japan, Brazil, India and so on). Each has
  its own privacy law. Add them one at a time if people ask.

## 4. Suggested order

1. **New Zealand and Australia.**
   - Policy sections and the Terms wording.
   - The written age-ban self-assessment.
   - One lawyer question: the health service exemption.
2. **Canada,** once the Quebec questions are answered.
3. **The UK and the EU together.** They share most of the work:
   - the consent screen;
   - the representatives;
   - the records;
   - the Online Safety Act and DSA paperwork;
   - possibly a 16+ minimum age.

   Get a lawyer's review before launching there.

## 5. Decisions only you can make

1. **Which group comes first,** or whether to stay US-only for now.
2. **Whether to pay for UK and EU representatives.** Without them, the UK and
   the EU are off the table.
3. **Minimum age.** 16 in the EU only, 16 everywhere (simpler, but you lose 13
   to 15 year olds), or 13 with parental consent where required.
4. **Feed default.** Off by default for everyone? This helps in the UK and
   Quebec, and with Washington's health data law too.
5. **Translation.** Translate for Quebec and the EU, or wait until there's
   demand.

## 6. App changes to expect

- **A health data consent screen**, shown once, with a way to withdraw (which
  stops the feature and deletes that data). This is the screen already offered
  for the food diary, extended to cover all health data. It also helps in the US.
- **Region sections** in the Privacy Policy and Terms, built by
  `scripts/build-legal.js`.
- **Feed off by default**, if you decide on it.
- **A higher minimum age**, globally or per region, if you decide on it.
- **A message to users** saying why content or an account was removed, for the
  Digital Services Act.

## Sources checked

- [Apple trader requirement (MacRumors, Oct 2024)](https://www.macrumors.com/2024/10/17/developers-eu-app-store-trader-requirements/)
- [Apple trader enforcement (9to5Mac, Feb 2025)](https://9to5mac.com/2025/02/18/apple-trader-information-app-store/)
- [eSafety: social media age restrictions](https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions)
- [Online Safety (Age-Restricted Social Media Platforms) Rules 2025](https://www.legislation.gov.au/F2025L00889/asmade/2025-07-30/text/original/word)
- [Ofcom: protection of children duties](https://www.ofcom.org.uk/online-safety/protecting-children/protection-of-children-duties-under-the-online-safety-act)
- [Ofcom: guide for services](https://www.ofcom.org.uk/cymru/online-safety/information-for-industry/guide-for-services)
- The other items are from the laws as I understand them (GDPR Articles 8, 9,
  27 and 30; DSA Articles 11 to 17; Quebec Law 25; Australia's Privacy Act
  s 6D) and weren't rechecked today.
