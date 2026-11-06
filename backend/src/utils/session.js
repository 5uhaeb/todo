import jwt from "jsonwebtoken";
import { one } from "./drivebase.js";
export const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  hasPassword: Boolean(user.password_hash),
});
function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw new Error("JWT_SECRET must contain at least 32 characters");
  return process.env.JWT_SECRET;
}
export function createSession(user) {
  return {
    access_token: jwt.sign(
      { sub: user.id, version: user.token_version },
      secret(),
      {
        algorithm: "HS256",
        audience: "taskflow",
        issuer: "taskflow",
        expiresIn: "7d",
      },
    ),
    expires_at: Math.floor(Date.now() / 1000) + 7 * 86400,
    user: publicUser(user),
  };
}
export async function authenticate(token) {
  const claims = jwt.verify(token, secret(), {
    algorithms: ["HS256"],
    audience: "taskflow",
    issuer: "taskflow",
  });
  if (typeof claims.sub !== "string") throw new Error("Invalid session");
  const user = await one("SELECT * FROM application_users WHERE id=?", [
    claims.sub,
  ]);
  if (
    !user ||
    !user.email_verified ||
    user.disabled ||
    claims.version !== user.token_version
  )
    throw new Error("Session expired");
  return user;
}
