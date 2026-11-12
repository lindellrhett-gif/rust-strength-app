import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { HEALTH_CONSENT_LABEL } from '../src/domain/consent';
import { LEGAL, representative } from '../src/legal/config';
import { PRIVACY_POLICY_FR, PRIVACY_FR_SOURCE_VERSION } from '../src/legal/fr/privacy';
import { TERMS_OF_SERVICE_FR, TERMS_FR_SOURCE_VERSION } from '../src/legal/fr/terms';
import { PRIVACY_POLICY } from '../src/legal/privacy';
import { TERMS_OF_SERVICE } from '../src/legal/terms';

/** How many lines of each markdown kind a document has. */
function shape(md: string) {
  const lines = md.split('\n');
  const count = (prefix: string) => lines.filter((l) => l.startsWith(prefix)).length;
  return {
    h1: count('# '),
    h2: count('## '),
    h3: count('### '),
    bullets: count('- '),
    tableRows: count('|'),
    tableCells: lines.filter((l) => l.startsWith('|')).map((l) => l.split('|').length),
  };
}

describe('the French translations', () => {
  it('translate the current version of the English', () => {
    expect(TERMS_FR_SOURCE_VERSION).toBe(LEGAL.version);
    expect(PRIVACY_FR_SOURCE_VERSION).toBe(LEGAL.version);
  });

  it('keep the same sections, bullets and tables as the English', () => {
    expect(shape(TERMS_OF_SERVICE_FR)).toEqual(shape(TERMS_OF_SERVICE));
    expect(shape(PRIVACY_POLICY_FR)).toEqual(shape(PRIVACY_POLICY));
  });

  it('print the same date as the English', () => {
    const date = new Date(`${LEGAL.lastUpdated} 12:00`);
    const fr = date.toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' });
    expect(fr).toBe(LEGAL.lastUpdatedFr);
    expect(TERMS_OF_SERVICE_FR).toContain(LEGAL.lastUpdatedFr);
    expect(PRIVACY_POLICY_FR).toContain(LEGAL.lastUpdatedFr);
  });

  it('carry the values the English interpolates', () => {
    for (const fr of [TERMS_OF_SERVICE_FR, PRIVACY_POLICY_FR]) {
      expect(fr).toContain(LEGAL.entity);
      expect(fr).toContain(LEGAL.contactEmail);
      expect(fr).not.toContain('undefined');
      expect(fr).not.toMatch(/\$\{/);
    }
    expect(TERMS_OF_SERVICE_FR).toContain(LEGAL.termsUrl);
    expect(PRIVACY_POLICY_FR).toContain(LEGAL.privacyPolicyUrl);
  });

  it('are titled in French', () => {
    expect(TERMS_OF_SERVICE_FR.startsWith('# Conditions d’utilisation')).toBe(true);
    expect(PRIVACY_POLICY_FR.startsWith('# Politique de confidentialité')).toBe(true);
  });
});

describe('the international sections', () => {
  it('name the regions the app is offered in', () => {
    for (const region of [
      '### New Zealand',
      '### Australia',
      '### Canada',
      '### United Kingdom, European Union, Iceland, Liechtenstein and Norway',
    ]) {
      expect(PRIVACY_POLICY).toContain(region);
    }
  });

  it('print both minimum ages', () => {
    expect(TERMS_OF_SERVICE).toContain(`at least ${LEGAL.minimumAgeEea} if you live in the European Union`);
    expect(PRIVACY_POLICY).toContain(`under ${LEGAL.minimumAgeEea} in the European Union`);
    expect(TERMS_OF_SERVICE).toContain(`at least ${LEGAL.minimumAgeCanada} if you live in Canada`);
    expect(PRIVACY_POLICY).toContain(`under ${LEGAL.minimumAgeCanada} in Canada`);
    expect(TERMS_OF_SERVICE_FR).toContain(`au moins ${LEGAL.minimumAgeCanada} ans si vous vivez au Canada`);
  });

  it('promise a representative until one is appointed', () => {
    expect(representative('', 'the United Kingdom')).toBe(
      'to be named here before Rust Strength is offered in the United Kingdom',
    );
    expect(representative('', 'au Royaume-Uni', 'fr')).toBe(
      'sera nommé ici avant que Rust Strength soit offert au Royaume-Uni',
    );
    expect(representative('  Example Rep Ltd, London  ', 'the United Kingdom')).toBe(
      'Example Rep Ltd, London',
    );
  });

  it('describe the health consent the app asks for', () => {
    expect(HEALTH_CONSENT_LABEL).toMatch(/health information/);
    expect(HEALTH_CONSENT_LABEL).toMatch(/Privacy Policy/);
    expect(PRIVACY_POLICY).toContain('We ask for your consent first.');
  });

  it('link the French documents from the English ones', () => {
    expect(PRIVACY_POLICY).toContain(LEGAL.privacyFrUrl);
    expect(TERMS_OF_SERVICE).toContain(LEGAL.termsFrUrl);
  });
});

describe('the sign-up and consent screens', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

  it('ask for the health consent and the regional age, and link the French', () => {
    for (const file of ['app/(auth)/sign-up.tsx', 'src/components/ConsentScreen.tsx']) {
      const source = read(file);
      expect(source).toContain('HEALTH_CONSENT_LABEL');
      expect(source).toContain('ageConfirmationLabel(deviceRegion())');
      expect(source).toContain('<FrenchLegalLinks />');
      expect(source).toMatch(/disabled=\{!ageOk \|\| !termsOk \|\| !healthOk\}/);
    }
  });
});
