# System Architecture Document
## AI Children's Storybook Application

**Version**: 1.0  
**Date**: 2026-05-21  
**Audience**: Senior Engineers, AI Architects, Technical Leadership

---

## Executive Summary

This application generates personalized children's storybooks using AI. Parents upload photos of their child, provide profile information (name, age, interests, personality traits), select a theme, and the system produces an 8-page illustrated story where the child is the protagonist. The architecture combines a React SPA frontend with Supabase backend services and a multi-stage AI pipeline orchestrated through Edge Functions.

**Key Technical Decisions:**
- Anonymous session-based access (no authentication required)
- Fire-and-forget generation pattern with polling
- Multi-stage AI pipeline: Story Bible -> Text -> Editorial -> Validation -> Character Sheet -> Illustration Prompts -> Image Generation
- fal.ai Flux Pro Kontext for photo-to-illustration transformation
- Graceful degradation via fallback stories and stock images

---

## 1. High-Level System Overview

### Architecture Diagram

```
                    +------------------+
                    |      User        |
                    |  (Parent/Child)  |
                    +--------+---------+
                             |
                             v
                    +------------------+
                    |   Frontend SPA   |
                    |  React + Vite    |
                    |  Tailwind CSS    |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
              v              v              v
     +--------+----+  +-----+------+  +----+--------+
     |  Supabase   |  |  Supabase  |  |  Supabase   |
     |  Database   |  |  Storage   |  |   Edge Fn   |
     |  (Postgres) |  | (S3-like)  |  | generate-   |
     |             |  |            |  |   story     |
     +--------+----+  +-----+------+  +----+--------+
              |              |              |
              |              |    +---------+---------+
              |              |    |                   |
              |              |    v                   v
              |              | +------+         +----------+
              |              | |OpenAI|         |  fal.ai  |
              |              | |GPT-4o|         | Flux Pro |
              |              | |      |         | Kontext  |
              |              | +------+         +----------+
              |              |    |                   |
              +--------------+----+-------------------+
                             |
                             v
                    +------------------+
                    |  Story Reader    |
                    |  (Page-by-Page)  |
                    +------------------+
```

### Request Lifecycle

```
1. USER INTERACTION
   Upload photos -> Fill profile -> Select theme -> Submit

2. FRONTEND ORCHESTRATION
   Upload photos to Storage -> Insert child_profile -> Insert story (pending)
   -> POST to Edge Function (fire-and-forget) -> Poll DB every 2s

3. EDGE FUNCTION PIPELINE
   Receive request -> Set status "generating"
   -> Analyze photo (Vision API)
   -> Generate Story Bible (GPT-4o)
   -> Write story text (GPT-4o)
   -> Editorial review (GPT-4o)
   -> Validate reading level
   -> Rewrite failing pages (GPT-4o)
   -> Generate character sheet (GPT-4o)
   -> Generate illustration prompts (GPT-4o)
   -> Generate 8 illustrations in parallel (fal.ai)
   -> Quality check each illustration (GPT-4o Vision)
   -> Insert story_pages -> Set status "complete"

4. FRONTEND RENDERING
   Poll detects "complete" -> Fetch story + pages -> Render page-by-page
```

### Component Responsibilities

| Layer | Responsibility |
|-------|---------------|
| Frontend | Form wizard, photo upload, polling, page-by-page rendering |
| Supabase DB | Persistence, RLS-based access control, session isolation |
| Supabase Storage | Photo hosting (public bucket) |
| Edge Function | AI orchestration, image generation, error handling |
| OpenAI GPT-4o | Story writing, editing, validation, quality checks |
| fal.ai Flux Pro | Photo-to-illustration transformation |

---

## 2. Frontend Architecture

### Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3.1 | UI framework |
| Vite | 5.4.2 | Build tool / dev server |
| TypeScript | 5.5.3 | Type safety |
| Tailwind CSS | 3.4.1 | Utility-first styling |
| React Router | 6.30.3 | Client-side routing |
| Supabase JS | 2.57.4 | Backend client |
| Lucide React | 0.344.0 | Icon library |
| docx | 9.6.1 | Word document generation |

### Folder Structure

