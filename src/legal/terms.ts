import { LEGAL } from './config';

/**
 * Terms of Service.
 *
 * Scoped to what this app actually is: a free, no-purchase, no-ads workout
 * tracker with an opt-in friends feature. Clauses that would not apply (payment
 * terms, refunds, marketplace rules) are deliberately absent.
 */
export const TERMS_OF_SERVICE = `# Terms of Service

**Last updated: ${LEGAL.lastUpdated}**

These Terms are an agreement between you and ${LEGAL.entity} ("we", "us") covering your use of ${LEGAL.appName} (the "App"). By creating an account you agree to them.

## 1. Not medical or fitness advice

**Read this section carefully.**

${LEGAL.appName} is a logging and calculation tool. It is **not** a medical device, a healthcare service, a personal trainer, or a substitute for professional advice.

- The weight suggestions are produced by a **mathematical formula** applied to numbers you type in. They are estimates, not a prescription.
- The estimated one-rep max is an **estimate**, not a measurement, and not a safe target.
- Generated workouts are **general suggestions** built from your equipment and history, not a program designed for you by a professional.
- Distance, pace, elevation, steps and calories from a recorded run are **estimates** from your phone's GPS and motion sensors, which can be wrong, especially near tall buildings, under trees or in tunnels.
- Trophies and streaks are for motivation. Nothing in the App is a recommendation to train through pain, injury, or exhaustion.

**Lifting weights carries a real risk of serious injury.** You are solely responsible for deciding what is safe for you. Consult a qualified physician or trainer before starting or changing a training program, particularly if you have any medical condition or injury. Do not attempt a weight because the App suggested it. Use appropriate form, equipment, and spotters.

**Running outdoors has its own risks.** Watch where you are going, not your phone, and obey traffic laws. Maps and saved routes do not tell you whether a route is safe, legal or open to the public.

## 2. Eligibility

You must be at least ${LEGAL.minimumAge} years old. By creating an account you confirm that you are. If you are under 18, you should have a parent or guardian review these Terms.

## 3. Your account

You are responsible for keeping your password secure and for activity under your account. Give us accurate information and keep it current. Tell us at ${LEGAL.contactEmail} if you believe your account has been accessed without your permission.

One account per person. Do not share, sell or transfer your account.

## 4. Acceptable use

The App has a social layer where other users can see your username, display name and training stats. When you type anything visible to another person, or use the App at all, you agree not to:

- Harass, threaten, bully, stalk or abuse anyone
- Impersonate any person or organisation, or pick a username or display name suggesting you are someone you are not
- Use obscene, hateful, sexually explicit, or discriminatory names or text
- Post anything unlawful, or that infringes anyone's rights
- Spam other users or send unsolicited promotions
- Attempt to access another user's account or data
- Probe, scan, overload, reverse-engineer, scrape or disrupt the service
- Use automated means to create accounts or extract data
- Use the App to build a competing product

## 5. Content you create

You keep ownership of everything you enter — your training data, names, notes and preferences. You grant us only the permission needed to run the service for you: to store your content, display it back to you, and show the parts you have chosen to share with the friends you have accepted.

We do not claim ownership of your content, and we do not use it for marketing.

You are responsible for your content and confirm you have the right to post it.

## 6. Reporting and enforcement

If someone's username, display name or behaviour breaks these rules, report them from their profile in the App, or email ${LEGAL.contactEmail}. You can also block any user immediately, which removes any friendship and hides you from each other.

We review reports and may remove content, restrict features, or suspend or terminate accounts that break these Terms. We aim to act on reports of abusive content within 24 hours. We may act without notice where someone's safety is at risk.

If you think we got it wrong, email ${LEGAL.contactEmail} and we will review it.

## 7. Copyright

If you believe content in the App infringes your copyright, email ${LEGAL.contactEmail} with a description of the work, where it appears, your contact details, a statement that you believe the use is unauthorised, and a statement under penalty of perjury that your notice is accurate and you are authorised to act. We will remove infringing material and may terminate repeat infringers.

## 8. Our content

The App itself — its code, design, text, icons and branding — belongs to us or our licensors. We grant you a personal, non-exclusive, non-transferable, revocable licence to use the App for your own non-commercial use. You may not copy, modify, distribute, sell or create derivative works from it.

## 9. The App is free

${LEGAL.appName} is currently free with no purchases or subscriptions. If we introduce paid features, we will tell you the price and terms before you are charged, and any purchase will go through the App Store or Google Play under their rules.

## 10. Availability

We may change, suspend or discontinue any part of the App at any time. We do not guarantee it will be available, uninterrupted, or error-free. We may impose limits on storage or usage.

**Keep your own records of anything important to you.** Use the data export tool in the App to download a copy.

## 11. Ending your account

You may delete your account at any time from **Profile → Privacy & legal → Delete account**. This permanently deletes your data and cannot be undone.

We may suspend or terminate your account if you break these Terms, if required by law, or if we stop operating the App.

## 12. Disclaimers

**THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.**

We do not warrant that the App will meet your requirements, be uninterrupted or error-free, that defects will be corrected, or that any calculation, estimate or suggestion it produces is accurate or appropriate for you.

Some jurisdictions do not allow the exclusion of certain warranties, so parts of this section may not apply to you.

## 13. Limitation of liability

**TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, GOODWILL, OR PERSONAL INJURY, ARISING FROM YOUR USE OF THE APP.**

**OUR TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE APP WILL NOT EXCEED ONE HUNDRED US DOLLARS ($100).**

Some jurisdictions do not allow limiting liability for personal injury or gross negligence, so parts of this section may not apply to you. Nothing here limits liability that cannot be limited by law.

## 14. Indemnification

You agree to indemnify and hold harmless ${LEGAL.entity} from claims, damages and reasonable legal fees arising from your use of the App, your content, or your breach of these Terms.

## 15. Governing law and disputes

These Terms are governed by the laws of the State of ${LEGAL.governingState}, without regard to conflict-of-law rules.

Please contact us at ${LEGAL.contactEmail} first — most issues can be resolved informally. If we cannot resolve a dispute within 30 days, it will be brought in the state or federal courts located in ${LEGAL.governingState}, and you and we consent to that jurisdiction.

Nothing here prevents either of us from bringing a claim in small-claims court.

## 16. Apple and Google

These Terms are between you and us, not with Apple or Google. Apple and Google are not responsible for the App or for any claims about it, and are third-party beneficiaries of these Terms with the right to enforce them against you. Your use is also subject to the applicable App Store or Google Play terms.

## 17. Changes

We may update these Terms. If the change is material we will update the date above and ask you to accept the new version in the App. Continuing to use the App after that means you accept the change.

## 18. General

If any provision is unenforceable, the rest stays in force. Our not enforcing a provision is not a waiver of it. These Terms, with the Privacy Policy, are the whole agreement between us.

## 19. Contact

${LEGAL.entity}
${LEGAL.contactEmail}
`;
