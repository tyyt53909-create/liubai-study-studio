import { Router } from "express";
import { pool } from "../db.ts";
import { id } from "../services/common.ts";
import { snapshot } from "../services/snapshot.ts";
const app = Router();
app.get("/api/state", async (req, res) => {
  const selected = req.query.taskId ? id.parse(req.query.taskId) : undefined;
  const c = await pool.connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data = await snapshot(c, selected);
    await c.query("COMMIT");
    res.json(data);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
export default app;
