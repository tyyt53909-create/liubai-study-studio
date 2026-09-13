import webpush from "web-push";
import { pool, tx } from "../db.ts";
export async function claimReminders(recipient: string, allowUnassigned = true) {
  return tx(async (c) => {
    // A single sticky recipient owns retries, including after a process restart.
    // Browser and Push cannot both take the same reminder.
    const rows = (
      await c.query(
        `SELECT r.id FROM reminders r JOIN tasks t ON t.id=r.task_id
   WHERE r.due_at<=now() AND r.status<>'delivered' AND t.status NOT IN ('COMPLETED','CANCELLED')
   AND (r.recipient=$1 OR ($2 AND r.recipient IS NULL))
   AND (r.claimed_at IS NULL OR r.claimed_at<now()-interval '30 seconds')
   ORDER BY r.due_at LIMIT 20 FOR UPDATE OF r SKIP LOCKED`,
        [recipient, allowUnassigned],
      )
    ).rows;
    const result = [];
    for (const { id } of rows) {
      result.push(
        (
          await c.query(
            `UPDATE reminders SET status='sending',recipient=$2,claim_token=COALESCE(claim_token,gen_random_uuid()),claimed_at=now(),attempts=attempts+1,error=NULL WHERE id=$1 RETURNING *`,
            [id, recipient],
          )
        ).rows[0],
      );
    }
    return result;
  });
}
export async function validateDelivery(id: string, token: string) {
  return (
    await pool.query(
      `SELECT r.id,r.task_id,r.claim_token,r.status,t.title FROM reminders r JOIN tasks t ON t.id=r.task_id WHERE r.id=$1 AND r.claim_token=$2 AND r.due_at<=now() AND r.status IN ('sending','error','delivered') AND t.status NOT IN ('COMPLETED','CANCELLED')`,
      [id, token],
    )
  ).rows[0];
}
export async function acknowledge(id: string, token: string) {
  return pool.query(
    `UPDATE reminders SET status='delivered',delivered_at=COALESCE(delivered_at,now()),error=NULL WHERE id=$1 AND claim_token=$2 AND status IN ('sending','error','delivered')`,
    [id, token],
  );
}
export async function pushTick(send = webpush.sendNotification) {
  const subscriptions = (
    await pool.query("SELECT * FROM push_subscriptions ORDER BY id")
  ).rows;
  if (!subscriptions.length) return;
  // One destination per reminder. Keep retrying its chosen destination, not every subscription.
  for (const sub of subscriptions) {
    for (const r of await claimReminders("push:" + sub.id)) {
      if (!(await validateDelivery(r.id, r.claim_token))) continue;
      try {
        await send(
          sub.subscription,
          JSON.stringify({
            id: r.id,
            taskId: r.task_id,
            claimToken: r.claim_token,
          }),
          { TTL: 3600 },
        );
        await pool.query(
          "UPDATE reminders SET accepted_at=now() WHERE id=$1 AND claim_token=$2",
          [r.id, r.claim_token],
        );
      } catch (error) {
        const gone = [404, 410].includes(
          (error as { statusCode?: number }).statusCode || 0,
        );
        if (gone)
          await pool.query("DELETE FROM push_subscriptions WHERE id=$1", [
            sub.id,
          ]);
        await pool.query(
          `UPDATE reminders SET status='error',error=$2,recipient=CASE WHEN $3 THEN NULL ELSE recipient END,claim_token=CASE WHEN $3 THEN NULL ELSE claim_token END WHERE id=$1`,
          [
            r.id,
            gone ? "推送訂閱失效，等待可用裝置" : "推送暫時失敗，稍後重試",
            gone,
          ],
        );
      }
    }
  }
}
