# Taskflow verification

Install dependencies with `npm ci`, `npm --prefix backend ci` and `npm --prefix frontend ci`.

- `npm test`: 11 isolated payment route tests, including ownership, signature, capture, amount, currency and database failures. No real charge is made.
- `npm run build`: production frontend build.
- `npm run test:integration`: 30 integration/browser checks against a disposable set of users in the Taskflow Supabase project. Requires `SUPABASE_ACCESS_TOKEN` in the process environment and Chrome at the executable path specified in the script. It applies the checked-in database migrations, starts local API/frontend servers on ports 5000/5173, tests concurrency and tenant isolation, and removes its test users in a finally block. Signup codes are generated through the admin API without sending email.

## Deployment

The existing Vercel project uses `frontend` as its root directory. Set `VITE_API_URL=/api`; `frontend/vercel.json` proxies API requests over HTTPS to the existing Render service. The root Vercel configuration supports deploying from the repository root as well.

Render uses the `backend` directory, its Dockerfile, and existing Supabase/Redis/Razorpay environment variables. `FRONTEND_URL` must include the production frontend origin; multiple allowed origins may be comma-separated.

Public signup email delivery requires a custom SMTP provider in Supabase. Email confirmation remains enabled. Google OAuth reaches the Google login page; a human Google login is required to complete the provider consent/callback check. Razorpay is configured in test mode; automated verification covers payment handling but does not complete interactive checkout.

`tests/production.mjs` exercises the deployed HTTPS frontend/API with disposable users, checks cache hits and invalidation, creates a Razorpay test order without charging, verifies browser login and OTP, and removes all test users. Requires the same process environment token.

The expired Redis Cloud hostname was replaced with a free Render Key Value instance, connected over the private network. The unused OAuth-server consent route redirects to sign-in; Google login continues to use `/auth/callback`.