```
src/
+-- App.tsx                      # Route definitions
+-- main.tsx                     # React DOM entry
+-- index.css                    # Global styles + Tailwind
+-- vite-env.d.ts                # Vite type declarations
+-- components/                  # Landing page sections
|   +-- Header.tsx               # Sticky nav with mobile menu
|   +-- Hero.tsx                 # Hero section with CTA
|   +-- TrustStrip.tsx           # Statistics + social proof
|   +-- ProblemSection.tsx       # Pain points
|   +-- SolutionSection.tsx      # Benefits
|   +-- HowItWorks.tsx          # 4-step process
|   +-- Features.tsx             # Feature grid (6 cards)
|   +-- Testimonials.tsx         # Parent quotes
|   +-- FAQ.tsx                  # Expandable accordion
|   +-- FinalCTA.tsx             # Bottom CTA
|   +-- Footer.tsx               # Footer links
+-- context/
|   +-- WizardContext.tsx        # Multi-step form state
+-- lib/
|   +-- types.ts                 # TypeScript interfaces
|   +-- supabase.ts              # Supabase client singleton
+-- pages/
    +-- ArchitectureDoc.tsx       # Docx auto-download
    +-- create/
        +-- WizardLayout.tsx     # Step progress + outlet
        +-- PhotoUpload.tsx      # Step 1: Photo drag/drop
        +-- ChildProfile.tsx     # Step 2: Profile form
        +-- ThemeSelection.tsx   # Step 3: Theme + style
        +-- StoryGenerating.tsx  # Step 4: Trigger + poll
        +-- StoryReader.tsx      # Step 5: Story display
```

### Routing Map

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | LandingPage | Marketing + CTA |
| `/architecture` | ArchitectureDoc | Auto-download .docx |
| `/create` | WizardLayout | Wizard container |
| `/create/photos` | PhotoUpload | Upload 1-3 photos |
| `/create/profile` | ChildProfile | Child information |
| `/create/theme` | ThemeSelection | Theme + art style |
| `/create/generating` | StoryGenerating | Generation + polling |
| `/create/story/:storyId` | StoryReader | Final story display |

### State Management

**WizardContext** provides global state across all wizard steps:

```typescript
interface WizardData {
  photos: File[];
  photoPreviewUrls: string[];
  name: string;
  age: number;                    // 3-7
  interests: string[];            // max 5 from: Space | Animals | Princesses | Superheroes | Cars & Trucks | Fairies & Magic | Sports | Music | Robots | Art & Drawing
  favorite_things: string;
  themes_to_avoid: string;
  reading_level: string;          // beginner | intermediate
  theme: string;                  // superhero | fairy-tale
  illustration_style: string;     // cartoon | storybook | watercolor
  favorite_toy: string;
  nickname: string;
  proud_of: string;
  currently_learning: string;
  story_mood: string;             // bedtime-calm | silly-adventure | bravery | friendship | confidence | curiosity
  family_phrase: string;
}
```

### Async Flows

**Photo Upload Pipeline:**
```
User drops files
  -> Filter to image MIME types
  -> Slice to max 3
  -> Create Object URLs for preview
  -> Store File objects in context
  -> (On submit) Upload to Supabase Storage
  -> Get public URLs
  -> Store URLs in child_profiles
```

**Story Generation Trigger:**
```
Submit wizard
  -> Upload photos to storage bucket
  -> INSERT child_profiles (returns profile.id)
  -> INSERT stories with status='pending' (returns story.id)
  -> POST to Edge Function (fire-and-forget, .catch(() => {}))
  -> Start polling interval (2s)
  -> Show progress animation (0.6%/200ms, caps at 95%)
  -> On status='complete': navigate to /create/story/:id
  -> On status='failed': navigate anyway (shows fallback)
```

**Story Rendering Pipeline:**
```
Mount StoryReader
  -> Fetch story record by :storyId
  -> Fetch story_pages ordered by page_number ASC
  -> If pages exist: render them
  -> If no pages: generate demo pages from theme templates
  -> User navigates prev/next through pages
```

---

## 3. Backend Architecture

### Edge Functions

| Function | Purpose | Auth | Method |
|----------|---------|------|--------|
| `generate-story` | Full AI pipeline orchestration | No JWT (public) | POST |

### AI Request Pipeline (Sequential + Parallel)

```
[Sequential Phase - Story Text]
  Step 0: analyzeChildPhoto()        -> GPT-4o Vision  (200 tokens)
  Step 1: buildStoryBiblePrompt()    -> GPT-4o Chat    (4096 tokens)
  Step 2: buildStoryFromBiblePrompt()-> GPT-4o Chat    (3000 tokens)
  Step 2b: buildEditorialReview()    -> GPT-4o Chat    (3000 tokens) [non-fatal]
  Step 2c: validateStoryAgainstLevel + rewrite -> GPT-4o Chat (3000 tokens) [non-fatal]
  Step 3a: buildCharacterSheet()     -> GPT-4o Chat    (2000 tokens) [non-fatal]
  Step 3b: buildIllustrationPrompts()-> GPT-4o Chat    (4000 tokens)

[Parallel Phase - Illustrations]
  8x generateIllustrationWithQualityCheck()
    -> fal.ai Flux Pro Kontext (per page)
    -> GPT-4o Vision quality check (per page, up to 2 retries)
```

