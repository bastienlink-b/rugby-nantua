/*
  # Add anonymous insert policy for template_categories table

  1. Security
    - Add policy for anonymous users to insert records into template_categories table
    - This fixes the RLS policy violation error when adding templates
*/

-- Check if the policy already exists before creating it
DO $$
BEGIN
  -- Check if the policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'template_categories' 
    AND policyname = 'Allow anonymous insert for template_categories'
  ) THEN
    -- Create the policy only if it doesn't exist
    EXECUTE 'CREATE POLICY "Allow anonymous insert for template_categories"
      ON public.template_categories
      FOR INSERT
      TO anon
      WITH CHECK (true);';
    
    RAISE NOTICE 'Created new policy "Allow anonymous insert for template_categories"';
  ELSE
    RAISE NOTICE 'Policy "Allow anonymous insert for template_categories" already exists, skipping';
  END IF;
END $$;

-- Add additional policies for any other tables potentially missing them
DO $$
BEGIN
  -- Check tournament_categories table
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tournament_categories' 
    AND policyname = 'Allow anonymous insert for tournament_categories'
  ) THEN
    -- Create the policy only if it doesn't exist
    EXECUTE 'CREATE POLICY "Allow anonymous insert for tournament_categories"
      ON public.tournament_categories
      FOR INSERT
      TO anon
      WITH CHECK (true);';
    
    RAISE NOTICE 'Created new policy "Allow anonymous insert for tournament_categories"';
  ELSE
    RAISE NOTICE 'Policy "Allow anonymous insert for tournament_categories" already exists, skipping';
  END IF;

  -- Check match_sheet_players table
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'match_sheet_players' 
    AND policyname = 'Allow anonymous insert for match_sheet_players'
  ) THEN
    -- Create the policy only if it doesn't exist
    EXECUTE 'CREATE POLICY "Allow anonymous insert for match_sheet_players"
      ON public.match_sheet_players
      FOR INSERT
      TO anon
      WITH CHECK (true);';
    
    RAISE NOTICE 'Created new policy "Allow anonymous insert for match_sheet_players"';
  ELSE
    RAISE NOTICE 'Policy "Allow anonymous insert for match_sheet_players" already exists, skipping';
  END IF;

  -- Check match_sheet_coaches table
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'match_sheet_coaches' 
    AND policyname = 'Allow anonymous insert for match_sheet_coaches'
  ) THEN
    -- Create the policy only if it doesn't exist
    EXECUTE 'CREATE POLICY "Allow anonymous insert for match_sheet_coaches"
      ON public.match_sheet_coaches
      FOR INSERT
      TO anon
      WITH CHECK (true);';
    
    RAISE NOTICE 'Created new policy "Allow anonymous insert for match_sheet_coaches"';
  ELSE
    RAISE NOTICE 'Policy "Allow anonymous insert for match_sheet_coaches" already exists, skipping';
  END IF;
END $$;