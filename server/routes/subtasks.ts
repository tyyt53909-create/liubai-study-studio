import { Router } from "express";
import { z } from "zod";
import { tx } from "../db.ts";
import { id, Problem, task, title } from "../services/common.ts";
const app = Router();
app.post("/api/tasks/:id/subtasks", async (req, res) => {
  const taskId = id.parse(req.params.id);
  const b = z.object({ title }).parse(req.body);
  await tx(async (c) => {
    const t = await task(c, taskId);
    if (["COMPLETED", "CANCELLED"].includes(t.status))
      throw new Problem("此任務已結束");
    await c.query("INSERT INTO subtasks(task_id,title) VALUES($1,$2)", [
      taskId,
      b.title,
    ]);
  });
  res.status(201).json({ ok: true });
});
app.patch("/api/subtasks/:id", async (req, res) => {
  const subId = id.parse(req.params.id);
  const { completed } = z.object({ completed: z.boolean() }).parse(req.body);
  await tx(async (c) => {
    const sub = (await c.query("SELECT * FROM subtasks WHERE id=$1", [subId]))
      .rows[0];
    if (!sub) throw new Problem("找不到子項", 404);
    const t = await task(c, sub.task_id);
    if (["COMPLETED", "CANCELLED"].includes(t.status))
      throw new Problem("此任務已結束");
    await c.query("UPDATE subtasks SET completed=$2 WHERE id=$1", [
      subId,
      completed,
    ]);
    if (completed && t.status === "TODO")
      await c.query("UPDATE tasks SET status='IN_PROGRESS' WHERE id=$1", [
        t.id,
      ]);
  });
  res.json({ ok: true });
});

export default app;
