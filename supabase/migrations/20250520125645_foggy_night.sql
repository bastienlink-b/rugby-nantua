/*
  # Fix Row Level Security policies for tournaments table
  
  1. Security
    - Add RLS policy allowing anonymous users to insert records in tournaments table
    - Add similar policy for tournament_categories table
    - Make the migration idempotent by checking if policies already exist
*/

-- Check if the policy already exists before creating it
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
END $$;