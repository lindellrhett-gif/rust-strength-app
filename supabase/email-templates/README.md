# Supabase email templates

Supabase stores these in the dashboard, not in this repo. This folder is the
source of truth so they are not lost; paste them in by hand after any change.

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

## Delivery

Until a custom SMTP provider is connected (**Authentication → Emails → SMTP
Settings**), Supabase only sends to members of your Supabase team, at most two
emails an hour. Fine for testing with your own address; real users will receive
nothing. See `legal/LEGAL_AUDIT.md` section 4.
