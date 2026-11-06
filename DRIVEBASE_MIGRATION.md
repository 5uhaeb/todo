# Drivebase migration

This branch replaces Supabase data and authentication with a Taskflow backend using Drivebase SQL. The new frontend target is https://suhaeb-taskflow.vercel.app; taskflow.vercel.app was unavailable.

## Authentication

Existing verified accounts retain their UUIDs and bcrypt password hashes. Google sign-in matches a verified Google email to the existing account. New accounts verify through Google and can set an optional password in Account. Accounts already using a password supply their current password before changing it. Password changes and logout revoke previous sessions through the stored token version.

An email sender is not configured. Signup verification emails, email OTP and email password-reset messages are unavailable. The previous development-only Supabase MFA screen is removed; this branch does not implement replacement MFA.

Google identity is brokered through Drivebase's existing registered OAuth callback. Taskflow /api/auth/google/start sets a state cookie; the broker requests only openid/email/profile and returns a 60-second state-bound identity token in the callback fragment. Taskflow checks the state cookie and the broker signature before creating its own session. Google account access to an OAuth app still in Testing is limited to its configured test users.

## Configuration and running

Copy backend/.env.example. Set the taskflow database-scoped Drivebase connection, a stable JWT_SECRET and TASKFLOW_IDENTITY_SECRET shared with the Drivebase backend. Configure the broker TASKFLOW_FRONTEND_URL as the exact new frontend origin. Set FRONTEND_URL on Taskflow. Its API must be proxied under the frontend's /api path to preserve OAuth state cookies. Confirm the new Render URL in both vercel.json files before deployment.

Import a validated SQLite snapshot based on backend/schema.sql before starting the backend. Do not initialize an empty database over an existing target. Application accounts, profiles, premium roles and tasks are imported together. Missing profiles receive a free default while existing roles remain unchanged.

Run npm ci --prefix backend, npm ci --prefix frontend, npm test and npm run build --prefix frontend. Start backend/src/index.js on Render. Publish frontend on Vercel with VITE_API_URL=/api. The optional Razorpay gateway still requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET; unconfigured checkout returns 503. Payment ownership, captured status, amount and currency are verified before granting premium.

## Data and rollback

The backend enforces task ownership in every query. Free-account quota checks occur inside the insert statement. Browser sessions last up to seven days and are checked against account state on the server. No database credential goes to the browser.

Keep private exports encrypted, source Supabase data intact and the original deployment available. This is a snapshot migration, not ongoing replication. Reconcile writes made to the source after the snapshot before cutover. Do not overwrite a destination that already has application data. Current Drivebase limits are 10 MiB per database and one backend writer instance.
