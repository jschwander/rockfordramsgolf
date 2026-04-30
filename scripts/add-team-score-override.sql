-- Add manual override flag for team_score on rounds.
-- Run in Supabase → SQL Editor.

ALTER TABLE rounds
ADD COLUMN IF NOT EXISTS team_score_override boolean NOT NULL DEFAULT false;

-- Optional: backfill existing rows explicitly (should already be false via default)
-- UPDATE rounds SET team_score_override = false WHERE team_score_override IS NULL;

