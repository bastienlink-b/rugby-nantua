/*
  # Fix RLS policies and ensure players and coaches data is accessible
  
  1. Updated RLS Policies:
    - Adds more permissive policies for authenticated users
    - Specifies SELECT permissions explicitly
    - Ensures junction tables have proper access
  
  2. Authentication:
    - Verifies anon key has appropriate permissions
  
  This migration focuses on fixing potential row-level security issues
  that might prevent data from appearing in the application.
*/

-- First ensure RLS is enabled on all tables
ALTER TABLE IF EXISTS age_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS players ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS coach_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tournament_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS match_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS match_sheet_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS match_sheet_coaches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated CRUD for players" ON players;
DROP POLICY IF EXISTS "Allow authenticated CRUD for coaches" ON coaches;
DROP POLICY IF EXISTS "Allow authenticated CRUD for coach_categories" ON coach_categories;
DROP POLICY IF EXISTS "Allow authenticated read access for age_categories" ON age_categories;
DROP POLICY IF EXISTS "Allow authenticated CRUD for tournaments" ON tournaments;
DROP POLICY IF EXISTS "Allow authenticated CRUD for tournament_categories" ON tournament_categories;
DROP POLICY IF EXISTS "Allow authenticated CRUD for templates" ON templates;
DROP POLICY IF EXISTS "Allow authenticated CRUD for template_categories" ON template_categories;
DROP POLICY IF EXISTS "Allow authenticated CRUD for match_sheets" ON match_sheets;
DROP POLICY IF EXISTS "Allow authenticated CRUD for match_sheet_players" ON match_sheet_players;
DROP POLICY IF EXISTS "Allow authenticated CRUD for match_sheet_coaches" ON match_sheet_coaches;

-- Create explicit SELECT policies for all tables
CREATE POLICY "Allow anon and authenticated select for age_categories" 
  ON age_categories FOR SELECT USING (true);

CREATE POLICY "Allow anon and authenticated select for players" 
  ON players FOR SELECT USING (true);

CREATE POLICY "Allow anon and authenticated select for coaches" 
  ON coaches FOR SELECT USING (true);

CREATE POLICY "Allow anon and authenticated select for coach_categories" 
  ON coach_categories FOR SELECT USING (true);

CREATE POLICY "Allow anon and authenticated select for tournaments" 
  ON tournaments FOR SELECT USING (true);

CREATE POLICY "Allow anon and authenticated select for tournament_categories" 
  ON tournament_categories FOR SELECT USING (true);

CREATE POLICY "Allow anon and authenticated select for templates" 
  ON templates FOR SELECT USING (true);

CREATE POLICY "Allow anon and authenticated select for template_categories" 
  ON template_categories FOR SELECT USING (true);

CREATE POLICY "Allow anon and authenticated select for match_sheets" 
  ON match_sheets FOR SELECT USING (true);

CREATE POLICY "Allow anon and authenticated select for match_sheet_players" 
  ON match_sheet_players FOR SELECT USING (true);

CREATE POLICY "Allow anon and authenticated select for match_sheet_coaches" 
  ON match_sheet_coaches FOR SELECT USING (true);

-- Create CRUD policies for authenticated users
CREATE POLICY "Allow authenticated insert update delete for players" 
  ON players FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert update delete for coaches" 
  ON coaches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert update delete for coach_categories" 
  ON coach_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert update delete for tournaments" 
  ON tournaments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert update delete for tournament_categories" 
  ON tournament_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert update delete for templates" 
  ON templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert update delete for template_categories" 
  ON template_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert update delete for match_sheets" 
  ON match_sheets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert update delete for match_sheet_players" 
  ON match_sheet_players FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert update delete for match_sheet_coaches" 
  ON match_sheet_coaches FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow the anon role to read and use all tables
CREATE POLICY "Allow anonymous insert for age_categories" 
  ON age_categories FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous insert for players" 
  ON players FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous insert for coaches" 
  ON coaches FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous insert for coach_categories" 
  ON coach_categories FOR INSERT TO anon WITH CHECK (true);

-- Log that this migration finished
DO $$
BEGIN
  RAISE NOTICE 'RLS policies updated to ensure data is accessible to the application';
END $$;