/*
  # Add template analysis fields

  1. Changes
    - Add new columns to templates table for PDF analysis
    - Add indexes and constraints for file validation
    - Add column comments for documentation

  2. Validation
    - File size limit of 5MB
    - Only PDF files allowed
    - Hash-based change detection
*/

-- Add new columns to templates table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'field_mappings') THEN
    ALTER TABLE templates ADD COLUMN field_mappings jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'file_hash') THEN
    ALTER TABLE templates ADD COLUMN file_hash text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'file_size') THEN
    ALTER TABLE templates ADD COLUMN file_size bigint;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'mime_type') THEN
    ALTER TABLE templates ADD COLUMN mime_type text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'analyzed_at') THEN
    ALTER TABLE templates ADD COLUMN analyzed_at timestamptz;
  END IF;
END $$;

-- Create index on file_hash if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_templates_file_hash') THEN
    CREATE INDEX idx_templates_file_hash ON templates(file_hash);
  END IF;
END $$;

-- Add constraints if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'templates_mime_type_check') THEN
    ALTER TABLE templates ADD CONSTRAINT templates_mime_type_check CHECK (mime_type = 'application/pdf');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'templates_file_size_check') THEN
    ALTER TABLE templates ADD CONSTRAINT templates_file_size_check CHECK (file_size <= 5242880);
  END IF;
END $$;

-- Add column comments
COMMENT ON COLUMN templates.field_mappings IS 'JSON structure containing PDF field mappings and analysis results';
COMMENT ON COLUMN templates.file_hash IS 'SHA-256 hash of the PDF file for change detection';
COMMENT ON COLUMN templates.file_size IS 'Size of the PDF file in bytes';
COMMENT ON COLUMN templates.mime_type IS 'MIME type of the file (must be application/pdf)';
COMMENT ON COLUMN templates.analyzed_at IS 'Timestamp when the PDF structure was last analyzed';