### Retry Logic

| Component | Strategy | Max Retries | Fallback |
|-----------|----------|-------------|----------|
| Photo analysis | Try/catch, default to "no details" | 1 | "no details extracted" |
| Story Bible | Fatal if fails | 0 | generateFallbackStory() |
| Story text | Fatal if fails | 0 | generateFallbackStory() |
| Editorial review | Non-fatal, skip on error | 0 | Use original text |
| Validation rewrite | Non-fatal, skip on error | 0 | Use unvalidated text |
| Character sheet | Non-fatal, use photo details | 0 | childVisualDetails string |
| Illustration prompts | Fatal if fails | 0 | generateFallbackStory() |
| Image generation | Quality check loop | 2 | Stock Pexels images |
| Quality check | Auto-pass on API error | 0 | { passed: true } |

### Storage Flow

```
Frontend:
  File -> supabase.storage.upload('child-photos', path) -> public URL

Edge Function:
  fal.ai returns hosted URL -> stored directly in story_pages.illustration_url
```

### Story Persistence Lifecycle

```
1. INSERT story (status='pending', title='', page_count=0)
2. UPDATE story (status='generating')
3. UPDATE story (title=generated_title, status='generating')
4. INSERT story_pages (8 rows with text + illustration URLs)
5. UPDATE story (status='complete', page_count=8)

On fatal error:
6. UPDATE story (status='failed')
```

---

## 4. Database Architecture

### Entity Relationship Diagram

```
+------------------+       +------------------+       +------------------+
|  child_profiles  |       |     stories      |       |   story_pages    |
+------------------+       +------------------+       +------------------+
| id (PK, uuid)   |<------| child_profile_id |       | id (PK, uuid)    |
| name             |  1:N  | id (PK, uuid)    |<------| story_id (FK)    |
| age              |       | title            |  1:N  | page_number      |
| interests[]      |       | theme            |       | text_content     |
| favorite_things  |       | illustration_    |       | illustration_url |
| themes_to_avoid  |       |   style          |       | created_at       |
| reading_level    |       | status           |       +------------------+
| photo_urls[]     |       | page_count       |
| session_id       |       | created_at       |
| user_id (FK?)    |       +------------------+
| created_at       |
+------------------+

+------------------+
| storage.buckets  |
+------------------+
| child-photos     |  (public bucket)
+------------------+
```

### Table: child_profiles

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | uuid | PK | gen_random_uuid() | Unique identifier |
| name | text | NOT NULL | '' | Child's first name |
| age | integer | NOT NULL | 5 | Age (2-12) |
| interests | text[] | NOT NULL | '{}' | Selected interests |
| favorite_things | text | NOT NULL | '' | Favorites description |
| themes_to_avoid | text | NOT NULL | '' | Excluded themes |
| reading_level | text | NOT NULL | 'beginner' | beginner/intermediate |
| photo_urls | text[] | NOT NULL | '{}' | Storage public URLs |
| session_id | text | NOT NULL | '' | Anonymous session ID |
| user_id | uuid | NULLABLE FK | NULL | Future auth link |
| created_at | timestamptz | NOT NULL | now() | Creation timestamp |

**Indexes:**
- `idx_child_profiles_session_id` on `session_id`
- `idx_child_profiles_user_id` on `user_id`

### Table: stories

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | uuid | PK | gen_random_uuid() | Unique identifier |
| child_profile_id | uuid | NOT NULL FK | - | Parent profile |
| title | text | NOT NULL | '' | Generated title |
| theme | text | NOT NULL | '' | Selected theme |
| illustration_style | text | NOT NULL | 'watercolor' | Art style |
| status | text | NOT NULL | 'pending' | Workflow state |
| page_count | integer | NOT NULL | 0 | Pages in story |
| created_at | timestamptz | NOT NULL | now() | Creation timestamp |

**Indexes:**
- `idx_stories_child_profile_id` on `child_profile_id`
- `idx_stories_status` on `status`

### Table: story_pages

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | uuid | PK | gen_random_uuid() | Unique identifier |
| story_id | uuid | NOT NULL FK | - | Parent story |
| page_number | integer | NOT NULL | 1 | Sequential order |
| text_content | text | NOT NULL | '' | Page narrative |
| illustration_url | text | NOT NULL | '' | Image URL |
| created_at | timestamptz | NOT NULL | now() | Creation timestamp |

