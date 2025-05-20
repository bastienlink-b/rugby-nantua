/*
  # Fix match sheets RLS policies and related tables
  
  1. Security
    - Add policies for match sheets and related junction tables
    - Ensure proper access for both anonymous and authenticated users
    - Fix potential RLS policy violations
*/

-- Check and create policies for match sheets and related tables
DO $$
BEGIN
  -- Check match_sheets table policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'match_sheets' 
    AND policyname = 'Allow anonymous insert for match_sheets'
  ) THEN
    CREATE POLICY "Allow anonymous insert for match_sheets"
      ON public.match_sheets
      FOR INSERT
      TO anon
      WITH CHECK (true);
    
    RAISE NOTICE 'Created policy for match_sheets';
  END IF;

  -- Check match_sheet_players table policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'match_sheet_players' 
    AND policyname = 'Allow anonymous insert for match_sheet_players'
  ) THEN
    CREATE POLICY "Allow anonymous insert for match_sheet_players"
      ON public.match_sheet_players
      FOR INSERT
      TO anon
      WITH CHECK (true);
    
    RAISE NOTICE 'Created policy for match_sheet_players';
  END IF;

  -- Check match_sheet_coaches table policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'match_sheet_coaches' 
    AND policyname = 'Allow anonymous insert for match_sheet_coaches'
  ) THEN
    CREATE POLICY "Allow anonymous insert for match_sheet_coaches"
      ON public.match_sheet_coaches
      FOR INSERT
      TO anon
      WITH CHECK (true);
    
    RAISE NOTICE 'Created policy for match_sheet_coaches';
  END IF;

  -- Ensure RLS is enabled on all tables
  ALTER TABLE IF EXISTS match_sheets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS match_sheet_players ENABLE ROW LEVEL SECURITY;
  ALTER TABLE IF EXISTS match_sheet_coaches ENABLE ROW LEVEL SECURITY;

  -- Add SELECT policies if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'match_sheets' 
    AND policyname = 'Allow public select for match_sheets'
  ) THEN
    CREATE POLICY "Allow public select for match_sheets"
      ON public.match_sheets
      FOR SELECT
      TO public
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'match_sheet_players' 
    AND policyname = 'Allow public select for match_sheet_players'
  ) THEN
    CREATE POLICY "Allow public select for match_sheet_players"
      ON public.match_sheet_players
      FOR SELECT
      TO public
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'match_sheet_coaches' 
    AND policyname = 'Allow public select for match_sheet_coaches'
  ) THEN
    CREATE POLICY "Allow public select for match_sheet_coaches"
      ON public.match_sheet_coaches
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;