import express from "express";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { rateLimit } from "express-rate-limit";
import { authMiddleware } from "../middleware/auth.js";
import { one, query } from "../utils/drivebase.js";
import { createSession, publicUser } from "../utils/session.js";
const router = express.Router();
const limited = rateLimit({
  windowMs: 15 * 60000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});
const cookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth",
};
const route = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (e) {
    next(e);
  }
};
router.post(
  "/login",
  limited,
  route(async (req, res) => {
    const { email, password } = req.body;
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      typeof password !== "string" ||
      Buffer.byteLength(password) > 72
    )
      return res.status(400).json({ message: "Enter your email and password" });
    const user = await one("SELECT * FROM application_users WHERE email=?", [
      email.trim().toLowerCase(),
    ]);
    const hash =
      user?.password_hash ||
      "$2a$12$C6UzMDM.H6dfI/f/IKcEe.8PoZftk5UuqWX4d7NQZrPqP4dCB9sHa";
    const matched = await bcrypt.compare(password, hash);
    if (!matched || !user?.email_verified || user.disabled)
      return res
        .status(401)
        .json({
          message:
            "Email or password is incorrect. New accounts can continue with Google.",
        });
    res.json({ session: createSession(user) });
  }),
);
router.post("/signup", limited, (_req, res) =>
  res
    .status(409)
    .json({
      message:
        "Continue with Google to verify your email, then set a password in Account. Email verification is not configured yet.",
    }),
);
router.get("/google/start", limited, (req, res) => {
  const state = randomBytes(32).toString("base64url");
  res.cookie("taskflow_oauth_state", state, { ...cookie, maxAge: 10 * 60000 });
  const target = new URL(
    "/api/identity/google",
    process.env.DRIVEBASE_AUTH_URL || "https://drivebase-5uhaeb.vercel.app",
  );
  target.searchParams.set("app", "taskflow");
  target.searchParams.set("state", state);
  res.redirect(target.toString());
});
router.post(
  "/google/exchange",
  limited,
  route(async (req, res) => {
    const { token, state } = req.body;
    const match = (req.get("cookie") || "")
      .split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith("taskflow_oauth_state="));
    const expected = match?.slice("taskflow_oauth_state=".length);
    res.clearCookie("taskflow_oauth_state", cookie);
    if (
      typeof state !== "string" ||
      !expected ||
      expected.length !== state.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(state))
    )
      return res
        .status(400)
        .json({ message: "Sign-in state expired. Please try again." });
    let identity;
    try {
      if (
        !process.env.TASKFLOW_IDENTITY_SECRET ||
        process.env.TASKFLOW_IDENTITY_SECRET.length < 32
      )
        throw new Error("Missing identity configuration");
      identity = jwt.verify(token, process.env.TASKFLOW_IDENTITY_SECRET, {
        algorithms: ["HS256"],
        issuer: "drivebase",
        audience: "taskflow",
      });
      if (
        identity.state !== state ||
        identity.email_verified !== true ||
        typeof identity.email !== "string" ||
        typeof identity.sub !== "string"
      )
        throw new Error("Invalid identity");
    } catch {
      return res
        .status(401)
        .json({
          message: "Google sign-in could not be verified. Please try again.",
        });
    }
    const email = identity.email.toLowerCase();
    const current = await one("SELECT * FROM application_users WHERE email=?", [
      email,
    ]);
    if (
      current?.disabled ||
      (current?.google_sub && current.google_sub !== identity.sub)
    )
      return res.status(403).json({ message: "Account access is unavailable" });
    const id = current?.id || randomUUID();
    const user = await one(
      "INSERT INTO application_users(id,email,password_hash,email_verified,google_sub,token_version,disabled) VALUES(?,?,NULL,1,?,0,0) ON CONFLICT(email) DO UPDATE SET email_verified=1,google_sub=excluded.google_sub RETURNING *",
      [id, email, identity.sub],
    );
    await query(
      "INSERT INTO profiles(id,email,role,created_at) VALUES(?,?,'free',?) ON CONFLICT(id) DO NOTHING",
      [user.id, email, new Date().toISOString()],
    );
    res.json({ session: createSession(user) });
  }),
);
router.get("/session", authMiddleware, (req, res) =>
  res.json({ user: req.user }),
);
router.post(
  "/logout",
  authMiddleware,
  route(async (req, res) => {
    await query(
      "UPDATE application_users SET token_version=token_version+1 WHERE id=?",
      [req.user.id],
    );
    res.json({ ok: true });
  }),
);
router.put(
  "/password",
  limited,
  authMiddleware,
  route(async (req, res) => {
    const { password, currentPassword } = req.body;
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password) > 72
    )
      return res
        .status(400)
        .json({ message: "Use 8 or more characters, up to 72 UTF-8 bytes" });
    if (
      req.account.password_hash &&
      (typeof currentPassword !== "string" ||
        Buffer.byteLength(currentPassword) > 72 ||
        !(await bcrypt.compare(currentPassword, req.account.password_hash)))
    )
      return res.status(401).json({ message: "Current password is incorrect" });
    const hash = await bcrypt.hash(password, 12);
    const user = await one(
      "UPDATE application_users SET password_hash=?,token_version=token_version+1 WHERE id=? RETURNING *",
      [hash, req.user.id],
    );
    res.json({ session: createSession(user) });
  }),
);
router.get(
  "/me",
  authMiddleware,
  route(async (req, res) => {
    let profile = await one("SELECT * FROM profiles WHERE id=?", [req.user.id]);
    if (!profile)
      profile = await one(
        "INSERT INTO profiles(id,email,role,created_at) VALUES(?,?,'free',?) ON CONFLICT(id) DO UPDATE SET email=excluded.email RETURNING *",
        [req.user.id, req.user.email, new Date().toISOString()],
      );
    res.json({ user: publicUser(req.account), profile });
  }),
);
export default router;