**Indexes:**
- `idx_story_pages_story_id` on `story_id`
- `idx_story_pages_page_number` on `(story_id, page_number)` (composite)

### Row Level Security Policies

| Table | Operation | Policy | Condition |
|-------|-----------|--------|-----------|
| child_profiles | SELECT | Session/user match | session_id header OR auth.uid() = user_id |
| child_profiles | INSERT | Open | Always allowed |
| child_profiles | UPDATE | Session/user match | session_id header OR auth.uid() = user_id |
| stories | SELECT | Ownership chain | child_profile belongs to session/user |
| stories | INSERT | Ownership check | child_profile_id belongs to session/user |
| stories | UPDATE | Ownership chain | child_profile belongs to session/user |
| story_pages | SELECT | Ownership chain | story -> child_profile belongs to session/user |
| story_pages | INSERT | Ownership check | story belongs to session/user |

### Storage Bucket: child-photos

| Setting | Value |
|---------|-------|
| Public | Yes |
| Upload Policy | Anyone (anon, authenticated) |
| Read Policy | Anyone (public URLs) |
| Path Format | `{session_id}/{uuid}.{ext}` |

---

## 5. AI System Architecture

### Pipeline Overview

```
+--Photo Analysis--+   +--Story Bible--+   +--Story Text--+
| GPT-4o Vision    |-->| GPT-4o Chat   |-->| GPT-4o Chat  |
| Extract safe     |   | World-build   |   | Write 8-page |
| visual details   |   | Character dev |   | narrative    |
| T=0.3, 200 tok  |   | T=0.7, 4096  |   | T=0.7, 3000 |
+------------------+   +---------------+   +------+-------+
                                                   |
                        +--Editorial--+            |
                        | GPT-4o Chat |<-----------+
                        | Review/edit |
                        | T=0.4, 3000|
                        +------+------+
                               |
                        +--Validation--+
                        | Local logic  |
                        | Word/sentence|
                        | counting     |
                        +------+-------+
                               |
                        +--Rewrite--+  (if pages fail)
                        | GPT-4o    |
                        | T=0.4     |
                        +------+----+
                               |
        +--Character Sheet--+  |  +--Illustration Prompts--+
        | GPT-4o Chat       |<-+->| GPT-4o Chat            |
        | Visual reference  |     | Art direction per page |
        | T=0.4, 2000 tok  |     | T=0.7, 4000 tok       |
        +-------------------+     +----------+-------------+
                                             |
                                    +--------v--------+
                                    | 8x PARALLEL     |
                                    | fal.ai Flux Pro |
                                    | Kontext/max     |
                                    +--------+--------+
                                             |
                                    +--------v--------+
                                    | GPT-4o Vision   |
                                    | Quality Check   |
                                    | (up to 2 retry) |
                                    +-----------------+
```

### Models & Parameters

| Step | Model | Temperature | Max Tokens | Purpose |
|------|-------|-------------|------------|---------|
| Photo Analysis | gpt-4o (vision) | 0.3 | 200 | Safe visual extraction |
| Story Bible | gpt-4o | 0.7 | 4096 | Creative world-building |
| Story Writing | gpt-4o | 0.7 | 3000 | Narrative generation |
| Editorial Review | gpt-4o | 0.4 | 3000 | Conservative editing |
| Targeted Rewrite | gpt-4o | 0.4 | 3000 | Fix specific pages |
| Character Sheet | gpt-4o | 0.4 | 2000 | Visual consistency ref |
| Illustration Prompts | gpt-4o | 0.7 | 4000 | Art direction |
| Quality Check | gpt-4o (vision) | 0.2 | 500 | Strict QA |

### Story Bible Schema

