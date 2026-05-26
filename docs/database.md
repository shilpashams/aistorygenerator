# Database Architecture

## Design Philosophy

The schema is optimized for a **single write path** (story creation) and **two read paths** (status polling + story display). It uses Supabase's RLS to enforce data isolation without requiring user authentication -- enabling a zero-friction demo experience while maintaining a clean migration path to authenticated access.

Key principles:
- Every table has RLS enabled; default-deny
- Session-based access (anonymous) OR user-based access (authenticated) -- policies support both
- Foreign keys enforce referential integrity through the ownership chain
- No cascading deletes (data safety over convenience)
- All timestamps use `timestamptz` (timezone-aware)

---

## Entity Relationship Diagram

```
┌─────────────────────┐
│   child_profiles    │
├─────────────────────┤
│ id (PK, uuid)       │
│ name                │
│ age                 │         ┌─────────────────────┐
│ interests[]         │         │      stories        │
│ favorite_things     │         ├─────────────────────┤
│ themes_to_avoid     │    1:N  │ id (PK, uuid)       │
│ reading_level       │◄────────│ child_profile_id(FK)│
│ photo_urls[]        │         │ title               │
│ session_id          │         │ theme               │        ┌─────────────────────┐
│ user_id (FK, null)  │         │ illustration_style  │        │    story_pages      │
│ created_at          │         │ status              │        ├─────────────────────┤
└─────────────────────┘         │ page_count          │   1:N  │ id (PK, uuid)       │
                                │ created_at          │◄───────│ story_id (FK)       │
                                └─────────────────────┘        │ page_number         │
                                                               │ text_content        │
                                                               │ illustration_url    │
                                                               │ created_at          │
                                                               └─────────────────────┘
```

---

## Table Specifications

### child_profiles

Primary entity. Created once per wizard completion. Contains all input data needed to generate a personalized story.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | PRIMARY KEY |
| name | text | NO | -- | -- |
| age | integer | NO | -- | -- |
| interests | text[] | NO | `'{}'` | -- |
| favorite_things | text | NO | `''` | -- |
| themes_to_avoid | text | NO | `''` | -- |
| reading_level | text | NO | `'beginner'` | -- |
| photo_urls | text[] | NO | `'{}'` | -- |
| session_id | text | NO | -- | Indexed |
| user_id | uuid | YES | NULL | FK -> auth.users(id) |
| created_at | timestamptz | NO | `now()` | -- |

