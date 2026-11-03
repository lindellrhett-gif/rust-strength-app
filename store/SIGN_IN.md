# Sign in with Apple and Google

The app can sign in, and create an account, with an Apple ID or a Google
account, as well as with an email and password. The code is done; what's left
is setup in Apple's, Google's and Supabase's dashboards, which only you can do.
Work through it in order: the order matters for the database and for deleting
accounts.

## What it does

- **Buttons:** Apple's and Google's own buttons, on the sign-in and
  create-account screens. A first sign-in creates the account; the consent
  screen then asks for the age and Terms confirmations before the app opens.
  The new account starts in the phone's units, as an email sign-up does.
- **Only what's needed:** Apple is asked for the email address only, not the
  name. Google always sends the person's name and picture link; migration
  `0029_sign_in_minimum.sql` drops both before Supabase stores them. An
  account holds the same as an email account: the email address, plus the
  provider's account id.
- **Deleting an account:** Apple requires an app to revoke its Sign in with
  Apple tokens when the account is deleted. An Apple account is asked to
  confirm with Apple once more; the `delete-account` Edge Function trades
  that one-time code for the app's tokens and revokes them, so no Apple token
  is ever stored.
- **App Store rule 4.8:** an app that offers Google sign-in must also offer
  Sign in with Apple. It does.
- **A build without the setup:** no Google client id means no Google button,
  and a phone that can't do Sign in with Apple shows no Apple button. Nothing
  breaks.

## 1. Apple

1. **The capability.** `app.json` now asks for Sign in with Apple. EAS adds
   the capability to the App ID and makes a new provisioning profile at the
   next build of each app. That changes credentials, so run those builds in a
   real terminal, signed in with the App Store Connect key:

   ```powershell
   & .\scripts\eas-build-asc.ps1 development
   ```

   and later the production build the same way. If EAS asks for an Apple ID
   password, press Ctrl+C.
2. **Group the dev app with the real one.** In the Apple Developer site,
   Certificates, Identifiers & Profiles > Identifiers > `com.ruststrength.app.dev`
   > Sign in with Apple > Edit: choose "Group with an existing primary App ID"
   and pick `com.ruststrength.app`. One key then serves both.
3. **A Sign in with Apple key**, for revoking tokens when an account is
   deleted: Keys > + > tick Sign in with Apple > Configure > primary App ID
   `com.ruststrength.app` > Register. Download the `.p8` file (Apple lets you
   download it once) and note the Key ID. Never paste the key into a chat.
4. **Supabase > Authentication > Sign In / Providers > Apple:** turn it on,
   and in Client IDs enter `com.ruststrength.app,com.ruststrength.app.dev`.
   Leave the secret key for OAuth empty; the app signs in natively and doesn't
   need it. **Wait for step 4 of "Going live" below before turning this on in
   the live project.**
5. **Optional: email to Hide My Email addresses.** Apple forwards mail to a
   private relay address only from senders you register. The app's only email
   that could go there is a password-reset code, if an Apple user asks for one.
   To allow it, add the address the codes come from under Certificates,
   Identifiers & Profiles > Services > Sign in with Apple for Email
   Communication.

## 2. Google

1. **Google Cloud Console** (console.cloud.google.com): create a project,
   for example "Rust Strength".
2. **Google Auth Platform > Branding:** app name Rust Strength, your support
   email, and the links to the Privacy Policy and Terms on the website. A logo
   is optional; adding one means Google checks the branding first. Under
   **Audience**, choose External and publish the app ("In production"), or
   only test users can sign in. The app asks for nothing beyond the basic
   sign-in scopes, which need no Google review.
3. **Clients > Create client > iOS**, bundle ID `com.ruststrength.app`. Copy
   the client ID (it ends `.apps.googleusercontent.com`). Make a second one
   for `com.ruststrength.app.dev`.
4. **Supabase > Authentication > Sign In / Providers > Google:** turn it on,
   enter both iOS client IDs in Client IDs (comma-separated), and turn on
   **Skip nonce checks**. The free Google sign-in library can't hand Supabase
   the nonce on iOS. With the check off, a stolen Google sign-in token could be
   replayed for the hour it lasts. That's the setup Supabase documents for
   React Native, and the alternatives are a paid library or a web sign-in page
   that shows Supabase's address. If the dashboard insists on a client secret,
   also create a "Web application" client, put its ID first in the list, and
   use its secret.
5. **EAS:** the client IDs go in as settings. They're public, like the
   Supabase anon key. The development build reads the "preview" settings, as
   the compile check does, so preview gets both and production gets the real
   app's:

   ```powershell
   eas env:create --environment preview --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV --value <dev app's client id> --visibility plaintext
   ```

   ```powershell
   eas env:create --environment preview --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value <real app's client id> --visibility plaintext
   ```

   ```powershell
   eas env:create --environment production --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value <real app's client id> --visibility plaintext
   ```

   For the dev server on the PC, add the same two lines to `.env`
   (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV=...` and
   `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...`). The app reads its bundle ID from
   the phone to pick the right one.

## 3. Going live, in this order

1. **Migration 0029** on the live database, with your named OK. It's
   additive: email sign-ups carry nothing it removes. It goes first so no
   Google name is ever stored.
2. **Edge Function secrets:** under Edge Functions > Secrets, add
   `APPLE_TEAM_ID` (`V7YLBXSTX2`, the team in `app.json`), `APPLE_KEY_ID`, and
   `APPLE_PRIVATE_KEY` (open the `.p8` file in Notepad and paste all of it,
   including the BEGIN and END lines).
3. **Deploy `delete-account`**, with your named OK (it's also part of the
   subscription setup in SUBSCRIPTIONS.md).
4. **Turn on the Apple and Google providers** in Supabase. Apple must come
   after step 3: until the function is live, an Apple account can't be
   deleted.

## 4. Test on a development build

- [ ] Sign in with Apple, choosing Hide My Email: the consent screen appears,
      then the app. Profile shows kg on a phone set to metric.
- [ ] Sign out and sign in with Apple again: the same account, no consent
      screen.
- [ ] Sign in with Google: the account picker, then the consent screen. Sign
      out: the next Google sign-in shows the picker again.
- [ ] Google with the Gmail address of an existing email account: it signs in
      to that account (Supabase links a confirmed email address).
- [ ] Close each sheet without signing in: nothing happens, no error.
- [ ] In Supabase, Authentication > Users > the Google account: its raw user
      metadata has no name or picture.
- [ ] Delete an Apple account: Apple asks to confirm, the account goes, and
      iPhone Settings > your name > Sign-In & Security > Sign in with Apple no
      longer lists Rust Strength. Then cancel Apple's sheet on another account:
      nothing is deleted.
- [ ] Delete a Google account.

## App Store Connect

- **App Privacy:** nothing new. The email address is already declared, and
  Google's name and picture are discarded before they're stored.
- **App Review notes:** the demo account still signs in with email and
  password.
