# API Reference

## Overview

The system exposes two API surfaces:
1. **Supabase REST (PostgREST)** -- CRUD operations on `child_profiles`, `stories`, `story_pages` via the `@supabase/supabase-js` client.
2. **Supabase Edge Functions** -- A single serverless function (`generate-story`) that orchestrates AI generation.

All requests require the `apikey` header (anon key) and a custom `x-session-id` header for RLS policy evaluation.

---

## Edge Function: generate-story

### `POST /functions/v1/generate-story`

Triggers asynchronous story generation. The function runs for 30-120 seconds, writing results directly to the database. The HTTP response returns immediately after validation.

**Authentication**: Public (JWT verification disabled). Authorization is implicit -- the caller must already own the `story_id` they're requesting generation for.

**Headers**:
```
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
```

**Request Body**:
```typescript
interface StoryRequest {
  story_id: string;           // UUID of pre-created story row
  child_profile_id: string;   // UUID of associated child profile
  name: string;               // Child's first name
  age: number;                // Child's age (2-12)
  interests: string[];        // 1-5 interest strings
  favorite_things: string;    // Free-text (color, animal, food -- may be empty)
  themes_to_avoid: string;    // Free-text exclusions (may be empty)
  reading_level: string;      // "beginner" | "intermediate"
  theme: string;              // "superhero" | "fairy-tale"
  illustration_style: string; // "cartoon" | "storybook" | "watercolor"
  photo_urls: string[];       // 1-3 public URLs to uploaded child photos
  favorite_toy: string;       // Child's favorite toy or comfort object
  nickname: string;           // Child's nickname
  proud_of: string;           // Something the child is proud of
  currently_learning: string; // Something the child is currently learning
  story_mood: string;         // "bedtime-calm" | "silly-adventure" | "bravery" | "friendship" | "confidence" | "curiosity"
  family_phrase: string;      // A family saying or phrase
}
```

**Response (200 -- generation initiated)**:
```json
{
  "success": true,
  "story_id": "uuid",
  "title": "The Generated Story Title",
  "ai_error": null  // or error string if fallback was used
}
```

**Response (500 -- unrecoverable failure)**:
```json
{
  "error": "Human-readable error message"
}
```

**Side Effects (database mutations)**:
1. `UPDATE stories SET status = 'generating' WHERE id = $story_id`
2. `UPDATE stories SET title = $title WHERE id = $story_id`
3. `INSERT INTO story_pages (story_id, page_number, text_content, illustration_url)` -- 8 rows
4. `UPDATE stories SET status = 'complete', page_count = 8 WHERE id = $story_id`

If generation fails after step 1, the story remains in `generating` status indefinitely. There is no automatic timeout or retry mechanism.

**Rate Limit Behavior**: The OpenAI account has a 3 RPM limit. The function retries 429 errors up to 5 times with 21s+ backoff. This can extend execution time significantly but ensures generation eventually succeeds.

**Execution Timeline**:
- t+0s: Status set to `generating`
- t+5-30s: OpenAI text generation completes (includes potential rate limit waits)
- t+30-90s: 8 fal.ai illustration requests complete in parallel
- t+90-95s: Database writes complete, status set to `complete`

---

## Supabase Client Operations

### Supabase Client Configuration

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'x-session-id': getSessionId(),
    },
  },
});
```

The `x-session-id` header is critical -- RLS policies evaluate it via `current_setting('request.headers')::json->>'x-session-id'`.

### Session ID Generation

```typescript
function getSessionId(): string {
  const key = 'adventures_of_session_id';
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
}
```

---

## Database Operations (Frontend)

### Upload Photo to Storage

```typescript
const filePath = `${sessionId}/${crypto.randomUUID()}.${ext}`;
const { error } = await supabase.storage
  .from('child-photos')
  .upload(filePath, file, { contentType: file.type });

const { data: { publicUrl } } = supabase.storage
  .from('child-photos')
  .getPublicUrl(filePath);
```

**Bucket**: `child-photos` (public read, anonymous insert with session path)
**Path Convention**: `{session_id}/{random_uuid}.{file_extension}`

### Insert Child Profile

```typescript
const { data: profile, error } = await supabase
  .from('child_profiles')
  .insert({
    name,
    age,
    interests,
    favorite_things,
    themes_to_avoid,
    reading_level,
    photo_urls,
    session_id: getSessionId(),
  })
  .select('id')
  .single();
