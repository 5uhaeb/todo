# Auth setup — Google OAuth + email verification code

This is a one-time configuration in the Supabase dashboard. None of it lives in
the repo; it's all project-level settings.

## 1. Site URL and redirect URLs

In Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: your production frontend (e.g. `https://todo.vercel.app`)
- **Redirect URLs**: add every environment the frontend runs in:
  - `http://localhost:5173/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `https://todo.vercel.app/auth/callback`
  - Any preview / staging origins, each ending in `/auth/callback`

The new `Login.jsx` and `AuthCallback.jsx` rely on this path.

## 2. Google OAuth provider

Supabase dashboard → **Authentication → Providers → Google**:

1. Toggle **Enable sign in with Google** on.
2. In Google Cloud Console → APIs & Services → Credentials:
   - Create an **OAuth client ID** of type *Web application*.
   - Authorised redirect URI: the callback URL shown on the Supabase
     provider page — looks like
     `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
   - Copy the **Client ID** and **Client secret** into the Supabase
     provider form.
3. Save.

Once this is done the `Continue with Google` button on `/` works end-to-end.

## 3. Email verification code (6-digit)

By default Supabase's "Confirm signup" email sends a magic link. We want a
6-digit code instead. Supabase generates the token regardless — you just
need to change the template so the user can read it.

Supabase dashboard → **Authentication → Email Templates → Confirm signup**:

Replace the body with something like:

```
<h2>Confirm your Taskflow sign-up</h2>
<p>Your 6-digit verification code is:</p>
<h1 style="letter-spacing:0.25em">{{ .Token }}</h1>
<p>It expires in 1 hour.</p>
<p>Or click this link to confirm: <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a></p>
```

The important bit is the `{{ .Token }}` placeholder — that's the 6-digit
code that `VerifyCode.jsx` verifies against via
`supabase.auth.verifyOtp({ email, token, type: 'signup' })`.

You can keep the link if you want both flows available; the code flow works
independently.

## 4. (Optional) OTP expiry

Authentication → **Email Templates → OTP Expiration** controls how long the
code stays valid. Default 3600 seconds (1 hour) is fine.

## 5. Testing the flow locally

1. `cd frontend && npm run dev`
2. Go to `http://localhost:5173/`.
3. Click **Sign up**, enter an email + password.
4. Check your inbox for the 6-digit code.
5. Enter it on the verify screen. You land on `/dashboard`.
6. Sign out, come back, click **Continue with Google** — should land on
   `/dashboard` too.