```json
{
  "title": "Short catchy title",
  "main_character": {
    "name": "Child's name",
    "personality": ["trait1", "trait2", "trait3"],
    "child_specific_details": ["moment1", "moment2", "moment3"],
    "age_appropriate_strength": "description"
  },
  "sidekick": {
    "name": "Character name",
    "species_or_type": "Type",
    "appearance": ["detail1", "detail2", "detail3", "detail4"],
    "personality_trait": "description",
    "voice": "speech pattern",
    "catchphrase": "phrase"
  },
  "story_world": {
    "setting": {
      "named_place": "Location name",
      "landmarks": ["landmark1", "landmark2", "landmark3"]
    },
    "magical_object": "description",
    "sensory_details": {
      "smell": "description",
      "sound": "description",
      "texture": "description"
    },
    "rules": "one magical rule"
  },
  "emotional_core": {
    "child_strength": "action using interest",
    "small_fear": "relatable uncertainty",
    "recurring_phrase": "5-8 word musical phrase",
    "emotional_arc": {
      "starting": "emotion",
      "mid": "emotion",
      "ending": "emotion"
    }
  },
  "page_outline": [
    { "beat": "WONDER", "one_line": "description" },
    { "beat": "DELIGHT", "one_line": "description" },
    { "beat": "EMPATHY", "one_line": "description" },
    { "beat": "EXCITEMENT", "one_line": "description" },
    { "beat": "TEAMWORK", "one_line": "description" },
    { "beat": "TENSION", "one_line": "description" },
    { "beat": "TRIUMPH", "one_line": "description" },
    { "beat": "WARMTH", "one_line": "description" }
  ],
  "illustration_notes": {
    "child_depiction": "visual details from photo",
    "child_visual_in_story": "how to reference appearance",
    "sidekick_visual": "exact repeated description",
    "color_palette": ["color1", "color2", "color3", "color4"],
    "lighting_mood": "description"
  }
}
```

### Reading Level Specifications

| Parameter | Beginner (3-4) | Intermediate (5-6) |
|-----------|----------------|---------------------|
| Pages | 8 | 8 |
| Sentences/page | 1-2 (strict) | 2-4 |
| Words/sentence | 5-9 (strict) | 8-14 |
| Vocabulary | Preschool only | Richer but concrete |
| Refrain | 3-5 words, 4+ times | 5-8 words, 3+ times |
| Dialogue | Single exclamations only | Real exchanges, 4+ pages |
| Metaphors | None (unless physical) | Exactly 1 per story |
| Sensory | 1 onomatopoeia/page | Full sensory detail/page |
| Arc | discover->try->oops->try again->yay | setup->rising->false solution->real solution->denouement |
| Emotional growth | None (simply happy) | One self-discovery |

### Validation Checks (Local, No API)

1. Sentence count per page (min/max)
2. Average word count per sentence (min/max with tolerance)
3. Complex vocabulary detection (20-word forbidden list)
4. Beginner: dialogue construction check (no "said X")
5. Beginner: word length ceiling (max 11 avg)
6. Intermediate: richness minimum (not too simple)
7. Forbidden emotion word scan
8. Refrain frequency check (3-word phrase repetition)

---

## 6. Image Generation Architecture

### fal.ai Integration

| Parameter | Value |
|-----------|-------|
| Model | flux-pro/kontext/max |
| Endpoint | queue.fal.run |
| Image input | Child's uploaded photo URL |
| Output format | JPEG |
| Aspect ratio | 4:3 |
| Safety tolerance | 6 |
| Num images | 1 |
| Polling interval | 3 seconds |
| Max poll attempts | 40 (120s timeout) |

### Image Generation Flow

```
For each of 8 pages (in parallel):

1. Build full prompt:
   - Style render instructions (cartoon/storybook/watercolor)
   - "Transform this photo, keep child's face/features/likeness exactly"
   - Scene description from illustration_prompt
   - Theme suffix
   - "warm/friendly/appropriate, no text"

2. Submit to fal.ai queue:
   POST queue.fal.run/fal-ai/flux-pro/kontext/max
   { prompt, image_url, output_format, aspect_ratio, safety_tolerance }

3. Poll for completion:
   GET statusUrl every 3s, max 40 attempts
   On COMPLETED: fetch responseUrl -> extract images[0].url
   On FAILED: throw error

4. Quality check (unless final retry):
   GPT-4o Vision reviews image against 10 criteria:
   - Identity match, face quality, age appropriate
   - No hand deformities, no text, not blurry
   - Style matches expected, emotion matches page
   - Outfit consistent with character sheet

5. If fails quality: retry (max 2 retries, 3 total attempts)
   Final attempt skips quality check to guarantee output
```

### Style Differentiation

| Style | Render Instructions |
|-------|-------------------|
| Cartoon | Thick black outlines, flat saturated colors, oversized head (1/3 body), huge eyes (40% face), bold primaries, simple geometric backgrounds, motion lines |
| Storybook | Visible brushstrokes, rich layered color, detailed textures (wood/fabric/leaves), warm golden glow, soft blend edges, muted palette, foreground/mid/background depth |
| Watercolor | Transparent washes, white paper visible, soft pastels, dissolved edges, minimal detail, light/airy/dreamy, white space |

