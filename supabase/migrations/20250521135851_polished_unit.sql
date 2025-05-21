/*
  # Allow Word documents in templates table

  1. Changes
    - Modify mime_type constraint to allow both PDF and Word documents
    - Update file size limit to 10MB to accommodate larger Word files
    - Add comments explaining supported formats

  2. Security
    - Maintain existing RLS policies
    - Keep file size limits for security
*/

-- Drop existing mime_type constraint
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_mime_type_check;

-- Add new mime_type constraint that allows both PDF and Word documents
ALTER TABLE templates 
  ADD CONSTRAINT templates_mime_type_check 
  CHECK (mime_type IN ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));

-- Update file size limit to 10MB
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_file_size_check;
ALTER TABLE templates 
  ADD CONSTRAINT templates_file_size_check 
  CHECK (file_size <= 10485760); -- 10MB in bytes

-- Update column comments
COMMENT ON COLUMN templates.mime_type IS 'MIME type of the file (must be PDF or DOCX)';
COMMENT ON COLUMN templates.file_size IS 'Size of the file in bytes (max 10MB)';