import { authenticate, publicUser } from "../utils/session.js";
export async function authMiddleware(req, res, next) {
  const token = req.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return res.status(401).json({ message: "Sign in to continue" });
  try {
    req.account = await authenticate(token);
    req.user = publicUser(req.account);
    next();
  } catch {
    res
      .status(401)
      .json({ message: "Your session has expired. Please sign in again." });
  }
}
