/*
  # Create Story Creation Tables

  1. New Tables
    - `child_profiles`
      - `id` (uuid, primary key)
      - `name` (text) - child's first name
      - `age` (integer) - child's age
      - `interests` (text[]) - list of interests/hobbies
      - `favorite_things` (text) - favorite color, animal, etc.
      - `themes_to_avoid` (text) - themes parent wants excluded
      - `reading_level` (text) - beginner, intermediate, advanced
      - `photo_urls` (text[]) - URLs to uploaded photos in storage
      - `session_id` (text) - anonymous session identifier for demo
      - `user_id` (uuid, nullable) - optional link to auth user
      - `created_at` (timestamptz)

    - `stories`
      - `id` (uuid, primary key)
      - `child_profile_id` (uuid, foreign key)
      - `title` (text) - generated story title
      - `theme` (text) - selected theme (dinosaurs, space, ocean, etc.)
      - `illustration_style` (text) - watercolor, cartoon, etc.
      - `status` (text) - pending, generating, complete, failed
      - `page_count` (integer, default 0)
      - `created_at` (timestamptz)

    - `story_pages`
      - `id` (uuid, primary key)
      - `story_id` (uuid, foreign key)
      - `page_number` (integer)
      - `text_content` (text) - narrative text for this page
      - `illustration_url` (text) - URL to generated illustration
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Policies allow access by session_id for anonymous demo users
    - Policies allow access by user_id for authenticated users
*/

-- Create child_profiles table
CREATE TABLE IF NOT EXISTS child_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  age integer NOT NULL DEFAULT 5,
  interests text[] NOT NULL DEFAULT '{}',
  favorite_things text NOT NULL DEFAULT '',
  themes_to_avoid text NOT NULL DEFAULT '',
  reading_level text NOT NULL DEFAULT 'beginner',
  photo_urls text[] NOT NULL DEFAULT '{}',
  session_id text NOT NULL DEFAULT '',
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE child_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone with a matching session_id to read their own profiles
CREATE POLICY "Users can read own profiles by session"
  ON child_profiles FOR SELECT
  TO anon, authenticated
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id));

-- Allow insert for anyone (demo mode)
CREATE POLICY "Anyone can create a child profile"
  ON child_profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow update by session owner
CREATE POLICY "Users can update own profiles by session"
  ON child_profiles FOR UPDATE
  TO anon, authenticated
  USING (session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id))
  WITH CHECK (session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id));

-- Create stories table
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id),
  title text NOT NULL DEFAULT '',
  theme text NOT NULL DEFAULT '',
  illustration_style text NOT NULL DEFAULT 'watercolor',
  status text NOT NULL DEFAULT 'pending',
  page_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own stories"
  ON stories FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = stories.child_profile_id
      AND (cp.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = cp.user_id))
    )
  );

CREATE POLICY "Anyone can create a story"
  ON stories FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = child_profile_id
      AND (cp.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = cp.user_id))
    )
  );

CREATE POLICY "Users can update own stories"
  ON stories FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = stories.child_profile_id
      AND (cp.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = cp.user_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = stories.child_profile_id
      AND (cp.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = cp.user_id))
    )
  );

-- Create story_pages table
CREATE TABLE IF NOT EXISTS story_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id),
  page_number integer NOT NULL DEFAULT 1,
  text_content text NOT NULL DEFAULT '',
  illustration_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE story_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own story pages"
  ON story_pages FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories s
      JOIN child_profiles cp ON cp.id = s.child_profile_id
      WHERE s.id = story_pages.story_id
      AND (cp.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = cp.user_id))
    )
  );

CREATE POLICY "Anyone can insert story pages"
  ON story_pages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories s
      JOIN child_profiles cp ON cp.id = s.child_profile_id
      WHERE s.id = story_id
      AND (cp.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = cp.user_id))
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_child_profiles_session_id ON child_profiles(session_id);
CREATE INDEX IF NOT EXISTS idx_child_profiles_user_id ON child_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_child_profile_id ON stories(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
CREATE INDEX IF NOT EXISTS idx_story_pages_story_id ON story_pages(story_id);
CREATE INDEX IF NOT EXISTS idx_story_pages_page_number ON story_pages(story_id, page_number);
