/**
 * Everything in the legal documents that depends on a business decision rather
 * than on the code.
 *
 * ⚠️  THE FIVE VALUES BELOW MUST BE FILLED IN BEFORE SUBMITTING TO THE
 *     APP STORE. They are not guesses to be left as-is — Apple requires a
 *     working support contact and a reachable privacy policy URL, and the
 *     documents are not enforceable without a real legal entity and a
 *     governing-law choice.
 */

export const LEGAL = {
  /** Trading/legal name of whoever publishes the app. TODO */
  entity: 'Rhett Lindell',

  /** Monitored inbox for privacy requests and support. TODO */
  contactEmail: 'lindellrhett@gmail.com',

  /** US state whose law governs the Terms, normally where you live. TODO */
  governingState: 'North Dakota',

  /**
   * Public URLs. Apple requires a privacy policy reachable from the App Store
   * listing itself, not only inside the app. TODO
   */
  privacyPolicyUrl: 'https://lindellrhett-gif.github.io/rust-strength/privacy.html',
  termsUrl: 'https://lindellrhett-gif.github.io/rust-strength/terms.html',

  // --- Settled by the decisions already made -------------------------------

  /** Product name shown in the documents. */
  appName: 'Rust Strength',

  /** Minimum age. 13+ keeps the app outside COPPA. */
  minimumAge: 13,

  /** Bump when the documents change materially; re-prompts for acceptance. */
  version: '1.1.0',

  /** Last substantive edit to the documents. */
  lastUpdated: 'September 10, 2026',

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
