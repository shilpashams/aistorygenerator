# Database Architecture Document
## AI Children's Storybook Application

**Version**: 1.0  
**Date**: 2026-05-21  
**Database**: PostgreSQL (Supabase-managed)  
**Migrations**: 2 applied

---

## Overview

The database serves a personalized storybook generation application. It stores child profiles, story metadata, and page content. Access is controlled through Row Level Security (RLS) using session-based identification for anonymous users with optional authenticated user support.

---

## Entity Relationship Diagram

```
+=====================+          +=====================+          +=====================+
|   child_profiles    |          |       stories       |          |     story_pages     |
+=====================+          +=====================+          +=====================+
| id          uuid PK |<---+    | id          uuid PK |<---+    | id          uuid PK |
| name        text    |    |    | child_profile_id FK |    |    | story_id        FK  |
| age         int     |    +----| title       text    |    +----| page_number    int  |
| interests   text[]  |   1:N   | theme       text    |   1:N   | text_content   text |
| favorite_things text|         | illustration_style  |         | illustration_url    |
| themes_to_avoid text|         | status      text    |         | created_at timestz  |
| reading_level text  |         | page_count  int     |         +=====================+
| photo_urls  text[]  |         | created_at timestz  |
| session_id  text    |         +=====================+
| user_id     uuid FK?|
| created_at  timestz |
+=====================+

+=====================+
|  storage.buckets    |
+=====================+
| child-photos (public)|
+=====================+
```

### Relationship Summary

| Relationship | Type | Cascade |
|-------------|------|---------|
| child_profiles -> stories | 1:N | RESTRICT (no delete with children) |
| stories -> story_pages | 1:N | RESTRICT (no delete with children) |
| child_profiles.user_id -> auth.users | N:1 | Optional FK |

---

## Table Definitions

### child_profiles

Stores all information about the child protagonist. Created during the wizard flow before story generation begins.

```sql
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
```

**Column Details:**

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PK | Auto-generated unique ID |
| name | text | NO | '' | - | Child's first name (used as story protagonist) |
| age | integer | NO | 5 | - | Age in years (3-7, affects reading level) |
| interests | text[] | NO | '{}' | - | Array of selected interests (max 5 from: Space, Animals, Princesses, Superheroes, Cars & Trucks, Fairies & Magic, Sports, Music, Robots, Art & Drawing) |
| favorite_things | text | NO | '' | - | Free-text description of favorites |
| themes_to_avoid | text | NO | '' | - | Topics to exclude from story |
| reading_level | text | NO | 'beginner' | - | 'beginner' or 'intermediate' |
| photo_urls | text[] | NO | '{}' | - | Public storage URLs for uploaded photos |
| session_id | text | NO | '' | - | Client-generated UUID for anonymous tracking |
| user_id | uuid | YES | NULL | FK auth.users | Optional link to authenticated user |
| created_at | timestamptz | NO | now() | - | Row creation timestamp |

**Indexes:**
```sql
CREATE INDEX idx_child_profiles_session_id ON child_profiles(session_id);
CREATE INDEX idx_child_profiles_user_id ON child_profiles(user_id);
```

---

### stories

Tracks story generation state and metadata. Created with status 'pending' before the edge function is called.

```sql
CREATE TABLE IF NOT EXISTS stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id),
  title text NOT NULL DEFAULT '',
  theme text NOT NULL DEFAULT '',
  illustration_style text NOT NULL DEFAULT 'cartoon',
  status text NOT NULL DEFAULT 'pending',
  page_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Column Details:**

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PK | Auto-generated unique ID |
| child_profile_id | uuid | NO | - | FK child_profiles(id) | Parent profile reference |
| title | text | NO | '' | - | AI-generated story title |
| theme | text | NO | '' | - | superhero/fairy-tale |
| illustration_style | text | NO | 'cartoon' | - | cartoon (fixed) |
| status | text | NO | 'pending' | - | pending/generating/complete/failed |
| page_count | integer | NO | 0 | - | Final page count (set on completion) |
| created_at | timestamptz | NO | now() | - | Row creation timestamp |

**Status Lifecycle:**
```
pending -> generating -> complete
                     \-> failed
