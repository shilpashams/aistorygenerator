/*
  # Create story_evals table for AI quality scoring

  1. New Tables
    - `story_evals`
      - `id` (uuid, primary key)
      - `story_id` (uuid, foreign key to stories)
      - `used_fallback` (boolean) - whether the story fell back to hardcoded text
      - `generation_time_ms` (integer) - total generation duration in milliseconds
      - `openai_retries` (integer) - number of 429 retries needed
      - `fal_failures` (integer) - number of fal.ai page failures (fallback images used)
      - `reading_level_score` (numeric) - % of pages passing reading level validation (0-100)
      - `personalization_score` (numeric) - % of child inputs used in story (0-100)
      - `theme_contamination` (boolean) - whether cross-theme words were detected
      - `refrain_count` (integer) - number of times the refrain appears
      - `uniqueness_score` (numeric) - 0-100, lower means more similar to other stories
      - `page_count_valid` (boolean) - whether output had exactly 8 pages
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `story_evals` table
    - Allow anyone to read evals (dashboard is public/internal)
    - Only service role can insert (written by edge function)

  3. Indexes
    - story_id for joins
    - created_at for time-based queries
*/

CREATE TABLE IF NOT EXISTS story_evals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id),
  used_fallback boolean NOT NULL DEFAULT false,
  generation_time_ms integer NOT NULL DEFAULT 0,
  openai_retries integer NOT NULL DEFAULT 0,
  fal_failures integer NOT NULL DEFAULT 0,
  reading_level_score numeric NOT NULL DEFAULT 0,
  personalization_score numeric NOT NULL DEFAULT 0,
  theme_contamination boolean NOT NULL DEFAULT false,
  refrain_count integer NOT NULL DEFAULT 0,
  uniqueness_score numeric NOT NULL DEFAULT 100,
  page_count_valid boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE story_evals ENABLE ROW LEVEL SECURITY;

-- Dashboard is accessible to anyone (internal tool, no sensitive user data)
CREATE POLICY "Anyone can read story evals"
  ON story_evals FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service role can insert evals (from edge function)
CREATE POLICY "Service role can insert evals"
  ON story_evals FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_story_evals_story_id ON story_evals(story_id);
CREATE INDEX IF NOT EXISTS idx_story_evals_created_at ON story_evals(created_at);
CREATE INDEX IF NOT EXISTS idx_story_evals_used_fallback ON story_evals(used_fallback);
