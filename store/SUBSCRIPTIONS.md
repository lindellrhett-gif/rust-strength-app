# Rust Strength Pro (subscriptions)

Built on the `feature/subscriptions` branch, which is **not** part of 1.1.
Merge it only when Pro goes on sale: its Terms and Privacy Policy (version
1.6.0) describe Pro as something you can buy.

**What's decided:** only new features are paid (nutrition and the AI coach,
when they exist). Everything in 1.0 and 1.1 stays free. Plans are monthly and
yearly. The paywall is drawn in the app.

**Still yours to decide:** the prices, whether there's a free trial and how
long, and which legal entity sells it (below).

## How it fits together

- **The app** uses RevenueCat's SDK (`src/lib/purchases.ts`) to show the
  plans, buy, restore, and check Pro. RevenueCat talks to Apple.
- **The switch.** Subscriptions are off unless all three hold:
  - the build has `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
  - it has `EXPO_PUBLIC_SUBSCRIPTIONS=on`
  - at least one paid feature is marked `available` in
    `src/domain/subscription.ts`

  While off, the SDK is never started and nothing is sent to RevenueCat.
- **The server mirror.** RevenueCat calls the `revenuecat-webhook` Edge
  Function on every change. That function writes `public.subscriptions`
  (migration 0026), so server code such as the coach can check `has_pro()`
  without trusting the phone.
- **Account deletion,** once Pro is on, goes through the `delete-account` Edge
  Function. It deletes the RevenueCat customer, then runs
  `rpc_delete_my_account`. The app warns that deleting the account doesn't
  cancel the Apple subscription.

## Before anything else: who sells it

To sell in-app purchases you must accept Apple's **Paid Applications
Agreement** and add banking and tax details in App Store Connect (Business).

Your developer account is currently an **Individual** account, so Apple would
pay you personally, and the App Store would show you as the seller. The
Terms and Privacy Policy name Bluestem Software LLC.

If the LLC should be the seller, Apple has to convert the account to an
Organization, which needs the LLC's D-U-N-S number. Decide this, ideally with
an accountant or attorney, before setting up banking.

## Setup, in order

1. **App Store Connect > Rust Strength > Subscriptions**
   1. Create a subscription group named "Rust Strength Pro".
   2. Add two auto-renewable subscriptions: `com.ruststrength.app.pro.monthly`
      (1 month) and `com.ruststrength.app.pro.yearly` (1 year).
   3. For each one, set prices, a display name and description, and a review
      screenshot. Add a free trial as an introductory offer if you want one.
2. **App Store Connect > Users and Access > Integrations > In-App Purchase:**
   generate an in-app purchase key for RevenueCat. Download it once and keep
   it like the App Store Connect key, never in the repo.
3. **RevenueCat** (app.revenuecat.com):
   1. Create a project and add an App Store app with bundle ID
      `com.ruststrength.app`.
   2. Upload the in-app purchase key from step 2.
   3. Add the two products.
   4. Create an entitlement with the identifier **`pro`** and attach both
      products to it.
   5. Create an offering named `default`, marked current, with packages
      **Monthly** (`$rc_monthly`) and **Annual** (`$rc_annual`).
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
   `https://<project id>.supabase.co/functions/v1/revenuecat-webhook`. Set its
   authorization header to exactly the `REVENUECAT_WEBHOOK_AUTH` value. Send a
   test event; it should return 200.
6. **EAS environment variables:**
   1. Set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` to RevenueCat's **public** iOS SDK
      key, which starts `appl_`. It is public by design, like the Supabase
      anon key. The secret key never goes in the app or in EAS.
   2. Set `EXPO_PUBLIC_SUBSCRIPTIONS=on` in the `preview` environment for
      testing. Set it in `production` only when Pro launches.
7. **Testing:**
   1. Add a sandbox tester in App Store Connect (Users and Access > Sandbox).
   2. Temporarily mark a feature `available` in
      `src/domain/subscription.ts` in a development build, then buy, restore
      and cancel with the sandbox account.
   3. Check the row in `subscriptions` updates.
   4. Delete a test account and check the RevenueCat customer is gone.

## At launch

- [ ] The paid feature is real, its `available` flag is `true`, and its
      description on the paywall matches what it does.
- [ ] Merge `feature/subscriptions`. The legal version is 1.6.0, so everyone
      is asked to accept the new Terms and Privacy Policy once.
- [ ] Publish the legal documents (`npm run legal`, push the site repo)
      **before** submitting the build for review. Reviewers check the
      links.
- [ ] App Store Connect, App Privacy: add **Purchases > Purchase History**
      (linked to the user, App Functionality, not tracking).
- [ ] App Store Connect, the app's description: link the Terms of Use
      (`termsUrl`) and Privacy Policy. Apple requires these for
      subscriptions.
- [ ] Submit the subscriptions together with the build, so App Review sees
      both.
- [ ] Attorney question (optional, your call): state automatic-renewal laws
      and whether Apple's own purchase flow and emails cover your disclosure
      duties. Nothing here has been reviewed by a lawyer.
