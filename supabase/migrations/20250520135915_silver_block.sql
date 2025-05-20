/*
  # Add PDF URL column to match_sheets table

  1. Changes
     - Add pdf_url column to match_sheets table to store the URL/path to the generated PDF file

  This migration safely adds the pdf_url column only if it doesn't already exist.
*/

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