```

**Indexes:**
```sql
CREATE INDEX idx_stories_child_profile_id ON stories(child_profile_id);
CREATE INDEX idx_stories_status ON stories(status);
```

---

### story_pages

Individual pages of a generated story. Inserted in bulk by the edge function after all content is ready.

```sql
CREATE TABLE IF NOT EXISTS story_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES stories(id),
  page_number integer NOT NULL DEFAULT 1,
  text_content text NOT NULL DEFAULT '',
  illustration_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Column Details:**

| Column | Type | Nullable | Default | Constraints | Description |
|--------|------|----------|---------|-------------|-------------|
| id | uuid | NO | gen_random_uuid() | PK | Auto-generated unique ID |
| story_id | uuid | NO | - | FK stories(id) | Parent story reference |
| page_number | integer | NO | 1 | - | Sequential page number (1-8) |
| text_content | text | NO | '' | - | Story narrative for this page |
| illustration_url | text | NO | '' | - | URL to generated/fallback image |
| created_at | timestamptz | NO | now() | - | Row creation timestamp |

**Indexes:**
```sql
CREATE INDEX idx_story_pages_story_id ON story_pages(story_id);
CREATE INDEX idx_story_pages_page_number ON story_pages(story_id, page_number);
```

---

## Storage Buckets

### child-photos

| Property | Value |
|----------|-------|
| Bucket ID | child-photos |
| Public | YES |
| File Path Format | `{session_id}/{uuid}.{extension}` |
| Accepted Types | Any (no server-side restriction) |
| Max Size | Unrestricted |

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('child-photos', 'child-photos', true)
ON CONFLICT (id) DO NOTHING;
```

**Storage Policies:**
```sql
-- Upload: Anyone can upload
CREATE POLICY "Anyone can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'child-photos');

-- Read: Anyone can read (public bucket)
CREATE POLICY "Anyone can read photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'child-photos');
```

---

## Row Level Security (RLS)

All tables have RLS enabled. The security model uses a dual-path approach:
1. **Anonymous users**: Identified by `x-session-id` request header
2. **Authenticated users**: Identified by `auth.uid()`

### child_profiles Policies

```sql
-- SELECT: Users can read their own profiles
CREATE POLICY "Users can read own profiles by session"
  ON child_profiles FOR SELECT
  TO anon, authenticated
  USING (
    session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  );

-- INSERT: Anyone can create a profile
CREATE POLICY "Anyone can create a child profile"
  ON child_profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- UPDATE: Users can update their own profiles
CREATE POLICY "Users can update own profiles by session"
  ON child_profiles FOR UPDATE
  TO anon, authenticated
  USING (
    session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  )
  WITH CHECK (
    session_id = current_setting('request.headers', true)::json->>'x-session-id'
    OR (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  );
```

### stories Policies

```sql
-- SELECT: Users can read their own stories (via child_profile ownership)
CREATE POLICY "Users can read own stories"
  ON stories FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles
      WHERE child_profiles.id = stories.child_profile_id
      AND (
        child_profiles.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = child_profiles.user_id)
      )
    )
  );

-- INSERT: Users can create stories for their own profiles
CREATE POLICY "Anyone can create a story"
  ON stories FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM child_profiles
      WHERE child_profiles.id = child_profile_id
      AND (
        child_profiles.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = child_profiles.user_id)
      )
    )
  );

-- UPDATE: Users can update their own stories
CREATE POLICY "Users can update own stories"
  ON stories FOR UPDATE
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles
      WHERE child_profiles.id = stories.child_profile_id
      AND (
        child_profiles.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = child_profiles.user_id)
      )
    )
  );
```

### story_pages Policies

```sql
-- SELECT: Users can read pages of their own stories
CREATE POLICY "Users can read own story pages"
  ON story_pages FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stories
      JOIN child_profiles ON child_profiles.id = stories.child_profile_id
      WHERE stories.id = story_pages.story_id
      AND (
        child_profiles.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = child_profiles.user_id)
      )
    )
  );

