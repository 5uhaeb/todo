import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import initSqlJs from "sql.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

test("Drivebase authentication and task ownership work together", async (t) => {
  process.env.JWT_SECRET = "test-only-session-secret-with-at-least-32-chars";
  process.env.TASKFLOW_IDENTITY_SECRET =
    "test-only-identity-secret-with-at-least-32-chars";
  process.env.DRIVEBASE_API_URL = "https://storage.invalid/api";
  process.env.DRIVEBASE_DATABASE_ID = "test-database";
  process.env.DRIVEBASE_API_KEY = "private-backend-test-key";
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys=ON");
  db.run(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  const owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222";
  const password = "existing-password";
  const hash = await bcrypt.hash(password, 4);
  for (const [id, email, verified] of [
    [owner, "owner@example.test", 1],
    [other, "other@example.test", 1],
    ["unverified", "pending@example.test", 0],
  ]) {
    db.run(
      "INSERT INTO application_users(id,email,password_hash,email_verified) VALUES(?,?,?,?)",
      [id, email, hash, verified],
    );
    db.run("INSERT INTO profiles(id,email,role,created_at) VALUES(?,?,?,?)", [
      id,
      email,
      "free",
      "2026-01-01",
    ]);
  }
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith("https://storage.invalid/"))
      return originalFetch(url, options);
    assert.equal(
      options.headers.Authorization,
      "Bearer private-backend-test-key",
    );
    const { sql, params } = JSON.parse(options.body);
    const statement = db.prepare(sql);
    try {
      statement.bind(params);
      const columns = statement.getColumnNames(),
        rows = [];
      while (statement.step()) rows.push(statement.get());
      return Response.json({ columns, rows, changes: db.getRowsModified() });
    } finally {
      statement.free();
    }
  };
  const { default: app } = await import("../src/app.js");
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port + "/api";
  async function request(
    path,
    { method = "GET", token, body, status = 200, cookie } = {},
  ) {
    const res = await originalFetch(base + path, {
      method,
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    assert.equal(res.status, status, path);
    return { res, data: res.status === 302 ? null : await res.json() };
  }
  let token, otherToken, taskId;
  try {
    await t.test(
      "retains verified password hashes and rejects pending accounts",
      async () => {
        await request("/auth/login", {
          method: "POST",
          body: { email: { $ne: null }, password },
          status: 400,
        });
        await request("/auth/login", {
          method: "POST",
          body: { email: "pending@example.test", password },
          status: 401,
        });
        token = (
          await request("/auth/login", {
            method: "POST",
            body: { email: "OWNER@example.test", password },
          })
        ).data.session.access_token;
        otherToken = (
          await request("/auth/login", {
            method: "POST",
            body: { email: "other@example.test", password },
          })
        ).data.session.access_token;
        assert.equal(jwt.decode(token).sub, owner);
        await request("/todos", { status: 401 });
        await request("/todos", { token: token + "tampered", status: 401 });
      },
    );
    await t.test(
      "isolates owners and serializes the free plan limit in SQL",
      async () => {
        taskId = (
          await request("/todos", {
            method: "POST",
            token,
            body: { title: "Imported owner task" },
            status: 201,
          })
        ).data.id;
        await request("/todos/" + taskId, {
          method: "PUT",
          token: otherToken,
          body: { completed: true },
          status: 404,
        });
        await request("/todos/" + taskId, {
          method: "DELETE",
          token: otherToken,
          status: 404,
        });
        assert.deepEqual(
          (await request("/todos", { token: otherToken })).data.todos,
          [],
        );
        await request("/todos", {
          method: "POST",
          token,
          body: { title: "Premium only", priority: "high" },
          status: 403,
        });
        const results = await Promise.all(
          Array.from({ length: 12 }, (_, i) =>
            originalFetch(base + "/todos", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
              },
              body: JSON.stringify({ title: "Concurrent " + i }),
            }),
          ),
        );
        assert.equal(results.filter((r) => r.status === 201).length, 9);
        assert.equal(
          (await request("/todos", { token })).data.todos.length,
          10,
        );
      },
    );
    await t.test(
      "Google exchange rejects invalid state and preserves the matched owner and premium plan",
      async () => {
        db.run("UPDATE profiles SET role='premium' WHERE id=?", [owner]);
        const { res } = await request("/auth/google/start", { status: 302 });
        const state = new URL(res.headers.get("location")).searchParams.get(
          "state",
        );
        const identity = jwt.sign(
          {
            sub: "google-owner",
            email: "owner@example.test",
            email_verified: true,
            state,
          },
          process.env.TASKFLOW_IDENTITY_SECRET,
          { issuer: "drivebase", audience: "taskflow", expiresIn: "60s" },
        );
        await request("/auth/google/exchange", {
          method: "POST",
          body: { token: identity, state },
          status: 400,
        });
        await request("/auth/google/exchange", {
          method: "POST",
          cookie: "taskflow_oauth_state=" + state,
          body: { token: identity + "bad", state },
          status: 401,
        });
        const login = (
          await request("/auth/google/exchange", {
            method: "POST",
            cookie: "taskflow_oauth_state=" + state,
            body: { token: identity, state },
          })
        ).data.session;
        assert.equal(login.user.id, owner);
        assert.equal(login.user.hasPassword, true);
        assert.equal(
          (await request("/auth/me", { token: login.access_token })).data
            .profile.role,
          "premium",
        );
        assert.equal(
          (await request("/todos", { token: login.access_token })).data.todos
            .length,
          10,
        );
      },
    );
    await t.test(
      "password changes and logout revoke previously issued sessions",
      async () => {
        await request("/auth/password", {
          method: "PUT",
          token,
          body: { password: "new-password", currentPassword: "wrong" },
          status: 401,
        });
        const result = await request("/auth/password", {
          method: "PUT",
          token,
          body: { password: "new-password", currentPassword: password },
        });
        await request("/todos", { token, status: 401 });
        token = result.data.session.access_token;
        await request("/auth/logout", { method: "POST", token, body: {} });
        await request("/todos", { token, status: 401 });
        await request("/auth/login", {
          method: "POST",
          body: { email: "owner@example.test", password: "new-password" },
        });
      },
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = originalFetch;
    db.close();
  }
});
