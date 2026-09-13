ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE tasks ALTER COLUMN updated_at SET DEFAULT now();
CREATE TABLE IF NOT EXISTS task_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid NOT NULL REFERENCES tasks,
 kind text NOT NULL CHECK(kind IN ('CREATED','PLAN_CHANGED','SESSION_STARTED','SESSION_PAUSED','SESSION_RESUMED','SESSION_STOPPED','COMPLETED','CANCELLED')),
 occurred_at timestamptz NOT NULL DEFAULT now(),session_id uuid REFERENCES sessions,
 before_plan jsonb,after_plan jsonb
);
CREATE INDEX IF NOT EXISTS events_timeline ON task_events(task_id,occurred_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS events_history ON task_events(occurred_at DESC,id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS events_once ON task_events(task_id,kind) WHERE kind IN ('CREATED','COMPLETED','CANCELLED');
CREATE INDEX IF NOT EXISTS tasks_completion ON tasks(completed_at,subject_id) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS sessions_task ON sessions(task_id);
CREATE INDEX IF NOT EXISTS intervals_session ON intervals(session_id);
CREATE INDEX IF NOT EXISTS intervals_today ON intervals(end_at,start_at);
CREATE INDEX IF NOT EXISTS reviews_recent ON reviews(subject_id,topic_id,reviewed_at DESC);
CREATE INDEX IF NOT EXISTS reviews_history ON reviews(reviewed_at DESC,id DESC);
CREATE OR REPLACE FUNCTION task_audit_time() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW IS DISTINCT FROM OLD THEN NEW.updated_at=clock_timestamp(); END IF;
 IF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NEW.status='COMPLETED' THEN NEW.completed_at=clock_timestamp(); END IF;
  IF NEW.status='CANCELLED' THEN NEW.cancelled_at=clock_timestamp(); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION task_audit_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN INSERT INTO task_events(task_id,kind,occurred_at) VALUES(NEW.id,'CREATED',NEW.created_at);
 ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('COMPLETED','CANCELLED') THEN
  INSERT INTO task_events(task_id,kind,occurred_at) VALUES(NEW.id,NEW.status,COALESCE(NEW.completed_at,NEW.cancelled_at));
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION plan_audit_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.level,NEW.on_date,NEW.fixed_time) IS DISTINCT FROM (OLD.level,OLD.on_date,OLD.fixed_time) THEN
 INSERT INTO task_events(task_id,kind,before_plan,after_plan) VALUES(NEW.task_id,'PLAN_CHANGED',to_jsonb(OLD)-'task_id',to_jsonb(NEW)-'task_id');
 UPDATE tasks SET updated_at=clock_timestamp() WHERE id=NEW.task_id;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION session_audit_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_kind text;
BEGIN
 IF TG_OP='INSERT' THEN event_kind='SESSION_STARTED';
 ELSIF OLD.state=NEW.state THEN RETURN NEW;
 ELSIF NEW.state IN ('STOPPED','COMPLETED') THEN event_kind='SESSION_STOPPED';
 ELSIF NEW.state='PAUSED' THEN event_kind='SESSION_PAUSED';
 ELSE event_kind='SESSION_RESUMED'; END IF;
 INSERT INTO task_events(task_id,kind,session_id) VALUES(NEW.task_id,event_kind,NEW.id);
 UPDATE tasks SET updated_at=clock_timestamp() WHERE id=NEW.task_id;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION reject_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Task events are immutable'; END $$;
DROP TRIGGER IF EXISTS task_time ON tasks;
CREATE TRIGGER task_time BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION task_audit_time();
DROP TRIGGER IF EXISTS task_event ON tasks;
CREATE TRIGGER task_event AFTER INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION task_audit_event();
DROP TRIGGER IF EXISTS plan_event ON plans;
CREATE TRIGGER plan_event AFTER UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION plan_audit_event();
DROP TRIGGER IF EXISTS session_event ON sessions;
CREATE TRIGGER session_event AFTER INSERT OR UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION session_audit_event();
DROP TRIGGER IF EXISTS immutable_events ON task_events;
CREATE TRIGGER immutable_events BEFORE UPDATE OR DELETE ON task_events FOR EACH ROW EXECUTE FUNCTION reject_event_mutation();
CREATE OR REPLACE FUNCTION subtask_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW IS DISTINCT FROM OLD THEN UPDATE tasks SET updated_at=clock_timestamp() WHERE id=NEW.task_id; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS subtask_update ON subtasks;
CREATE TRIGGER subtask_update AFTER INSERT OR UPDATE ON subtasks FOR EACH ROW EXECUTE FUNCTION subtask_touch();
CREATE TABLE IF NOT EXISTS auth_sessions(token_hash text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS auth_attempts(id integer PRIMARY KEY CHECK(id=1),failures integer NOT NULL DEFAULT 0,blocked_until timestamptz);
INSERT INTO auth_attempts(id) VALUES(1) ON CONFLICT DO NOTHING;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','delivered','error'));
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS claim_token uuid;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS recipient text;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
UPDATE reminders SET status='delivered' WHERE delivered_at IS NOT NULL AND status='pending';
CREATE INDEX IF NOT EXISTS reminders_pending ON reminders(due_at) WHERE status<>'delivered';
