/*
  # Add anonymous insert policy for match sheets
  
  1. Security Changes
    - Adds RLS policy allowing anonymous users to insert records in match_sheets table
    - Ensures consistency with other tables' RLS policies
    
  2. Purpose
    - Fixes RLS policy violation error when creating new match sheets
    - Maintains security while allowing necessary operations
*/

-- Check if the policy already exists before creating it
DO $$
BEGIN
  -- Check if the policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'match_sheets' 
    AND policyname = 'Allow anonymous insert for match_sheets'
  ) THEN
    -- Create the policy only if it doesn't exist
    CREATE POLICY "Allow anonymous insert for match_sheets"
      ON public.match_sheets
      FOR INSERT
      TO anon
      WITH CHECK (true);
    
    RAISE NOTICE 'Created new policy "Allow anonymous insert for match_sheets"';
  ELSE
    RAISE NOTICE 'Policy "Allow anonymous insert for match_sheets" already exists, skipping';
  END IF;
END $$;