/*
  # Add anonymous insert policy for templates table

  1. Security
     - Add policy for anonymous users to insert into templates table
     - This aligns with the permissions model used in other tables like age_categories
     - Resolves the 401 error when trying to add templates as an anonymous user
*/

-- Add policy to allow anonymous users to insert into templates table
CREATE POLICY "Allow anonymous insert for templates"
  ON public.templates
  FOR INSERT
  TO anon
  WITH CHECK (true);