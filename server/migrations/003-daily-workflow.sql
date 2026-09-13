-- Small additive v0.3 change; existing values and event history remain untouched.
ALTER TABLE tasks ALTER COLUMN subject_id DROP NOT NULL;
ALTER TABLE tasks ALTER COLUMN estimated DROP NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='task_topic_requires_subject') THEN
  ALTER TABLE tasks ADD CONSTRAINT task_topic_requires_subject CHECK(topic_id IS NULL OR subject_id IS NOT NULL);
 END IF;
END $$;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS remind_at_start boolean NOT NULL DEFAULT false;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','fixed'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority_date date;
CREATE OR REPLACE FUNCTION sync_fixed_reminder() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.level='FIXED' AND NEW.remind_at_start THEN
  IF (NEW.level,NEW.on_date,NEW.fixed_time,NEW.remind_at_start) IS DISTINCT FROM (OLD.level,OLD.on_date,OLD.fixed_time,OLD.remind_at_start) THEN
   DELETE FROM reminders WHERE task_id=NEW.task_id;
   INSERT INTO reminders(task_id,due_at,source) VALUES(NEW.task_id,(NEW.on_date::text || 'T' || NEW.fixed_time || ':00+08:00')::timestamptz,'fixed');
  END IF;
 ELSE
  DELETE FROM reminders WHERE task_id=NEW.task_id AND source='fixed';
 END IF;
 IF NEW.remind_at_start IS DISTINCT FROM OLD.remind_at_start THEN
  UPDATE tasks SET updated_at=clock_timestamp() WHERE id=NEW.task_id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fixed_reminder ON plans;
CREATE TRIGGER fixed_reminder AFTER UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION sync_fixed_reminder();