### Current Illustration Weaknesses

1. **Style similarity**: Flux Pro Kontext is one model trying to handle 3 very different styles via prompt alone. The style render instructions differentiate at the prompt level but the model's interpretation is inconsistent.

2. **Character consistency across pages**: Each page generates independently. Despite the character sheet, the model produces variations in outfit, hairstyle, and setting between pages.

3. **Quality check limitations**: The quality check catches gross errors but cannot enforce subtle style consistency. A page might "pass" all 10 criteria while still looking different from other pages in the book.

4. **Photo likeness fidelity**: Kontext model is designed for image editing, not character consistency. It transforms the input photo each time independently, leading to drift.

### Recommended Improvements

1. **Use LoRA fine-tuning**: Train a per-child LoRA adapter on the 3 uploaded photos. Use this adapter for all 8 pages. This ensures consistent character representation.

2. **Style-specific models**: Use different fal.ai models for different styles rather than one model for all.

3. **Seed consistency**: Pass a fixed seed for all pages of one story to reduce random variation.

4. **Reference image chaining**: Use the first generated page as a style reference for subsequent pages (sequential generation with image-to-image reference).

5. **Negative prompts**: Explicitly pass style-specific negatives to the model (currently only in the text prompt, not as a model parameter).

---

## 7. Security Architecture

### Current Security Posture

| Category | Finding | Severity | Status |
|----------|---------|----------|--------|
| API Keys | Supabase anon key in frontend .env | Low | By design (protected by RLS) |
| API Keys | OpenAI + fal.ai keys in edge function env | Safe | Server-side only |
| Storage | Public bucket with open upload | Medium | No file validation |
| Auth | No authentication required | Medium | Session-based isolation |
| RLS | Enabled on all tables | Good | Hierarchical policies |
| Endpoints | Edge function has no JWT verification | Medium | By design for demo |
| Privacy | Child photos stored indefinitely | High | No TTL/deletion policy |
| Injection | AI prompts include user input | Medium | No sanitization layer |

### Detailed Findings

**1. Unvalidated File Uploads (Medium)**
- The storage bucket accepts any file type from any origin
- No server-side validation of MIME type, file size, or content
- An attacker could upload non-image files to the public bucket

**Remediation:**
- Add storage policy restricting to image MIME types
- Add file size limit (5MB max)
- Validate file headers server-side before processing

**2. Session-Based Access Without Auth (Medium)**
- Session ID is a UUID stored in localStorage
- If a user's session ID is guessed/stolen, their stories are accessible
- No rate limiting on session creation or story generation

**Remediation:**
- Add optional authentication layer
- Rate limit story generation per session (max 3/hour)
- Add CAPTCHA before generation trigger

**3. Child Photo Privacy (High)**
- Photos are stored in a public bucket with no TTL
- Public URLs are predictable (UUID-based but enumerable with bucket listing)
- Photos are sent to OpenAI and fal.ai (third-party processing)
- No consent/terms acknowledgment in UI

**Remediation:**
- Switch to private bucket with signed URLs (30-min expiry)
- Add 30-day auto-deletion policy for photos
- Display clear consent + privacy notice before upload
- Add COPPA compliance notice
- Document third-party data processing in privacy policy

**4. Prompt Injection Risk (Medium)**
- User-provided fields (name, favorite_things, themes_to_avoid, family_phrase) are interpolated directly into AI prompts
- A malicious user could inject instructions via these fields

**Remediation:**
- Sanitize user input: strip special characters, limit field lengths
- Add input validation: name max 30 chars, no special characters
- Add a moderation layer (OpenAI Moderation API) before prompt assembly
- Wrap user content in explicit delimiters in prompts

**5. Edge Function Without JWT (Medium)**
- The generate-story function accepts any POST request
- No authentication or rate limiting at the function level
- Could be called directly without the frontend

**Remediation:**
- Add rate limiting via Supabase Edge Function middleware
- Validate that story_id exists and is in 'pending' status
- Add request signing or session validation

---

## 8. Performance & Scalability

### Current Bottlenecks

| Bottleneck | Impact | Typical Duration |
|-----------|--------|-----------------|
| Sequential AI calls (6 steps) | Story text generation | 15-30 seconds |
| Parallel image generation (8 pages) | Illustration pipeline | 30-90 seconds |
| Quality check retries | Additional image generation | +30-60s per retry |
| fal.ai queue wait | Variable queue depth | 5-30 seconds |
| Total end-to-end | User wait time | 60-180 seconds |

### Token Usage Analysis

