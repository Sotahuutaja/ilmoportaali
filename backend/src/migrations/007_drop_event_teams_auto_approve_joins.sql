-- Migration: Drop the now-orphaned event_teams.auto_approve_joins column
-- Whether registering under a team at an event auto-approves the registrant as a team
-- member is now decided by the team's own auto_approve_joins setting (teams table, set by
-- the team's captain -- the same flag used for direct join requests), not by a per-event
-- override. This per-event-team column has had nothing reading or writing it since that
-- change, so it's safe to drop. (migrate.js previously kept re-adding this column on every
-- boot via an unconditional ADD COLUMN IF NOT EXISTS -- that line has been removed too, so
-- this drop actually sticks instead of being silently undone on the next deploy.)

ALTER TABLE event_teams DROP COLUMN IF EXISTS auto_approve_joins;
