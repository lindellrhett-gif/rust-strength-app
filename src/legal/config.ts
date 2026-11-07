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

  /** US state whose law governs the Terms, normally where you live. */
  governingState: 'North Dakota',

  /**
   * Public URLs. Apple requires a privacy policy reachable from the App Store
   * listing itself, not only inside the app.
   */
  privacyPolicyUrl: 'https://lindellrhett-gif.github.io/rust-strength/privacy.html',
  termsUrl: 'https://lindellrhett-gif.github.io/rust-strength/terms.html',
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
   * major.minor.patch. A major or minor bump is a material change: every
   * signed-in user is asked to accept again (see src/domain/consent.ts). A
   * patch — a clarification, a new contact address — asks nobody.
   */
  // 1.5.1 adds the New Zealand and Australia sections. A patch: it adds rights
  // and changes nothing for anyone who already accepted 1.5.0.
  version: '1.5.1',

  /** Last substantive edit to the documents. */
  lastUpdated: 'November 6, 2026',

  /** Where the app is offered. Drives which privacy laws the documents address. */
  region: 'United States, New Zealand and Australia',
} as const;

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
