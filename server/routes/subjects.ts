import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.ts";
import { id, title } from "../services/common.ts";
const app = Router();
app.post("/api/subjects", async (req, res) => {
  const { name } = z.object({ name: title }).parse(req.body);
  res
    .status(201)
    .json(
      (
        await pool.query("INSERT INTO subjects(name) VALUES($1) RETURNING *", [
          name,
        ])
      ).rows[0],
    );
});
app.post("/api/topics", async (req, res) => {
  const b = z.object({ name: title, subject_id: id }).parse(req.body);
  res
    .status(201)
    .json(
      (
        await pool.query(
          "INSERT INTO topics(subject_id,name) VALUES($1,$2) RETURNING *",
          [b.subject_id, b.name],
        )
      ).rows[0],
    );
});

export default app;
