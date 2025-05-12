/*
  # Initial schema for Rugby Match application
  
  1. New Tables
    - `age_categories`: Stores different age groups (M6, M8, etc.)
    - `players`: Stores player information
    - `coaches`: Stores coach information
    - `tournaments`: Stores tournament details
    - `templates`: Stores PDF template information
    - `match_sheets`: Stores match sheet records
    - `coach_categories`: Junction table for coach-category relationships
    - `tournament_categories`: Junction table for tournament-category relationships
    - `template_categories`: Junction table for template-category relationships
  
  2. Security
    - Row Level Security enabled on all tables
    - Policies set up for authenticated users
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Age Categories Table
CREATE TABLE IF NOT EXISTS age_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players Table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  license_number TEXT NOT NULL UNIQUE,
  can_play_forward BOOLEAN DEFAULT FALSE,
  can_referee BOOLEAN DEFAULT FALSE,
  age_category_id uuid REFERENCES age_categories(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Coaches Table
CREATE TABLE IF NOT EXISTS coaches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  license_number TEXT,
  diploma TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for coaches and age categories (many-to-many)
CREATE TABLE IF NOT EXISTS coach_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_id uuid REFERENCES coaches(id) ON DELETE CASCADE,
  age_category_id uuid REFERENCES age_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, age_category_id)
);

-- Tournaments Table
CREATE TABLE IF NOT EXISTS tournaments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  location TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for tournaments and age categories (many-to-many)
CREATE TABLE IF NOT EXISTS tournament_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  age_category_id uuid REFERENCES age_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, age_category_id)
);

-- Templates Table
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  field_mappings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for templates and age categories (many-to-many)
CREATE TABLE IF NOT EXISTS template_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id uuid REFERENCES templates(id) ON DELETE CASCADE,
  age_category_id uuid REFERENCES age_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, age_category_id)
);

-- Match Sheets Table
CREATE TABLE IF NOT EXISTS match_sheets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE,
  template_id uuid REFERENCES templates(id),
  age_category_id uuid REFERENCES age_categories(id),
  referent_coach_id uuid REFERENCES coaches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for match sheets and players (many-to-many)
CREATE TABLE IF NOT EXISTS match_sheet_players (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_sheet_id uuid REFERENCES match_sheets(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_sheet_id, player_id)
);

-- Junction table for match sheets and coaches (many-to-many)
CREATE TABLE IF NOT EXISTS match_sheet_coaches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_sheet_id uuid REFERENCES match_sheets(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES coaches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_sheet_id, coach_id)
);

-- Enable Row Level Security on all tables
ALTER TABLE age_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_sheet_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_sheet_coaches ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users to access data
CREATE POLICY "Allow authenticated read access for age_categories" 
  ON age_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated CRUD for players" 
  ON players FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated CRUD for coaches" 
  ON coaches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated CRUD for coach_categories" 
  ON coach_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated CRUD for tournaments" 
  ON tournaments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated CRUD for tournament_categories" 
  ON tournament_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated CRUD for templates" 
  ON templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated CRUD for template_categories" 
  ON template_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated CRUD for match_sheets" 
  ON match_sheets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated CRUD for match_sheet_players" 
  ON match_sheet_players FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated CRUD for match_sheet_coaches" 
  ON match_sheet_coaches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for foreign keys to improve query performance
CREATE INDEX idx_players_age_category ON players(age_category_id);
CREATE INDEX idx_coach_categories_coach ON coach_categories(coach_id);
CREATE INDEX idx_coach_categories_category ON coach_categories(age_category_id);
CREATE INDEX idx_tournament_categories_tournament ON tournament_categories(tournament_id);
CREATE INDEX idx_tournament_categories_category ON tournament_categories(age_category_id);
CREATE INDEX idx_template_categories_template ON template_categories(template_id);
CREATE INDEX idx_template_categories_category ON template_categories(age_category_id);
CREATE INDEX idx_match_sheets_tournament ON match_sheets(tournament_id);
CREATE INDEX idx_match_sheets_template ON match_sheets(template_id);
CREATE INDEX idx_match_sheets_category ON match_sheets(age_category_id);
CREATE INDEX idx_match_sheets_coach ON match_sheets(referent_coach_id);
CREATE INDEX idx_match_sheet_players_sheet ON match_sheet_players(match_sheet_id);
CREATE INDEX idx_match_sheet_players_player ON match_sheet_players(player_id);
CREATE INDEX idx_match_sheet_coaches_sheet ON match_sheet_coaches(match_sheet_id);
CREATE INDEX idx_match_sheet_coaches_coach ON match_sheet_coaches(coach_id);

-- Insert default age categories
INSERT INTO age_categories (name, description) VALUES
  ('M6', 'Moins de 6 ans'),
  ('M8', 'Moins de 8 ans'),
  ('M10', 'Moins de 10 ans'),
  ('M12', 'Moins de 12 ans'),
  ('M14', 'Moins de 14 ans'),
  ('M16', 'Moins de 16 ans'),
  ('M19', 'Moins de 19 ans')
ON CONFLICT (id) DO NOTHING;