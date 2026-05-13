-- ScoutX relational schema (PostgreSQL) in 3rd normal form (3NF).
-- Focus:
-- - team accounts and authentication
-- - planning and assignments
-- - observations, reports, highlights, follow-ups
-- - travel expense tracking and approval
-- - auditable ownership ("who created what")

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_role') THEN
    CREATE TYPE account_role AS ENUM ('admin', 'coordinator', 'scout', 'readonly');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'observation_status') THEN
    CREATE TYPE observation_status AS ENUM ('planned', 'seen');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
    CREATE TYPE assignment_status AS ENUM ('planned', 'confirmed', 'cancelled', 'done');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'expense_status') THEN
    CREATE TYPE expense_status AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'paid');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key TEXT UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  login_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role account_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, login_name)
);

CREATE TABLE IF NOT EXISTS account_credentials (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address INET
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_account_id ON auth_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name),
  UNIQUE (external_source, external_id)
);

CREATE TABLE IF NOT EXISTS age_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  external_source TEXT,
  external_id TEXT,
  UNIQUE (organization_id, name),
  UNIQUE (external_source, external_id)
);

CREATE TABLE IF NOT EXISTS football_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE RESTRICT,
  age_group_id UUID REFERENCES age_groups(id) ON DELETE RESTRICT,
  display_name TEXT NOT NULL,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, display_name),
  UNIQUE (external_source, external_id)
);

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  street TEXT,
  postal_code TEXT,
  city TEXT,
  country_code CHAR(2),
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  UNIQUE (organization_id, name, city)
);

CREATE TABLE IF NOT EXISTS seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  label TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  CHECK (starts_on <= ends_on),
  UNIQUE (organization_id, label)
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('official', 'manual')),
  source_ref TEXT,
  season_id UUID REFERENCES seasons(id) ON DELETE RESTRICT,
  league_id UUID REFERENCES leagues(id) ON DELETE RESTRICT,
  age_group_id UUID REFERENCES age_groups(id) ON DELETE RESTRICT,
  home_team_id UUID REFERENCES football_teams(id) ON DELETE RESTRICT,
  away_team_id UUID REFERENCES football_teams(id) ON DELETE RESTRICT,
  venue_id UUID REFERENCES venues(id) ON DELETE RESTRICT,
  kick_off_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'cancelled', 'played')),
  created_by_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  updated_by_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_ref)
);
CREATE INDEX IF NOT EXISTS idx_games_org_kickoff ON games(organization_id, kick_off_at);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

CREATE TABLE IF NOT EXISTS scouting_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  plan_date DATE NOT NULL,
  title TEXT NOT NULL,
  created_by_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scouting_plans_org_date ON scouting_plans(organization_id, plan_date);

CREATE TABLE IF NOT EXISTS plan_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES scouting_plans(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  scout_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  status assignment_status NOT NULL DEFAULT 'planned',
  assigned_by_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  UNIQUE (plan_id, game_id, scout_account_id)
);
CREATE INDEX IF NOT EXISTS idx_plan_assignments_scout ON plan_assignments(scout_account_id, status);
CREATE INDEX IF NOT EXISTS idx_plan_assignments_game ON plan_assignments(game_id);

CREATE TABLE IF NOT EXISTS observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL UNIQUE REFERENCES plan_assignments(id) ON DELETE CASCADE,
  status observation_status NOT NULL DEFAULT 'planned',
  seen_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  updated_by_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_observations_status ON observations(status);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  observation_id UUID NOT NULL UNIQUE REFERENCES observations(id) ON DELETE CASCADE,
  author_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  status report_status NOT NULL DEFAULT 'draft',
  summary TEXT NOT NULL DEFAULT '',
  strengths TEXT NOT NULL DEFAULT '',
  risks TEXT NOT NULL DEFAULT '',
  next_actions TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_author ON reports(author_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  external_source TEXT,
  external_id TEXT,
  display_name TEXT NOT NULL,
  birth_date DATE,
  dominant_foot TEXT,
  UNIQUE (external_source, external_id)
);

CREATE TABLE IF NOT EXISTS report_player_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  highlight_kind TEXT NOT NULL DEFAULT 'watchlist',
  rating_overall SMALLINT CHECK (rating_overall BETWEEN 1 AND 10),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, player_id, highlight_kind)
);

CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  source_observation_id UUID REFERENCES observations(id) ON DELETE SET NULL,
  source_report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  due_at TIMESTAMPTZ,
  assignee_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  created_by_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_follow_up_assignee_status ON follow_up_tasks(assignee_account_id, status);

CREATE TABLE IF NOT EXISTS team_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('favorite_team', 'favorite_club', 'league_priority', 'age_group')),
  club_id UUID REFERENCES clubs(id) ON DELETE RESTRICT,
  football_team_id UUID REFERENCES football_teams(id) ON DELETE RESTRICT,
  league_id UUID REFERENCES leagues(id) ON DELETE RESTRICT,
  age_group_id UUID REFERENCES age_groups(id) ON DELETE RESTRICT,
  priority SMALLINT NOT NULL DEFAULT 100,
  created_by_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (goal_type = 'favorite_club' AND club_id IS NOT NULL AND football_team_id IS NULL AND league_id IS NULL AND age_group_id IS NULL) OR
    (goal_type = 'favorite_team' AND football_team_id IS NOT NULL AND club_id IS NULL AND league_id IS NULL AND age_group_id IS NULL) OR
    (goal_type = 'league_priority' AND league_id IS NOT NULL AND club_id IS NULL AND football_team_id IS NULL AND age_group_id IS NULL) OR
    (goal_type = 'age_group' AND age_group_id IS NOT NULL AND club_id IS NULL AND football_team_id IS NULL AND league_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  recipient_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('direct_assignment', 'own_game_changed', 'game_cancelled', 'schedule_conflict', 'target_report_created')),
  entity_table TEXT,
  entity_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON notifications(recipient_account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS travel_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES plan_assignments(id) ON DELETE SET NULL,
  expense_date DATE NOT NULL,
  distance_km NUMERIC(8,2) NOT NULL CHECK (distance_km >= 0),
  rate_per_km NUMERIC(8,4) NOT NULL CHECK (rate_per_km >= 0),
  amount_total NUMERIC(10,2) GENERATED ALWAYS AS (round(distance_km * rate_per_km, 2)) STORED,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  status expense_status NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by_account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  paid_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_account_date ON travel_expenses(account_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_travel_expenses_status ON travel_expenses(status);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON audit_log(target_table, target_id);

CREATE TABLE IF NOT EXISTS team_state_events (
  id BIGSERIAL PRIMARY KEY,
  archived_at TIMESTAMPTZ NOT NULL,
  organization_external_key TEXT,
  reason TEXT NOT NULL,
  team_state_version INTEGER NOT NULL,
  team_state_json JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_team_state_events_archived_at ON team_state_events(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_state_events_org ON team_state_events(organization_external_key, archived_at DESC);
