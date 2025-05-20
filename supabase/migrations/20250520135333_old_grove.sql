/*
  # Add PDF URL column to match_sheets

  1. Changes
    - Add `pdf_url` column to `match_sheets` table to store the path to the generated PDF file

  This migration adds a new column to store the URL/path of the generated PDF file associated with each match sheet.
  This allows the application to reference and retrieve previously generated PDFs without having to regenerate them.
*/

-- Add the pdf_url column to match_sheets if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'match_sheets' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE match_sheets ADD COLUMN pdf_url text;
    COMMENT ON COLUMN match_sheets.pdf_url IS 'URL/path to the generated PDF file';
  END IF;
END $$;