-- INSERT: System can insert pages (via service role in edge function)
CREATE POLICY "Anyone can insert story pages"
  ON story_pages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories
      JOIN child_profiles ON child_profiles.id = stories.child_profile_id
      WHERE stories.id = story_id
      AND (
        child_profiles.session_id = current_setting('request.headers', true)::json->>'x-session-id'
        OR (auth.uid() IS NOT NULL AND auth.uid() = child_profiles.user_id)
      )
    )
  );
```

---

## Data Flow Patterns

### Write Path (Story Generation)

```
Frontend:
  1. supabase.storage.upload('child-photos', file) -> photo_url
  2. supabase.from('child_profiles').insert({...}) -> profile.id
  3. supabase.from('stories').insert({status:'pending'}) -> story.id
  4. POST /functions/v1/generate-story (fire-and-forget)

Edge Function (service_role bypasses RLS):
  5. UPDATE stories SET status='generating'
  6. [AI Pipeline generates content]
  7. UPDATE stories SET title=...
  8. INSERT story_pages (8 rows)
  9. UPDATE stories SET status='complete', page_count=8
```

### Read Path (Story Viewing)

```
Frontend:
  1. supabase.from('stories').select('*').eq('id', storyId) -> story
  2. supabase.from('story_pages').select('*').eq('story_id', storyId).order('page_number') -> pages[]
  3. Render page-by-page with navigation
```

### Polling Path (Generation Status)

```
Frontend (every 2 seconds):
  1. supabase.from('stories').select('status').eq('id', storyId) -> status
  2. If 'complete': navigate to story reader
  3. If 'failed': navigate to story reader (shows demo)
  4. Otherwise: continue polling
```

---

## Query Patterns

### Most Common Queries

| Query | Frequency | Index Used |
|-------|-----------|-----------|
| SELECT status FROM stories WHERE id = ? | Every 2s during generation | PK |
| SELECT * FROM story_pages WHERE story_id = ? ORDER BY page_number | Once per story view | Composite index |
| INSERT INTO child_profiles | Once per story creation | - |
| INSERT INTO stories | Once per story creation | - |
| UPDATE stories SET status = ? WHERE id = ? | 3x per generation | PK |
| INSERT INTO story_pages (batch of 8) | Once per completion | - |

### Performance Considerations

1. **RLS subquery overhead**: story_pages SELECT requires a 2-table JOIN in the policy evaluation. At scale, consider denormalizing session_id onto stories table.

2. **Polling load**: Each active generation creates 1 query/2s. With 100 concurrent users, that's 50 queries/second against the stories table PK index -- manageable for Postgres.

3. **No pagination needed**: Stories have max 8 pages, all fetched at once.

4. **No search/filter**: No full-text search or complex filtering currently needed.

---

## Migration History

| Timestamp | Filename | Description |
|-----------|----------|-------------|
| 20260518195551 | create_story_tables | Core schema: 3 tables, indexes, RLS |
| 20260518203954 | create_photo_storage_bucket | Storage bucket + policies |

---

## Future Schema Considerations

### Planned Additions

```sql
-- User authentication link
ALTER TABLE child_profiles
  ADD COLUMN IF NOT EXISTS email text;

-- Story library / favorites
CREATE TABLE IF NOT EXISTS story_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  story_id uuid NOT NULL REFERENCES stories(id),
  is_favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Generation analytics
CREATE TABLE IF NOT EXISTS generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES stories(id),
  event_type text NOT NULL,  -- 'started', 'step_complete', 'failed', 'completed'
  step_name text,
  duration_ms integer,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- LoRA model cache
CREATE TABLE IF NOT EXISTS lora_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid REFERENCES child_profiles(id),
  model_url text NOT NULL,
  training_status text DEFAULT 'pending',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

---

*End of Database Architecture Document*