| Step | Input Tokens (est.) | Output Tokens | Cost (GPT-4o) |
|------|-------------------|---------------|---------------|
| Photo analysis | ~500 + image | ~100 | $0.01 |
| Story Bible | ~3000 | ~2000 | $0.04 |
| Story writing | ~4000 | ~2000 | $0.05 |
| Editorial review | ~5000 | ~2000 | $0.06 |
| Targeted rewrite | ~4000 | ~1000 | $0.04 |
| Character sheet | ~2000 | ~800 | $0.02 |
| Illustration prompts | ~4000 | ~2000 | $0.05 |
| Quality checks (8x) | ~500 + image x8 | ~200 x8 | $0.08 |
| **Total per story** | ~30,000 | ~12,000 | **~$0.35** |

### Scaling Recommendations

**Short-term (Current Architecture):**
1. Cache Story Bible for repeat generations with same profile
2. Skip editorial review for beginner level (simpler text needs less editing)
3. Reduce quality check retries to 1 (from 2) to cut image generation time
4. Use gpt-4o-mini for editorial review and validation (cheaper, faster)

**Medium-term (Queue Architecture):**
```
Frontend -> INSERT story (pending) -> Return immediately

Background Worker:
  Queue (pg_notify or external) -> Pick up pending stories
  -> Process sequentially through pipeline
  -> Update status progressively
  -> Webhook/realtime for frontend notification
```

**Long-term (Production Architecture):**
1. Separate text generation and image generation into independent workers
2. Use Supabase Realtime (websockets) instead of polling
3. Implement job queue (pg_boss, BullMQ, or Inngest)
4. Add CDN caching for generated illustrations
5. Implement story template caching (pre-generate popular theme bibles)

### Browser Performance

| Concern | Current State | Recommendation |
|---------|--------------|----------------|
| Bundle size | 743KB (gzipped 218KB) | Code-split wizard from landing page |
| Image loading | Full-res illustrations | Add srcset with thumbnails |
| Polling | setInterval 2s | Use Supabase Realtime subscription |
| Memory leaks | Object URLs revoked | Good (already handled) |
| Re-renders | Context updates all children | Memoize child components |

---

## 9. Failure & Recovery Flow

### Failure Scenarios

```
[SCENARIO 1: OpenAI API Error]
  generateWithAI() throws
  -> catch block logs error
  -> generateFallbackStory() provides generic story
  -> Fallback story has child's name but generic plot
  -> Illustrations use Pexels stock photos OR fal.ai (if FAL_KEY available)
  -> Story completes with degraded quality

[SCENARIO 2: fal.ai Timeout (single page)]
  Promise.allSettled() catches individual failure
  -> Use fallbackImages[i] for that specific page
  -> Other pages keep their AI-generated illustrations
  -> Story completes with mixed illustration sources

[SCENARIO 3: fal.ai Complete Failure]
  All 8 pages fail -> All use fallback Pexels images
  -> Story still completes with stock illustrations

[SCENARIO 4: Database Insert Failure]
  story_pages INSERT fails
  -> Outer catch catches error
  -> Returns 500 response
  -> Story status remains 'generating' (stuck)
  -> Frontend polls indefinitely (no timeout currently)

[SCENARIO 5: Edge Function Timeout]
  Supabase Edge Functions have 60s default timeout
  -> Function may be killed mid-generation
  -> Story status stuck at 'generating'
  -> No cleanup mechanism

[SCENARIO 6: Frontend Polling Never Resolves]
  Status stays 'generating' forever
  -> User sees infinite loading
  -> No client-side timeout
  -> No recovery path
```

### Current Recovery Gaps

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| No client-side timeout | User stuck forever | Add 5-minute timeout with retry option |
| No stuck story cleanup | DB pollution | Add cron: stories stuck 'generating' > 10min -> 'failed' |
| No partial story support | All or nothing | Allow displaying pages as they generate |
| No error message to user | Silent failure | Show specific error + retry button |
| Fire-and-forget pattern | Lost context | Return generation ID for status tracking |

---

## 10. Future Recommended Architecture

### Production-Grade Architecture

