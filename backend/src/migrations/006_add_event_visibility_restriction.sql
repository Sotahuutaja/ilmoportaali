-- Lets an organizer hide an event's existence entirely from anyone outside its eligible
-- teams (event_teams), independent of whether individual (non-team) registration is also
-- allowed for the event — an event can have eligible teams configured purely as an optional
-- perk while still being open to everyone, so visibility needs its own explicit switch
-- rather than being inferred from event_teams alone.
-- Off by default: every existing event stays publicly listed exactly as before.
ALTER TABLE events ADD COLUMN IF NOT EXISTS restrict_visibility BOOLEAN NOT NULL DEFAULT FALSE;
