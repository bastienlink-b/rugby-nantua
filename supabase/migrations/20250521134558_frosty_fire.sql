/*
  # Add template analysis storage

  1. Changes
    - Add field_mappings column to templates table to store PDF field analysis
    - Add analyzed_at timestamp to track when analysis was performed
    - Add file metadata columns for validation and caching
    - Add constraints and indexes for performance and data integrity

  2. Security
    - Maintain existing RLS policies
    - Add validation constraints for file size and type
*/

-- Add new columns to templates table
ALTER TABLE templates 
  ADD COLUMN IF NOT EXISTS field_mappings jsonb,
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;

-- Create index on file_hash for faster lookups
CREATE INDEX IF NOT EXISTS idx_templates_file_hash ON templates(file_hash);

-- Add validation check for mime_type
ALTER TABLE templates 
  ADD CONSTRAINT templates_mime_type_check 
  CHECK (mime_type = 'application/pdf');

-- Add validation check for file_size (5MB limit)
ALTER TABLE templates 
  ADD CONSTRAINT templates_file_size_check 
  CHECK (file_size <= 5242880);

COMMENT ON COLUMN templates.field_mappings IS 'JSON structure containing PDF field mappings and analysis results';
COMMENT ON COLUMN templates.file_hash IS 'SHA-256 hash of the PDF file for change detection';
COMMENT ON COLUMN templates.file_size IS 'Size of the PDF file in bytes';
COMMENT ON COLUMN templates.mime_type IS 'MIME type of the file (must be application/pdf)';
COMMENT ON COLUMN templates.analyzed_at IS 'Timestamp when the PDF structure was last analyzed';