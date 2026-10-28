# Rust Strength Pro (subscriptions)

Built on the `feature/subscriptions` branch, which is **not** part of 1.1.
Merge it only when Pro goes on sale: its Terms and Privacy Policy (version
1.6.0) describe Pro as something you can buy.

**What's decided:**
- Only new features are paid (nutrition and the AI coach, when they exist).
  Everything in 1.0 and 1.1 stays free.
- Pro is sold as **monthly** and **yearly** subscriptions and a one-time
  **Lifetime** purchase.
- All of them grant the RevenueCat entitlement **`rust_strength_pro`**.
- The paywall is **RevenueCat's**, designed in its dashboard. Subscribers
  manage their plan in RevenueCat's **Customer Center**.

**Still yours to decide:** the prices, whether there's a free trial and how
long, and which legal entity sells it (below).

## How it fits together

- **The app** (`src/lib/purchases.ts`) starts RevenueCat's SDK at sign-in
  with the account's id as the RevenueCat customer id. It checks
  `rust_strength_pro`, shows RevenueCat's paywall (`presentPaywallIfNeeded`),
  opens the Customer Center, and restores purchases. The Pro card on Profile
  is the way in.
- **The switch.** Subscriptions are on only with
  `EXPO_PUBLIC_SUBSCRIPTIONS=on` and a key the build can use:
  - **Test Store key (`test_…`):** development builds only. It sells pretend
    products with no App Store involved, so the paywall can be tried before
    anything is on sale. RevenueCat **crashes any release build** that has
    one, and TestFlight counts as release. So the app ignores it outside
    development, and `scripts/check-build-env.js` fails any EAS build except
    `development` that carries one.
  - **App Store key (`appl_…`):** release builds, and only once a paid
    feature is marked `available` in `src/domain/subscription.ts`.

  While off, the SDK is never started and nothing is sent to RevenueCat.
- **The server mirror.** RevenueCat calls the `revenuecat-webhook` Edge
  Function on every change. It writes `public.subscriptions` (migration
  0026), so server code such as the coach can check `has_pro()` without
  trusting the phone. Lifetime is stored as Pro with no expiry.
- **Account deletion,** once Pro is on, goes through the `delete-account` Edge
  Function, which deletes the RevenueCat customer and then runs
  `rpc_delete_my_account`. The app warns that deleting the account doesn't
  cancel an Apple subscription.

## Testing now, with the Test Store

The Test Store key is in your local `.env` (gitignored), with
`EXPO_PUBLIC_SUBSCRIPTIONS=on`. A development build loads its code from Metro
on your PC, which reads `.env`, so no EAS setting is needed. **Don't add the
Test Store key to any EAS environment.**

1. **RevenueCat dashboard,** for the Test Store app:
   1. Make sure the products `monthly`, `yearly` and `lifetime` exist, all
      attached to the entitlement `rust_strength_pro`.
   2. Make sure the offering is marked current, with packages Monthly
      (`$rc_monthly`), Annual (`$rc_annual`) and Lifetime (`$rc_lifetime`).
   3. Design a paywall for that offering. In the paywall editor, turn on
      **Restore purchases** and add links to the **Terms of Use**
      (`https://lindellrhett-gif.github.io/rust-strength/terms.html`) and
      **Privacy Policy** (`…/privacy.html`). Apple requires them on a
      subscription screen.
   4. Optional: set up the Customer Center. It needs a RevenueCat **Pro or
      Enterprise** plan. Without it, "Manage subscription" opens Apple's
      subscription settings instead.
2. **A development build from this branch** (it adds RevenueCat's native
   code): check out `feature/subscriptions`, then
   `eas build --profile development --platform ios`.
3. Start Metro (`npx expo start --dev-client`) and open Rust Strength Dev.
   Go to Profile > Rust Strength Pro > See plans. Then:
   1. Buy each product.
   2. Check the status line ("Pro · renews …", "Pro · lifetime").
   3. Open Manage subscription and Restore purchases.
   4. Sign out and back in as someone else; they shouldn't have Pro.

