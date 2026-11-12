/**
 * Everything in the legal documents that depends on a business decision rather
 * than on the code.
 *
 * !! THE FIVE VALUES BELOW MUST BE FILLED IN BEFORE SUBMITTING TO THE
 *    APP STORE. They are not guesses to be left as-is — Apple requires a
 *    working support contact and a reachable privacy policy URL, and the
 *    documents are not enforceable without a real legal entity and a
 *    governing-law choice.
 */

export const LEGAL = {
  /** Trading/legal name of whoever publishes the app. */
  entity: 'Bluestem Software LLC',

  /** Monitored inbox for privacy requests and support. */
  contactEmail: 'ruststrengthsupport@gmail.com',

  /**
   * The LLC's postal address, printed in the Privacy Policy. New Zealand's
   * Privacy Act (IPP 3) requires the name and address of the agency that
   * collects and holds the information. A registered agent's address or a PO
   * box is fine; it does not have to be a home address. One line, commas
   * between parts.
   */
  postalAddress: 'TODO: business mailing address',

  /**
   * Who is in charge of protecting personal information: the person Quebec's
   * Law 25 (s 3.1) and PIPEDA's accountability principle ask for. By default
   * that is the head of the business. Published by title, with contactEmail,
   * not by name.
   */
  privacyOfficerTitle: 'Privacy Officer',

  /**
   * Representatives for people in the UK and the EU, required because the LLC
   * has no office there: Article 27 of the UK GDPR and of the EU GDPR, and, for
   * the EU, Article 13 of the Digital Services Act (usually the same firm).
   * Fill in "Firm name, address, email" once appointed. Until then the
   * documents say one will be named before the app is offered there, so keep
   * the UK and EU storefronts off in App Store Connect while either is empty.
   */
  ukRepresentative: '',
  euRepresentative: '',

  /** US state whose law governs the Terms, normally where you live. */
  governingState: 'North Dakota',
  /**
   * The same state as the French Terms write it, after "l’État": with its
   * article, because French varies it ("du Dakota du Nord", "de l’Ohio").
   */
  governingStateFr: 'du Dakota du Nord',

  /**
   * Public URLs. Apple requires a privacy policy reachable from the App Store
   * listing itself, not only inside the app.
   */
  privacyPolicyUrl: 'https://lindellrhett-gif.github.io/rust-strength/privacy.html',
  termsUrl: 'https://lindellrhett-gif.github.io/rust-strength/terms.html',
  /**
   * The Consumer Health Data Privacy Policy, linked on its own from the site's
   * homepage, the App Store description and Privacy & legal in the app.
   */
  healthDataPolicyUrl: 'https://lindellrhett-gif.github.io/rust-strength/health-data.html',
  /** The French translations, for Quebec (Charter of the French language, s 55). */
  termsFrUrl: 'https://lindellrhett-gif.github.io/rust-strength/conditions.html',
  privacyFrUrl: 'https://lindellrhett-gif.github.io/rust-strength/confidentialite.html',
  /**
   * Where the sign-up confirmation link lands. Must also be listed under
   * Supabase → Authentication → URL Configuration → Redirect URLs, or Supabase
   * ignores it and falls back to the Site URL.
   */
  emailConfirmedUrl: 'https://lindellrhett-gif.github.io/rust-strength/email-confirmed.html',

  // --- Settled by the decisions already made -------------------------------

  /** Product name shown in the documents. */
  appName: 'Rust Strength',

  /** Minimum age. 13+ keeps the app outside COPPA. */
  minimumAge: 13,

  /**
   * Minimum age in the EU, Iceland, Liechtenstein and Norway. The GDPR's age
   * of digital consent (Article 8) is as high as 16 in several of them, and the
   * app relies on consent for health information, which a younger child
   * there could not give without a parent. The phone's region decides which
   * applies; see src/domain/age.ts.
   */
  minimumAgeEea: 16,

  /**
   * Minimum age in Canada, decided November 7, 2026. Quebec's private-sector
   * privacy Act (s 4.1) needs a parent's consent to collect information from
   * a child under 14, and the phone's region ("CA") can't tell Quebec from the
   * rest of Canada, so 14 applies across Canada.
   */
  minimumAgeCanada: 14,

  /**
   * major.minor.patch. A major or minor bump is a material change: every
   * signed-in user is asked to accept again (see src/domain/consent.ts). A
   * patch — a clarification, a new contact address — asks nobody.
   */
  // 1.6.0 adds Rust Strength Pro (feature/subscriptions) and the food diary
  // it unlocks (feature/nutrition, app 1.2). Publish it only when Pro goes on
  // sale with 1.2; 1.5.0 is the running update.
  // It also carries 1.5.1, the New Zealand and Australia sections, and adds
  // Canada, the UK and the EU, explicit consent for health information, the
  // EU minimum age and sharing off by default. The French translations in
  // src/legal/fr must be updated with every change to this version.
  version: '1.6.0',

  /** Last substantive edit to the documents. */
  lastUpdated: 'November 6, 2026',
  /** The same date, as the French translations write it. A test keeps the two in step. */
  lastUpdatedFr: '6 novembre 2026',

  /** Where the app is offered. Drives which privacy laws the documents address. */
  region: 'United States, New Zealand, Australia, Canada, the United Kingdom and the European Economic Area',
} as const;

/**
 * A representative's details, or the promise to name one first. `where` reads
 * after "offered in", in the document's language.
 */
export function representative(details: string, where: string, lang: 'en' | 'fr' = 'en'): string {
  if (details.trim()) return details.trim();
  return lang === 'fr'
    ? `sera nommé ici avant que ${LEGAL.appName} soit offert ${where}`
    : `to be named here before ${LEGAL.appName} is offered in ${where}`;
}

/** True while a placeholder is still unfilled — surfaced in-app during dev. */
export function hasUnresolvedPlaceholders(): boolean {
  return [
    LEGAL.entity,
    LEGAL.contactEmail,
    LEGAL.postalAddress,
    LEGAL.governingState,
    LEGAL.privacyPolicyUrl,
    LEGAL.termsUrl,
  ].some(
    (v) =>
      v.includes('TODO') ||
      // Catches values pasted in while leaving the placeholder brackets on,
      // e.g. '[Rhett Lindell]' — which would print the brackets verbatim.
      /[[\]]/.test(v) ||
      v.trim().length === 0,
  );
}
