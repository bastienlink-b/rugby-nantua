/*
  # Fix templates anonymous insert policy

  This migration checks if the anonymous insert policy already exists for templates
  table before attempting to create it. This prevents the "policy already exists" error.
*/

DO $$
BEGIN
  -- Check if the policy already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'templates' 
    AND policyname = 'Allow anonymous insert for templates'
  ) THEN
    -- Create the policy only if it doesn't exist
    EXECUTE 'CREATE POLICY "Allow anonymous insert for templates"
      ON public.templates
      FOR INSERT
      TO anon
      WITH CHECK (true);';
  END IF;
END $$;