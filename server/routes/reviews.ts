import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.ts";
import { id, instant, minutes, Problem } from "../services/common.ts";
const app = Router();
app.post("/api/reviews", async (req, res) => {
  const b = z
    .object({
      subject_id: id,
      topic_id: id.nullable().default(null),
      reviewed_at: instant,
      duration: minutes.nullable().default(null),
      note: z.string().max(2000).default(""),
    })
    .parse(req.body);
  if (new Date(b.reviewed_at).getTime() > Date.now() + 60000)
    throw new Problem("複習紀錄不能設在未來");
  res
    .status(201)
    .json(
      (
        await pool.query(
          "INSERT INTO reviews(subject_id,topic_id,reviewed_at,duration,source,note) VALUES($1,$2,$3,$4,'MANUAL',$5) RETURNING *",
          [b.subject_id, b.topic_id, b.reviewed_at, b.duration, b.note],
        )
      ).rows[0],
    );
});

export default app;
