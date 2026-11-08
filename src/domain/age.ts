/**
 * The minimum age to use the app, which depends on where someone lives.
 *
 * 13 everywhere (it keeps the app outside COPPA), except in the European
 * Economic Area: the app relies on consent for health information, and the
 * GDPR's age of digital consent (Article 8) is as high as 16 in several EEA
 * countries, so the app asks for 16 across all of them rather than one age per
 * country. The UK's age of digital consent is 13, so it stays at 13.
 *
 * And 14 in Canada: Quebec's privacy Act needs a parent's consent to collect
 * information from a child under 14, and the phone's region can't tell
 * Quebec from the rest of Canada.
 *
 * Where someone lives is read from the phone's region setting. That is a
 * self-declared signal like the age confirmation itself; the app stores
 * neither the region nor a date of birth.
 */

import { LEGAL } from '@/legal/config';

/**
 * ISO 3166-1 alpha-2 codes for the EU member states, their outermost regions
 * that carry codes of their own, and Iceland, Liechtenstein and Norway.
 */
export const EEA_REGIONS: ReadonlySet<string> = new Set([
  // EU member states
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // Parts of the EU with their own codes: Åland, French Guiana, Guadeloupe,
  // Martinique, Mayotte, Réunion, Saint Martin
  'AX', 'GF', 'GP', 'MQ', 'YT', 'RE', 'MF',
  // The rest of the EEA
  'IS', 'LI', 'NO',
]);

export function isEeaRegion(region: string | null | undefined): boolean {
  return !!region && EEA_REGIONS.has(region.trim().toUpperCase());
}

/** The minimum age for someone whose phone's region is `region`. */
export function minimumAgeFor(region: string | null | undefined): number {
  if (isEeaRegion(region)) return LEGAL.minimumAgeEea;
  if (region?.trim().toUpperCase() === 'CA') return LEGAL.minimumAgeCanada;
  return LEGAL.minimumAge;
}

/** The sign-up and consent screens' age checkbox. */
export function ageConfirmationLabel(region: string | null | undefined): string {
  return `I am at least ${minimumAgeFor(region)} years old`;
}
