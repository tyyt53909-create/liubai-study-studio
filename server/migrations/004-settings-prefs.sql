ALTER TABLE settings ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'zh-Hant';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='settings_locale_check') THEN
    ALTER TABLE settings ADD CONSTRAINT settings_locale_check CHECK (locale IN ('zh-Hant','en'));
  END IF;
END $$;