```

### Insert Story (Pending)

```typescript
const { data: story, error } = await supabase
  .from('stories')
  .insert({
    child_profile_id: profile.id,
    theme,
    illustration_style,
    status: 'pending',
  })
  .select('id')
  .single();
```

### Poll Story Status

```typescript
const { data } = await supabase
  .from('stories')
  .select('status, title, page_count')
  .eq('id', storyId)
  .maybeSingle();

// Repeat every 2 seconds until data.status === 'complete' or 'failed'
```

**Important**: Uses `maybeSingle()` (returns null on no match) not `single()` (throws on no match).

### Fetch Completed Story

```typescript
const { data: story } = await supabase
  .from('stories')
  .select('*')
  .eq('id', storyId)
  .maybeSingle();

const { data: pages } = await supabase
  .from('story_pages')
  .select('*')
  .eq('story_id', storyId)
  .order('page_number', { ascending: true });
```

---

## External API Integrations (Edge Function, Server-Side Only)

### OpenAI Chat Completions

**Endpoint**: `POST https://api.openai.com/v1/chat/completions`

**Model**: `gpt-4o`

**Parameters**:
| Parameter | Value | Rationale |
|-----------|-------|-----------|
| temperature | 0.85 | Balances creativity with coherence |
| max_tokens | 4096 | Sufficient for 8 pages + illustration prompts + JSON structure |
| response_format | json_object | Enforces valid JSON output |
| messages | system + user | System sets author role; user contains full combined prompt |

**Output**: Raw JSON string (no markdown fences). Parsed into `GeneratedStory` interface.

**Rate Limit Handling** (3 RPM on current tier):
- 429 (rate limit): Retried up to 5 times with 21s+ exponential backoff
- After 5 retries: Falls back to template
- 500/503 (service unavailable): Falls back to template immediately
- Invalid JSON in response: Falls back to template

### fal.ai Flux Pro Kontext

**Submit Endpoint**: `POST https://queue.fal.run/fal-ai/flux-pro/kontext/max`

**Parameters**:
```json
{
  "prompt": "<assembled style + scene + character prompt>",
  "image_url": "<public URL to child's photo>",
  "output_format": "jpeg",
  "aspect_ratio": "4:3",
  "safety_tolerance": "6",
  "num_images": 1
}
```

**Queue Protocol**:
1. Submit returns `{ status_url, response_url }` (or immediate `{ images }` if cached)
2. Poll `status_url` every 3 seconds with `Authorization: Key <FAL_KEY>`
3. On status `COMPLETED`: GET `response_url` for `{ images: [{ url }] }`
4. On status `FAILED` or 40 polls (2 min timeout): Use Pexels fallback

**Concurrency**: All 8 page illustrations are submitted simultaneously via `Promise.allSettled()`. fal.ai handles queuing internally.

---

## Environment Variables

### Frontend (.env, embedded at build time)

| Variable | Exposure | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | Public (in JS bundle) | Supabase project endpoint |
| `VITE_SUPABASE_ANON_KEY` | Public (in JS bundle) | Row-level-security-gated access |

### Edge Function (auto-injected by Supabase runtime)

| Variable | Exposure | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Server only | Internal Supabase endpoint |
| `SUPABASE_ANON_KEY` | Server only | Unused in current implementation |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Bypasses RLS for DB writes |
| `SUPABASE_DB_URL` | Server only | Direct Postgres connection (unused) |

### Edge Function Secrets (configured via dashboard)

| Variable | Exposure | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Server only | GPT-4o access |
| `FAL_KEY` | Server only | fal.ai Flux Pro access |

---

## CORS Policy

All edge function responses include:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Client-Info, Apikey
```

OPTIONS preflight requests return 200 with these headers and no body.

---

## Rate Limiting

**Current**: None implemented. The system relies on:
- fal.ai's own queue management for backpressure
- OpenAI's API rate limits as a natural ceiling
- Supabase connection pooling limits

**Recommended**: Add per-session rate limiting (max 3 stories per 24h period) either via edge function logic or Supabase RLS policy with a time-window check.

---

## Error Taxonomy

| Error Source | HTTP Status | Client Behavior |
|-------------|-------------|-----------------|
| Invalid request body | 500 | Show error, offer retry |
| OpenAI unavailable | 200 (fallback used) | User gets template story |
| fal.ai unavailable | 200 (fallback used) | User gets stock illustrations |
| Supabase DB error | 500 | Story stuck in 'generating' |
| Storage upload fails | Client-side error | Block wizard progression |
| Network timeout | No response | Frontend continues polling |
