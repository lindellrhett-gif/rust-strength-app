# Supabase email templates

Supabase stores these in the dashboard, not in this repo. This folder is the
source of truth so they are not lost; paste them in by hand after any change.

## Confirm signup — required before the next build

New accounts are confirmed with a **code typed into the app**, not a link.
A link is used up by whoever opens it first, and mail apps and company security
scanners open links in messages before the person does — which is why testers
saw "this link has expired" on an email they had only just received. A code
cannot be used up by a scanner, and works when the email is read on a laptop.

1. Supabase dashboard → **Authentication** → **Emails** → **Templates** →
   **Confirm signup**
2. **Subject:** `Your Rust Strength confirmation code`
3. **Body:** paste the contents of `confirm-signup.html`
4. **Save**

Do not leave `{{ .ConfirmationURL }}` in the template. A link alongside the
code would still be scanned, still be used up, and the person who then tapped it
would be told their code was invalid.

Until this is pasted in, the default template sends a link and nobody can
confirm: the app now asks for a code the email does not contain.

## Reset password — required for "Forgot password?"

The app resets passwords with a **code typed into the app**, not a link. A link
has to open the app from the email, which fails whenever the email is read on a
computer, and needs redirect URLs configured correctly. A code works anywhere.

Supabase's default reset email contains only a link, so the in-app flow cannot
work until this template is in place.

1. Supabase dashboard → **Authentication** → **Emails** → **Templates** →
   **Reset password**
2. **Subject:** `Your Rust Strength password reset code`
3. **Body:** paste the contents of `reset-password.html`
4. **Save**

The `{{ .Token }}` placeholder is the code. Do not add `{{ .ConfirmationURL }}`:
the link would sign the user in through a web page the app does not handle.

How long a code lasts is set by the **Email OTP expiration** setting in the
email provider settings under Authentication. The template deliberately names no
duration, so changing that setting never makes the email wrong.

## If confirmations or resets stop arriving

Check **Authentication → Logs** first: it separates "never sent" from "sent,
but the code was already used".

- **Nothing sent, 429 or "email rate limit exceeded":** Authentication →
  **Rate limits** → "Emails sent per hour". The default is low, and sign-ups
  plus resends share it.
- **Nothing sent, SMTP error:** the sender address in **SMTP Settings** has to
  be exactly the Gmail account the App Password belongs to, or Gmail refuses
  the message.
- **Sent, but codes are rejected:** **Email OTP expiration** in the email
  provider settings. Codes people read in the evening need longer than an hour.
- **Sent, but nobody sees it:** spam. A personal Gmail account sending to
  strangers lands there regularly; a transactional provider on your own domain
  is the fix.

## Delivery

Until a custom SMTP provider is connected (**Authentication → Emails → SMTP
Settings**), Supabase only sends to members of your Supabase team, at most two
emails an hour. Fine for testing with your own address; real users will receive
nothing. See `legal/LEGAL_AUDIT.md` section 4.