```
+-------------------+     +------------------+     +-------------------+
|    Frontend SPA   |     |   API Gateway    |     |   Job Scheduler   |
|  React + Vite     |<--->|  Supabase Edge   |<--->|   (pg_boss or     |
|  + Realtime sub   |     |  + Rate Limit    |     |    Inngest)       |
+-------------------+     +------------------+     +-------------------+
                                                          |
                          +-------------------------------+
                          |
              +-----------+-----------+
              |           |           |
              v           v           v
     +--------+---+ +----+------+ +--+----------+
     | Text Worker| |Image Worker| |QA Worker    |
     | OpenAI     | | fal.ai    | | Moderation  |
     | Pipeline   | | Pipeline  | | + Review    |
     +--------+---+ +----+------+ +--+----------+
              |           |           |
              +-----------+-----------+
                          |
                          v
              +-----------+-----------+
              |     Supabase DB       |
              |  + Realtime Events    |
              |  + Storage CDN        |
              +-----------------------+
```

### Queue System Design

```
Job Types:
  1. generate_story_text (priority: high)
     - Input: StoryRequest
     - Output: GeneratedStory (text only)
     - Timeout: 60s
     - Retries: 2

  2. generate_illustrations (priority: medium)
     - Input: story_id, pages[], characterSheet, photoUrl
     - Output: illustration URLs
     - Timeout: 180s
     - Retries: 1
     - Parallelism: 8 concurrent per story

  3. quality_check (priority: low)
     - Input: image_url, criteria
     - Output: pass/fail + replacement if needed
     - Timeout: 30s
     - Retries: 1

  4. cleanup_stuck_stories (cron: every 10 minutes)
     - Find stories with status='generating' older than 10 min
     - Set status='failed'
     - Notify user
```

### Moderation Layer

```
Before AI generation:
  1. Scan all user text inputs through OpenAI Moderation API
  2. Check photo through image moderation
  3. Block if any content flagged
  4. Log flagged attempts for review

After AI generation:
  1. Scan generated story text for safety
  2. Verify no forbidden themes introduced
  3. Check illustrations for appropriateness
  4. Block and regenerate if issues found
```

### Analytics & Event Tracking

```
Events to Track:
  - wizard_started (step 1 loaded)
  - photos_uploaded (count, file sizes)
  - profile_completed (fields filled)
  - theme_selected (which theme)
  - generation_started
  - generation_completed (duration)
  - generation_failed (error type)
  - story_viewed (page views, time spent)
  - story_shared
  - story_downloaded
  - return_user (same session_id, new story)
```

### Evaluation & Testing Pipeline

```
Automated Quality Metrics:
  1. Reading level compliance (automated word/sentence counting)
  2. Personalization score (count child-specific mentions per page)
  3. Refrain consistency (automated detection)
  4. Style consistency (CLIP similarity score between pages)
  5. Character similarity (face embedding distance across pages)
  6. User engagement (pages viewed, time on page, re-reads)

A/B Testing Framework:
  - Test different temperature values
  - Test model versions (gpt-4o vs gpt-4o-mini)
  - Test prompt variations
  - Test illustration models
  - Track conversion and engagement per variant
```

---

## Prioritized Engineering Roadmap

### Phase 1: Stability (1-2 weeks)
1. Add client-side generation timeout (5 min) with retry button
2. Add stuck story cleanup cron job
3. Fix edge function timeout (increase to 300s or switch to background task)
4. Add error messages to user on failure
5. Add input sanitization for prompt injection prevention

### Phase 2: Quality (2-4 weeks)
1. Implement LoRA-based character consistency
2. Add sequential image generation with reference chaining
3. Implement Supabase Realtime for progress updates (replace polling)
4. Add moderation layer for safety
5. Implement proper photo privacy (private bucket + signed URLs)

### Phase 3: Scale (1-2 months)
1. Implement job queue (Inngest or pg_boss)
2. Separate text and image workers
3. Add CDN for illustration caching
4. Implement rate limiting and abuse prevention
5. Add optional authentication with saved profiles

### Phase 4: Product (2-3 months)
1. Analytics and event tracking
2. A/B testing framework
3. PDF/print export
4. Multiple stories per child (story library)
5. Subscription model with saved LoRA adapters
6. Email delivery of completed stories

---

## Appendix: Environment Variables

### Frontend (.env)

| Variable | Purpose | Exposure |
|----------|---------|----------|
| VITE_SUPABASE_URL | Database/API endpoint | Public (browser) |
| VITE_SUPABASE_ANON_KEY | Public client key | Public (RLS-protected) |

### Edge Function (Auto-configured)

| Variable | Purpose | Exposure |
|----------|---------|----------|
| SUPABASE_URL | Internal DB URL | Server-only |
| SUPABASE_SERVICE_ROLE_KEY | Admin DB access | Server-only |
| OPENAI_API_KEY | GPT-4o access | Server-only |
| FAL_KEY | fal.ai image generation | Server-only |

---

*End of System Architecture Document*