**Design Notes**:
- `interests` is a text array rather than a junction table because the interest list is fixed (10 options: Space, Animals, Princesses, Superheroes, Cars & Trucks, Fairies & Magic, Sports, Music, Robots, Art & Drawing) and query patterns never filter by individual interest.
- `photo_urls` stores public Supabase Storage URLs. These are stable (don't expire) because the bucket is public.
- `session_id` is NOT a foreign key -- it's a client-generated UUID with no server-side session table. This is intentional: we don't need session metadata, just an isolation key.
- `user_id` is nullable to support anonymous-first access. When auth is added, this column bridges to `auth.users`.

### stories

Tracks generation state and metadata. Created with `status='pending'`, progresses through `generating` to `complete` (or `failed`).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | PRIMARY KEY |
| child_profile_id | uuid | NO | -- | FK -> child_profiles(id) |
| title | text | NO | `''` | -- |
| theme | text | NO | -- | -- |
| illustration_style | text | NO | `'cartoon'` | -- |
| status | text | NO | `'pending'` | -- |
| page_count | integer | NO | `0` | -- |
| created_at | timestamptz | NO | `now()` | -- |

**Status State Machine**:
```
pending ──▶ generating ──▶ complete
                │
                └──────────▶ failed
```

**Design Notes**:
- `title` starts empty and is populated by the AI during generation. This avoids a second INSERT/UPDATE round-trip from the frontend.
- `page_count` is denormalized (could be derived from `COUNT(story_pages)`) for efficient display without joins.
- `status` is a text field rather than an enum to avoid migration friction when adding new states.
- One child_profile can have multiple stories (re-generation, different themes).

### story_pages

Individual pages of a completed story. Written atomically by the edge function after all illustrations are ready.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | uuid | NO | `gen_random_uuid()` | PRIMARY KEY |
| story_id | uuid | NO | -- | FK -> stories(id) |
| page_number | integer | NO | -- | -- |
| text_content | text | NO | -- | -- |
| illustration_url | text | NO | `''` | -- |
| created_at | timestamptz | NO | `now()` | -- |

**Indexes**:
- `idx_story_pages_story_id` on `(story_id)` -- fast lookup for "give me all pages for this story"
- `idx_story_pages_ordering` on `(story_id, page_number)` -- ordered retrieval without sort

**Design Notes**:
- Pages are always fetched as a complete set (`WHERE story_id = $1 ORDER BY page_number`). No single-page access pattern exists.
- `illustration_url` may contain a fal.ai CDN URL (temporary, expires after ~7 days) or a Pexels URL (permanent). Long-term, fal.ai URLs should be downloaded and re-uploaded to Supabase Storage for permanence.
- Pages are inserted in bulk (10 rows) by the edge function. They are never updated after creation.

---

## Row Level Security (RLS) Architecture

### Access Model

The RLS layer supports two identity mechanisms simultaneously:

1. **Anonymous (session-based)**: Request header `x-session-id` matches `child_profiles.session_id`
2. **Authenticated (future)**: `auth.uid()` matches `child_profiles.user_id`

Policies use OR logic: either mechanism grants access. This allows gradual migration from anonymous to authenticated without breaking existing sessions.

### Policy Breakdown

#### child_profiles

| Policy Name | Operation | Rule |
|-------------|-----------|------|
| "Users can read own profiles" | SELECT | `session_id = header OR auth.uid() = user_id` |
| "Users can create profiles" | INSERT | `session_id = header OR auth.uid() = user_id` |
| "Users can update own profiles" | UPDATE | USING + WITH CHECK: same ownership rule |
| "Users can delete own profiles" | DELETE | USING: same ownership rule |

#### stories

| Policy Name | Operation | Rule |
|-------------|-----------|------|
| "Users can read own stories" | SELECT | `child_profile_id IN (SELECT id FROM child_profiles WHERE owned)` |
| "Users can create stories" | INSERT | WITH CHECK: same subquery |
| "Users can update own stories" | UPDATE | USING + WITH CHECK: same subquery |
| "Users can delete own stories" | DELETE | USING: same subquery |

#### story_pages

| Policy Name | Operation | Rule |
|-------------|-----------|------|
| "Users can read own story pages" | SELECT | `story_id IN (SELECT id FROM stories WHERE child_profile_id IN (SELECT id FROM child_profiles WHERE owned))` |
| "Service role can insert pages" | INSERT | Handled by service role key (bypasses RLS) |

**Transitive Access**: story_pages access requires ownership of the parent story, which requires ownership of the parent child_profile. This is a 3-level ownership chain evaluated via nested subqueries.

---

## Storage Configuration

### Bucket: `child-photos`

| Setting | Value | Rationale |
|---------|-------|-----------|
| Public | Yes | fal.ai needs to fetch photos via public URL |
| Max file size | 50MB (default) | No custom limit set |
| Allowed types | image/* | Enforced client-side only |

**Upload Policy**: Anonymous uploads allowed when the path prefix matches the session ID header.

**Read Policy**: All objects are publicly readable (required for fal.ai to download the reference photo).

**Path Convention**: `{session_id}/{crypto.randomUUID()}.{extension}`

This path structure:
- Namespaces by session (prevents collision between users)
- Uses random UUIDs (prevents enumeration/guessing)
- Preserves file extension (helps with MIME detection)

---

## Query Patterns

### Write Path (StoryGenerating component)

```sql
-- 1. Create profile
INSERT INTO child_profiles (name, age, interests, ..., session_id)
VALUES ($1, $2, $3, ..., $session)
RETURNING id;

-- 2. Create story
INSERT INTO stories (child_profile_id, theme, illustration_style, status)
VALUES ($profile_id, $theme, $style, 'pending')
RETURNING id;
```

### Write Path (Edge Function, service role)

```sql
-- 3. Update status
UPDATE stories SET status = 'generating' WHERE id = $story_id;

-- 4. Update title
UPDATE stories SET title = $title WHERE id = $story_id;

-- 5. Insert pages (bulk)
INSERT INTO story_pages (story_id, page_number, text_content, illustration_url)
VALUES ($story_id, 1, $text1, $url1),
       ($story_id, 2, $text2, $url2),
       ...
       ($story_id, 10, $text10, $url10);

-- 6. Mark complete
UPDATE stories SET status = 'complete', page_count = 10 WHERE id = $story_id;
```

### Read Path (Polling)

```sql
SELECT status, title, page_count
FROM stories
WHERE id = $story_id;
-- Executes every 2 seconds; indexed on PK
```

### Read Path (Story Display)

```sql
SELECT * FROM stories WHERE id = $story_id;
SELECT * FROM story_pages WHERE story_id = $story_id ORDER BY page_number;
```

---

## Data Lifecycle

```
User creates story ──▶ child_profiles + stories (pending) written
                       photos uploaded to storage
                       
Edge function runs ──▶ stories status updated
                       story_pages written
                       stories marked complete
                       
User reads story   ──▶ stories + story_pages fetched (read-only)

[No deletion/archival mechanism currently exists]
```

**Gap**: There is no automated cleanup for:
- Orphaned profiles (wizard abandoned before generation)
- Stories stuck in `generating` status (edge function crashed)
- Old photos in storage (never deleted)
- Expired fal.ai illustration URLs (CDN links have TTL)

---

## Migration History

| Timestamp | File | Purpose |
|-----------|------|---------|
| 20260518195551 | `create_story_tables.sql` | Core schema: child_profiles, stories, story_pages + RLS |
| 20260518203954 | `create_photo_storage_bucket.sql` | Storage bucket + upload/read policies |

---

## Scaling Considerations

**Current Load Profile**: Single-digit concurrent users. No performance concerns.

**At 10K stories/month**:
- The transitive RLS subqueries on story_pages may become slow. Consider adding a denormalized `session_id` column to stories (avoid the join to child_profiles in every policy check).
- The polling pattern generates ~30 requests per story generation. At 10K stories/month, that's 300K lightweight SELECT queries -- still trivial for Postgres.

**At 100K stories/month**:
- Consider partitioning `story_pages` by `created_at` (range partition, monthly).
- Archive completed stories older than 90 days to a separate schema or cold storage.
- Add connection pooling awareness (Supabase uses PgBouncer; currently fine with transaction mode).
