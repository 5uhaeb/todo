import "dotenv/config";
export async function query(sql, params = []) {
  const {
    DRIVEBASE_API_URL: url,
    DRIVEBASE_DATABASE_ID: id,
    DRIVEBASE_API_KEY: key,
  } = process.env;
  if (!url || !id || !key)
    throw new Error("Drivebase server configuration is missing");
  const response = await fetch(
    url.replace(/\/$/, "") + "/databases/" + encodeURIComponent(id) + "/query",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(90000),
    },
  );
  if (!response.ok)
    throw new Error("Database request failed (" + response.status + ")");
  const result = await response.json();
  return {
    rows: result.rows.map((values) =>
      Object.fromEntries(
        result.columns.map((column, i) => [column, values[i]]),
      ),
    ),
    changes: result.changes,
  };
}
export async function one(sql, params) {
  return (await query(sql, params)).rows[0] || null;
}
export const paymentDatabase = {
  from(table) {
    if (table !== "profiles") throw new Error("Unsupported payment table");
    return {
      update({ role }) {
        return {
          eq(column, id) {
            if (column !== "id" || role !== "premium")
              throw new Error("Invalid account update");
            return {
              select() {
                return {
                  async maybeSingle() {
                    try {
                      return {
                        data: await one(
                          "UPDATE profiles SET role='premium' WHERE id=? RETURNING id",
                          [id],
                        ),
                        error: null,
                      };
                    } catch {
                      return {
                        data: null,
                        error: new Error("Storage unavailable"),
                      };
                    }
                  },
                };
              },
            };
          },
        };
      },
    };
  },
};
