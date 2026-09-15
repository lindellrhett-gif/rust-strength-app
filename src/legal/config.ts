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
  entity: 'Rhett Lindell',

  /** Monitored inbox for privacy requests and support. */
  contactEmail: 'ruststrengthsupport@gmail.com',

  /** US state whose law governs the Terms, normally where you live. */
  governingState: 'North Dakota',

  /**
   * Public URLs. Apple requires a privacy policy reachable from the App Store
   * listing itself, not only inside the app.
   */
  privacyPolicyUrl: 'https://lindellrhett-gif.github.io/rust-strength/privacy.html',
  termsUrl: 'https://lindellrhett-gif.github.io/rust-strength/terms.html',

  // --- Settled by the decisions already made -------------------------------

  /** Product name shown in the documents. */
  appName: 'Rust Strength',

  /** Minimum age. 13+ keeps the app outside COPPA. */
  minimumAge: 13,

  /**
   * Bumped whenever the documents change materially. Note that nothing in the
   * app currently re-prompts an existing user on a bump — see the legal audit.
   * Harmless before launch, since there are no users holding an old version.
   */
  version: '1.3.1',

  /** Last substantive edit to the documents. */
  lastUpdated: 'September 14, 2026',

  /** Launch region. Drives which privacy laws the documents address. */
  region: 'United States',
} as const;

/** True while a placeholder is still unfilled — surfaced in-app during dev. */
export function hasUnresolvedPlaceholders(): boolean {
  return [
    LEGAL.entity,
    LEGAL.contactEmail,
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
