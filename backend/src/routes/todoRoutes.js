import express from "express";
import { randomUUID } from "node:crypto";
import { authMiddleware } from "../middleware/auth.js";
import { one, query } from "../utils/drivebase.js";
const router = express.Router();
router.use(authMiddleware);
const validId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param("id", (req, res, next, id) =>
  validId.test(id)
    ? next()
    : res.status(400).json({ message: "Invalid task ID" }),
);
const route = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (e) {
    next(e);
  }
};
const task = (row) => row && { ...row, completed: Boolean(row.completed) };
function invalid(body, partial = false) {
  if (
    (!partial || body.title !== undefined) &&
    (typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 500)
  )
    return "Title must contain 1 to 500 characters";
  if (
    body.priority !== undefined &&
    !["low", "normal", "high"].includes(body.priority)
  )
    return "Invalid priority";
  if (body.completed !== undefined && typeof body.completed !== "boolean")
    return "Completed must be a boolean";
  if (
    partial &&
    !["title", "priority", "completed"].some((key) => body[key] !== undefined)
  )
    return "No task changes supplied";
}
router.get(
  "/",
  route(async (req, res) => {
    const offset = Math.max(
      0,
      Number.parseInt(req.query.offset || "0", 10) || 0,
    );
    const result = await query(
      "SELECT * FROM todos WHERE user_id=? ORDER BY created_at DESC,id LIMIT 500 OFFSET ?",
      [req.user.id, offset],
    );
    res.json({
      source: "drivebase",
      todos: result.rows.map(task),
      offset,
      limit: 500,
    });
  }),
);
router.post(
  "/",
  route(async (req, res) => {
    const error = invalid(req.body);
    if (error) return res.status(400).json({ message: error });
    const { title, priority = "normal" } = req.body;
    // Check the free-account limit in the insertion itself to cover concurrent requests.
    const row = await one(
      "INSERT INTO todos(id,user_id,title,completed,priority,created_at) SELECT ?,?,?,0,?,? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=? AND (role='premium' OR (?<>'high' AND (SELECT count(*) FROM todos WHERE user_id=?)<10))) RETURNING *",
      [
        randomUUID(),
        req.user.id,
        title.trim(),
        priority,
        new Date().toISOString(),
        req.user.id,
        priority,
        req.user.id,
      ],
    );
    if (!row)
      return res
        .status(403)
        .json({
          message:
            "Free accounts allow 10 tasks. High priority requires premium.",
        });
    res.status(201).json(task(row));
  }),
);
router.put(
  "/:id",
  route(async (req, res) => {
    const error = invalid(req.body, true);
    if (error) return res.status(400).json({ message: error });
    const profile = await one("SELECT role FROM profiles WHERE id=?", [
      req.user.id,
    ]);
    if (req.body.priority === "high" && profile?.role !== "premium")
      return res
        .status(403)
        .json({ message: "High priority requires premium" });
    const changes = Object.entries(req.body).filter(([key]) =>
      ["title", "priority", "completed"].includes(key),
    );
    const row = await one(
      "UPDATE todos SET " +
        changes.map(([key]) => key + "=?").join(",") +
        " WHERE id=? AND user_id=? RETURNING *",
      [
        ...changes.map(([key, value]) =>
          key === "title"
            ? value.trim()
            : key === "completed"
              ? Number(value)
              : value,
        ),
        req.params.id,
        req.user.id,
      ],
    );
    if (!row) return res.status(404).json({ message: "Task not found" });
    res.json(task(row));
  }),
);
router.delete(
  "/:id",
  route(async (req, res) => {
    const { changes } = await query(
      "DELETE FROM todos WHERE id=? AND user_id=?",
      [req.params.id, req.user.id],
    );
    if (!changes) return res.status(404).json({ message: "Task not found" });
    res.json({ message: "Task deleted" });
  }),
);
export default router;