## Before anything goes on sale: who sells it

Selling in-app purchases needs Apple's **Paid Applications Agreement** and
banking and tax details in App Store Connect (Business).

Your developer account is an **Individual** account, so Apple would pay you
personally and list you as the seller. The Terms and Privacy Policy name
Bluestem Software LLC.

If the LLC should be the seller, Apple has to convert the account to an
Organization, which needs the LLC's D-U-N-S number. Decide this, ideally with
an accountant or attorney, before setting up banking.

## Going live with the App Store

1. **App Store Connect > Rust Strength:**
   1. Under Subscriptions, create a subscription group, "Rust Strength Pro".
   2. Add two auto-renewable subscriptions: monthly (1 month) and yearly
      (1 year).
   3. Under In-App Purchases, add a **non-consumable** for Lifetime.
   4. Set prices, display names, descriptions and review screenshots. Add a
      free trial as an introductory offer if you want one.
2. **App Store Connect > Users and Access > Integrations > In-App Purchase:**
   generate an in-app purchase key for RevenueCat. Keep it like the App Store
   Connect key, never in the repo.
3. **RevenueCat:**
   1. Add the App Store app (bundle ID `com.ruststrength.app`) and upload
      that key.
   2. Import the three App Store products.
   3. Attach them to `rust_strength_pro`.
   4. Put them in the current offering, with the same package types as the
      Test Store.
4. **Supabase:**
   1. Apply migration `0026_subscriptions.sql`. It's additive and safe while
      1.0 and 1.1 are live.
   2. Under Edge Functions > Secrets, add `REVENUECAT_SECRET_API_KEY`
      (RevenueCat > API keys > a secret v1 key).
   3. Add `REVENUECAT_WEBHOOK_AUTH`: a long random string, prefixed `Bearer `.
   4. Deploy both functions:

      ```powershell
      npx supabase functions deploy revenuecat-webhook --no-verify-jwt --project-ref <project id>
      ```

      ```powershell
      npx supabase functions deploy delete-account --project-ref <project id>
      ```
5. **RevenueCat > Integrations > Webhooks:** point a webhook at
   `https://<project id>.supabase.co/functions/v1/revenuecat-webhook`, with the
   authorization header set to exactly `REVENUECAT_WEBHOOK_AUTH`. Send a test
   event; it should return 200.
6. **EAS environment `production`:**
   1. Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` to RevenueCat's App Store key
      (`appl_…`). It is public by design, like the Supabase anon key; the
      secret key never goes in the app or in EAS.
   2. Set `EXPO_PUBLIC_SUBSCRIPTIONS=on` when Pro launches.
7. **Sandbox test** on a TestFlight build with a sandbox tester (Users and
   Access > Sandbox):
   1. Buy, restore and cancel.
   2. Check the row in `subscriptions` updates.
   3. Delete a test account and check the RevenueCat customer is gone.

## At launch

- [ ] The paid feature is real, its `available` flag is `true`, and the
      paywall's wording (in RevenueCat) matches what it does.
- [ ] Merge `feature/subscriptions`. The legal version is 1.6.0, so everyone
      is asked to accept the new Terms and Privacy Policy once.
- [ ] Publish the legal documents (`npm run legal`, push the site repo)
      **before** submitting the build for review. Reviewers check the links.
- [ ] App Store Connect, App Privacy: add **Purchases > Purchase History**
      (linked to the user, App Functionality, not tracking).
- [ ] The app's description links the Terms of Use and the Privacy Policy.
      Apple requires these for subscriptions.
- [ ] Submit the in-app purchases together with the build, so App Review sees
      both.
- [ ] Attorney question (optional, your call):
  - state automatic-renewal laws, and whether Apple's own purchase flow and
    emails cover your disclosure duties
  - the Lifetime wording in the Terms (section 9)

  Nothing here has been reviewed by a lawyer.
