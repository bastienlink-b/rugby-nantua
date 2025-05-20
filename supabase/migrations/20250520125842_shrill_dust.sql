/*
  # Fix Tournament RLS Policies
  
  1. Security Updates
    - Add policies for anonymous users to insert into tournaments table
    - Add policies for anonymous users to insert into tournament_categories table
    - Ensure proper cascade behavior for tournament deletions
  
  2. Purpose
    - Allow tournament creation without authentication
    - Maintain data consistency with proper foreign key relationships
*/

-- Check if the policies already exist before creating them
DO $$
BEGIN
  -- Check tournaments table policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tournaments' 
    AND policyname = 'Allow anonymous insert for tournaments'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow anonymous insert for tournaments"
      ON public.tournaments
      FOR INSERT
      TO anon
      WITH CHECK (true);';
    
    RAISE NOTICE 'Created new policy "Allow anonymous insert for tournaments"';
  ELSE
    RAISE NOTICE 'Policy "Allow anonymous insert for tournaments" already exists, skipping';
  END IF;

  -- Check tournament_categories table policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tournament_categories' 
    AND policyname = 'Allow anonymous insert for tournament_categories'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow anonymous insert for tournament_categories"
      ON public.tournament_categories
      FOR INSERT
      TO anon
      WITH CHECK (true);';
    
    RAISE NOTICE 'Created new policy "Allow anonymous insert for tournament_categories"';
  ELSE
    RAISE NOTICE 'Policy "Allow anonymous insert for tournament_categories" already exists, skipping';
  END IF;

  -- Ensure RLS is enabled on both tables
  ALTER TABLE IF EXISTS tournaments ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS tournament_categories ENABLE ROW LEVEL SECURITY;

  -- Verify foreign key constraints
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tournament_categories_tournament_id_fkey'
  ) THEN
    ALTER TABLE tournament_categories
    ADD CONSTRAINT tournament_categories_tournament_id_fkey
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE;
    
    RAISE NOTICE 'Added missing foreign key constraint for tournament_categories';
  END IF;
END $$;