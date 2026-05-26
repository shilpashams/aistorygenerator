# Technical Architecture Document

## Adventures Of... - AI Children's Storybook Platform

**Version:** 2.0  
**Date:** 2026-05-20  
**Status:** Production  
**Audience:** Senior Engineers, AI Architects, Technical Investors

---

## Executive Summary

Adventures Of... is an AI-powered children's storybook platform that generates personalized 8-page illustrated picture books for children ages 3-7. The system combines a multi-step AI text generation pipeline (GPT-4o) with AI image generation (fal.ai Flux Pro Kontext) to produce stories that feature the child as the protagonist with their likeness composited into custom illustrations.

The architecture follows a serverless-first approach: React SPA frontend, Supabase (PostgreSQL + Auth + Storage + Edge Functions) backend, and external AI APIs for content generation. No user authentication is required -- sessions are tracked via anonymous UUIDs stored in localStorage.

---

## 1. Product Overview

### 1.1 Purpose

Create hyper-personalized children's picture books where:
- The child IS the hero (their name, personality, interests drive the plot)
- Illustrations feature the child's actual likeness (via photo-to-illustration AI)
- Stories are age-appropriate, read-aloud-quality, and emotionally engaging
- Parents receive a complete 8-page book in ~2-3 minutes

### 1.2 User Flow

```
Landing Page -> Upload Photos -> Fill Child Profile -> Choose Theme/Style -> Generate -> Read Story
```

1. **Landing Page** (`/`) - Marketing, social proof, CTA
2. **Photo Upload** (`/create/photos`) - 1-3 photos of the child
3. **Child Profile** (`/create/profile`) - Name, age, interests, personality details
4. **Theme Selection** (`/create/theme`) - Story world + illustration style
5. **Story Generation** (`/create/generating`) - AI pipeline executes, progress displayed
6. **Story Reader** (`/create/story/:storyId`) - Paginated book view with illustrations

### 1.3 Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| No authentication | Reduces friction for demo/MVP; session-based access via UUID |
| Serverless edge function | Single function handles entire pipeline; avoids cold-start chaining |
| Sequential AI steps | Story Bible -> Story Text -> Editorial Review -> Illustration Prompts -> Image Gen |
| Public storage bucket | Edge function needs direct URL access to photos for AI vision |
| Polling for completion | Fire-and-forget edge function call + client polls DB for status |

---

## 2. Current Tech Stack

### 2.1 Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 18.3.1 |
| Routing | react-router-dom | 6.30.3 |
| Build Tool | Vite | 5.4.2 |
| Styling | Tailwind CSS | 3.4.1 |
| Icons | Lucide React | 0.344.0 |
| Language | TypeScript | 5.5.3 |
| State Management | React Context (WizardContext) | - |
| Document Export | docx + file-saver | 9.6.1 / 2.0.5 |

### 2.2 Backend

| Layer | Technology | Details |
|-------|-----------|---------|
| Database | Supabase PostgreSQL | Hosted, managed |
| Edge Functions | Supabase Edge Functions (Deno) | Single function: `generate-story` |
| File Storage | Supabase Storage | `child-photos` bucket (public) |
| Auth | None (session-based) | UUID in localStorage |

### 2.3 External AI Services

| Service | Model | Purpose |
|---------|-------|---------|
| OpenAI | GPT-4o | Story Bible, Story Text, Editorial Review, Illustration Prompts, Photo Analysis |
| fal.ai | flux-pro/kontext/max | Photo-to-illustration generation |

### 2.4 Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `VITE_SUPABASE_URL` | `.env` (client) | Frontend Supabase connection |
| `VITE_SUPABASE_ANON_KEY` | `.env` (client) | Frontend Supabase auth |
| `OPENAI_API_KEY` | Edge Function secrets | GPT-4o API access |
| `FAL_KEY` | Edge Function secrets | fal.ai API access |
| `SUPABASE_URL` | Auto-injected (edge) | Backend Supabase connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected (edge) | Backend admin access |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
+-------------------+        +-------------------+        +-------------------+
|                   |        |                   |        |                   |
|   React SPA       | -----> |   Supabase        | -----> |   External APIs   |
|   (Vite/TS)       |        |   Platform        |        |                   |
|                   |        |                   |        |                   |
+-------------------+        +-------------------+        +-------------------+
        |                           |                            |
        |                    +------+------+              +------+------+
        |                    |      |      |              |             |
        v                    v      v      v              v             v
   Browser              Postgres  Storage  Edge       OpenAI         fal.ai
   localStorage         (RLS)    (Photos)  Functions  (GPT-4o)       (Flux Pro)
```

### 3.2 Component Responsibilities

**Frontend:**
- Wizard flow management (Context + Router)
- Photo upload to Supabase Storage
- Child profile & story record creation
- Edge function invocation (fire-and-forget)
- Polling for story completion status
- Paginated story reader with illustrations

**Backend (Edge Function):**
- Photo analysis (GPT-4o Vision)
- Story Bible generation
- Story text generation
- Editorial quality review
- Illustration prompt generation
- Image generation via fal.ai
- Database persistence of results
- Fallback content if AI fails

---

## 4. Application Flow

### 4.1 Photo Upload Flow

```
User selects files -> Client validates (image/*, max 3)
  -> Files stored in WizardContext state
  -> Preview URLs created via URL.createObjectURL()
  -> Actual upload deferred to generation step
```

### 4.2 Child Profile Creation

```
User fills form -> Validated client-side (name required, age 2-12, 1+ interest, mood required)
  -> Stored in WizardContext state
  -> No DB write until generation begins
```

### 4.3 Story Generation (Complete Flow)

```
1. Client: Upload photos to Supabase Storage (child-photos bucket)
2. Client: INSERT child_profiles record
3. Client: INSERT stories record (status: 'pending')
4. Client: POST to edge function (fire-and-forget)
5. Client: Begin polling stories.status every 2s
6. Edge:   UPDATE stories.status = 'generating'
7. Edge:   Step 0 - Analyze photo (GPT-4o Vision)
8. Edge:   Step 1 - Generate Story Bible (GPT-4o, temp 0.7, 2048 tokens)
9. Edge:   Step 2 - Write Story Text (GPT-4o, temp 0.7, 2048 tokens)
10. Edge:  Step 2b - Editorial Review (GPT-4o, temp 0.4, 2048 tokens)
11. Edge:  Step 3 - Generate Illustration Prompts (GPT-4o, temp 0.7, 3000 tokens)
12. Edge:  Step 4 - Generate 8 illustrations (fal.ai, parallel)
13. Edge:  INSERT story_pages (8 records)
14. Edge:  UPDATE stories.status = 'complete'
15. Client: Poll detects 'complete', navigate to reader
```

### 4.4 Failure Handling

| Failure Point | Handling |
|---------------|----------|
| Photo upload fails | Skip that photo, continue with remaining |
| OpenAI API unavailable | Fall back to pre-written theme-specific stories |
| OpenAI returns invalid JSON | Exception caught, fallback story used |
| fal.ai fails for a page | Per-page catch, use Pexels fallback image |
| fal.ai times out (120s) | Throw after 40 attempts x 3s, use fallback |
| Edge function crashes | Client poll sees no status change; stays on generating screen |
| Editorial review fails to parse | Original story text used (graceful degradation) |

### 4.5 Retry Logic

- **fal.ai polling**: Up to 40 attempts with 3-second intervals (2 minutes max per image)
- **Client polling**: Every 2 seconds indefinitely until status changes
- **No retry on OpenAI failures**: Single attempt, then fallback to static content

---

## 5. AI Pipeline

### 5.1 Pipeline Overview

```
Photo Analysis (Vision) -> Story Bible -> Story Text -> Editorial Review -> Illustration Prompts -> Image Generation
         |                      |               |              |                    |                      |
     GPT-4o Vision          GPT-4o          GPT-4o         GPT-4o              GPT-4o              fal.ai Flux
     temp: 0.3              temp: 0.7       temp: 0.7      temp: 0.4           temp: 0.7            Kontext Max
     tokens: 200            tokens: 2048    tokens: 2048   tokens: 2048        tokens: 3000
```

### 5.2 Step 0: Photo Analysis

**Purpose:** Extract safe visual details (clothing, hairstyle, accessories) for illustration consistency.

**Model:** GPT-4o (Vision)  
**Temperature:** 0.3  
**Max Tokens:** 200  
**Input:** Single photo URL (first uploaded)  
**Output:** 2-3 sentence description of child's appearance (clothing/hair only)

**System Prompt:** Strict safety guardrails - NEVER describes race, ethnicity, skin color, weight, facial features, or identity. Only hairstyle, clothing, accessories.

**Example Output:** "The child has curly shoulder-length hair with a yellow bow. They are wearing a green t-shirt with a dinosaur on it and red sneakers."

### 5.3 Step 1: Story Bible

**Purpose:** Create a comprehensive creative blueprint ensuring story consistency, emotional depth, and deep personalization.

**Model:** GPT-4o  
**Temperature:** 0.7  
**Max Tokens:** 2048  
**Output Format:** Structured JSON

**Story Bible JSON Schema:**
```json
{
  "title": "string",
  "main_character": {
    "name": "string",
    "personality": "string",
    "child_specific_details": "string",
    "age_appropriate_strength": "string"
  },
  "sidekick": {
    "name": "string",
    "species_or_type": "string",
    "appearance": "string",
    "personality_trait": "string",
    "voice": "string"
  },
  "story_world": {
    "setting": "string",
    "magical_object": "string",
    "sensory_details": "string",
    "rules": "string"
  },
  "emotional_core": {
    "child_strength": "string",
    "small_fear": "string",
    "recurring_phrase": "string",
    "emotional_arc": "string"
  },
  "page_outline": [
    {"page": 1, "beat": "WONDER", "one_line": "string"},
    {"page": 2, "beat": "DELIGHT", "one_line": "string"},
    {"page": 3, "beat": "EMPATHY", "one_line": "string"},
    {"page": 4, "beat": "EXCITEMENT", "one_line": "string"},
    {"page": 5, "beat": "TEAMWORK", "one_line": "string"},
    {"page": 6, "beat": "TENSION", "one_line": "string"},
    {"page": 7, "beat": "TRIUMPH", "one_line": "string"},
    {"page": 8, "beat": "WARMTH", "one_line": "string"}
  ],
  "illustration_notes": {
    "child_depiction": "string",
    "child_visual_in_story": "string",
    "sidekick_visual": "string",
    "color_palette": "string",
    "lighting_mood": "string"
  }
}
```

**Key Personalization Inputs:**
- Child's name, age, interests, favorite things, favorite toy
- Nickname, family phrase, what they're proud of, what they're learning
- Themes to avoid, story mood selection
- Visual details from photo analysis
- Age-calibrated problem-solving complexity
- Theme-specific world seeds with sensory palettes

### 5.4 Step 2: Story Text

**Purpose:** Write the 8-page story text following the Story Bible exactly.

**Model:** GPT-4o  
**Temperature:** 0.7  
**Max Tokens:** 2048  
**Output Format:** JSON with title and 8 pages (text only, no illustration prompts)

**Writing Rules Enforced:**
- EXACTLY 8 pages, 2-3 sentences each
- Simple vocabulary (4-year-old comprehension)
- Read-aloud rhythm (alliteration, repetition, cadence)
- Recurring phrase on 3+ pages
- One visual moment per page
- One onomatopoeia per page minimum
- Follow page_outline beats exactly

### 5.5 Step 2b: Editorial Review

**Purpose:** Quality assurance pass that checks and revises story text against 8 criteria.

**Model:** GPT-4o  
**Temperature:** 0.4 (lower for consistency)  
**Max Tokens:** 2048  
**Input:** Story Bible + draft pages  
**Output:** Revised pages JSON

**8 Review Criteria:**
1. Age appropriateness (vocabulary, sentence length, concrete concepts)
2. Emotional arc (wonder -> delight -> empathy -> excitement -> teamwork -> tension -> triumph -> warmth)
3. Repetition & refrain (recurring phrase on 3+ pages)
4. Read-aloud rhythm (musicality, onomatopoeia, varied sentence length)
5. Safety (no scary content, no violence, no anxiety triggers)
6. No generic filler (every line specific to THIS story)
7. Child personalization (interests as actions, toy present, nickname used)
8. Page-to-page consistency (names, voice, objects, setting, tone)

### 5.6 Step 3: Illustration Prompts

**Purpose:** Generate precise, consistent image generation prompts using full context.

**Model:** GPT-4o  
**Temperature:** 0.7  
**Max Tokens:** 3000  
**Input:** Story Bible + final edited page text + art style + child character sheet

**Prompt Requirements:**
- One clear action moment per page matching emotional beat
- Exact visual details from Story Bible (sidekick, palette, lighting)
- Child appears on every page with consistent character sheet details
- Sidekick appears on every page matching exact description
- Background with depth (foreground action, background setting)
- No text/words/letters in scene
- Emotional tone direction
- Body language and facial expression
- Camera angle / framing
- Art style suffix appended

### 5.7 Step 4: Image Generation

**Provider:** fal.ai  
**Model:** flux-pro/kontext/max  
**Method:** Queue-based with polling

**Parameters:**
```json
{
  "prompt": "[constructed from illustration_prompt + style + theme + photo-to-illustration instruction]",
  "image_url": "[child's uploaded photo URL]",
  "output_format": "jpeg",
  "aspect_ratio": "4:3",
  "safety_tolerance": "6",
  "num_images": 1
}
```

**Key Behavior:**
- All 8 pages generated in parallel via `Promise.allSettled`
- Per-page fallback to Pexels stock images on failure
- 40-attempt polling with 3-second intervals per image
- Synchronous result available if fal.ai returns immediately

### 5.8 Context/Memory Strategy

The pipeline uses **forward-context passing** (no persistent memory):
- Photo analysis output feeds into Story Bible prompt
- Story Bible (full JSON string) feeds into Story Text, Editorial Review, and Illustration Prompts
- Edited page text feeds into Illustration Prompts
- Child visual details feed into Illustration Prompts

This ensures consistency without needing conversation memory or embeddings.

### 5.9 Consistency Strategy

1. **Story Bible as single source of truth** - All subsequent steps reference the same bible
2. **Child character sheet** - Photo analysis output repeated in every illustration prompt
3. **Sidekick visual description** - Stored in bible, required in every illustration
4. **Color palette** - Defined once in bible, enforced in illustration prompts
5. **Editorial review** - Catches inconsistencies between pages

---

## 6. Database Schema

### 6.1 Tables

#### `child_profiles`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| name | text | '' | Child's first name |
| age | integer | 5 | Child's age (2-12) |
| interests | text[] | '{}' | Array of interest strings |
| favorite_things | text | '' | Color, animal, food |
| themes_to_avoid | text | '' | Excluded themes |
| reading_level | text | 'beginner' | beginner/intermediate |
| photo_urls | text[] | '{}' | Public URLs to stored photos |
| session_id | text | '' | Anonymous session UUID |
| user_id | uuid | NULL | FK to auth.users (unused) |
| created_at | timestamptz | now() | Creation timestamp |

#### `stories`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| child_profile_id | uuid | - | FK to child_profiles |
| title | text | '' | Generated story title |
| theme | text | '' | superhero/fairy-tale |
| illustration_style | text | 'watercolor' | watercolor/cartoon/storybook |
| status | text | 'pending' | pending/generating/complete/failed |
| page_count | integer | 0 | Number of pages |
| created_at | timestamptz | now() | Creation timestamp |

#### `story_pages`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | uuid | gen_random_uuid() | Primary key |
| story_id | uuid | - | FK to stories |
| page_number | integer | 1 | Page position (1-8) |
| text_content | text | '' | Story text for this page |
| illustration_url | text | '' | URL to generated/fallback image |
| created_at | timestamptz | now() | Creation timestamp |

### 6.2 Relationships

```
child_profiles (1) ---> (many) stories ---> (many) story_pages
```

### 6.3 Indexes

| Index | Table | Columns |
|-------|-------|---------|
| idx_child_profiles_session_id | child_profiles | session_id |
| idx_child_profiles_user_id | child_profiles | user_id |
| idx_stories_child_profile_id | stories | child_profile_id |
| idx_stories_status | stories | status |
| idx_story_pages_story_id | story_pages | story_id |
| idx_story_pages_page_number | story_pages | (story_id, page_number) |

### 6.4 Row Level Security (RLS)

All tables have RLS enabled. Access is granted via session_id header matching OR authenticated user_id matching:

- **child_profiles**: SELECT/UPDATE by session owner; INSERT open
- **stories**: SELECT/INSERT/UPDATE by session owner (via child_profiles join)
- **story_pages**: SELECT/INSERT by session owner (via stories + child_profiles join)

### 6.5 Storage

| Bucket | Name | Public | Policies |
|--------|------|--------|----------|
| child-photos | child-photos | Yes | INSERT: anyone; SELECT: anyone |

---

## 7. Codebase Structure

```
project/
├── index.html                          # SPA entry point
├── package.json                        # Dependencies & scripts
├── vite.config.ts                      # Vite build config
├── tailwind.config.js                  # Tailwind theme extensions
├── tsconfig.app.json                   # TypeScript config
├── .env                                # Client env vars (VITE_SUPABASE_*)
│
├── src/
│   ├── main.tsx                        # React entry, mounts App
│   ├── App.tsx                         # Router + provider setup
│   ├── index.css                       # Tailwind imports + custom styles
│   ├── vite-env.d.ts                   # Vite type declarations
│   │
│   ├── lib/
│   │   ├── supabase.ts                 # Supabase client singleton + session ID
│   │   └── types.ts                    # Shared TypeScript interfaces
│   │
│   ├── context/
│   │   └── WizardContext.tsx           # Multi-step form state (React Context)
│   │
│   ├── components/                     # Landing page components
│   │   ├── Header.tsx                  # Navigation header
│   │   ├── Hero.tsx                    # Hero section with CTA
│   │   ├── TrustStrip.tsx             # Social proof strip
│   │   ├── ProblemSection.tsx         # Problem statement
│   │   ├── SolutionSection.tsx        # Solution presentation
│   │   ├── HowItWorks.tsx            # 3-step explanation
│   │   ├── Features.tsx               # Feature grid
│   │   ├── Testimonials.tsx           # User testimonials
│   │   ├── FAQ.tsx                    # Accordion FAQ
│   │   ├── FinalCTA.tsx              # Bottom CTA
│   │   └── Footer.tsx                 # Footer links
│   │
│   └── pages/
│       ├── ArchitectureDoc.tsx         # In-app architecture viewer
│       └── create/                     # Story creation wizard
│           ├── WizardLayout.tsx        # Shared layout + step indicator
│           ├── PhotoUpload.tsx         # Step 1: Photo upload
│           ├── ChildProfile.tsx        # Step 2: Child details form
│           ├── ThemeSelection.tsx      # Step 3: Theme + style picker
│           ├── StoryGenerating.tsx     # Step 4: Loading/progress screen
│           └── StoryReader.tsx         # Step 5: Paginated book reader
│
├── supabase/
│   ├── migrations/
│   │   ├── 20260518195551_create_story_tables.sql    # Core tables
│   │   └── 20260518203954_create_photo_storage_bucket.sql  # Storage
│   └── functions/
│       └── generate-story/
│           └── index.ts                # Main AI generation pipeline (837 lines)
│
└── docs/                              # Documentation
    ├── TECHNICAL_ARCHITECTURE.md      # This document
    ├── SYSTEM_FLOW_DIAGRAM.md         # Mermaid diagrams
    ├── DATABASE_SCHEMA.md             # Detailed schema docs
    ├── AI_PIPELINE.md                 # AI pipeline deep-dive
    └── [legacy docs]                  # Previous documentation
```

---

## 8. Security Review

### 8.1 Findings

| Category | Finding | Severity | Status |
|----------|---------|----------|--------|
| API Keys | OpenAI/fal.ai stored as edge function secrets (not in code) | OK | Secure |
| Client Env | VITE_SUPABASE_ANON_KEY exposed (by design, public-facing) | Low | Acceptable |
| Storage | child-photos bucket is public (anyone can read) | Medium | Intentional for MVP |
| RLS | INSERT policy on child_profiles uses `WITH CHECK (true)` | Medium | Demo mode tradeoff |
| Session | Session ID stored in localStorage, passed as header | Medium | No auth = no identity verification |
| Edge Function | No JWT verification (`verify_jwt: false`) | Medium | Required for anonymous access |
| Photo Privacy | Child photos stored in public bucket | High | Should be private with signed URLs |
| Prompt Injection | User inputs (name, interests, etc.) injected into prompts | Medium | No sanitization layer |
| CORS | Wildcard `*` origin allowed | Low | Acceptable for MVP |

### 8.2 Child Safety Measures

- Photo analysis explicitly blocks extraction of race, ethnicity, skin color, weight
- Story content goes through editorial review checking for scary/unsafe content
- fal.ai safety_tolerance set to 6 (moderate filtering)
- Themes-to-avoid respected in story generation

### 8.3 Recommendations

1. Move child-photos to private bucket with signed URLs
2. Add input sanitization layer before prompt construction
3. Implement rate limiting on edge function
4. Add JWT verification with anonymous auth for session tracking
5. Add content moderation layer on generated text (before display)

---

## 9. Performance Analysis

### 9.1 Bottlenecks

| Bottleneck | Impact | Cause |
|------------|--------|-------|
| Sequential AI calls (5 steps) | ~30-45s total generation | Each step depends on previous output |
| 8 parallel fal.ai calls | ~30-60s per image | Queue-based, variable load |
| Total generation time | ~2-3 minutes | Sequential text + parallel images |
| Edge function timeout risk | Potential 60s timeout | Long-running sequential operations |

### 9.2 Token Usage Per Story

| Step | Input Tokens (est.) | Output Tokens (est.) | Cost (GPT-4o) |
|------|--------------------:|---------------------:|------:|
| Photo Analysis | ~300 | ~100 | $0.003 |
| Story Bible | ~1,500 | ~1,500 | $0.030 |
| Story Text | ~2,500 | ~800 | $0.028 |
| Editorial Review | ~3,500 | ~800 | $0.035 |
| Illustration Prompts | ~3,000 | ~2,000 | $0.045 |
| **Total** | **~10,800** | **~5,200** | **~$0.14** |

### 9.3 Scaling Concerns

- No queue system; edge function handles entire pipeline synchronously
- No caching of Story Bible for re-generation
- Parallel fal.ai calls could hit rate limits at scale
- No deduplication of identical requests
- Supabase edge function has execution time limits

### 9.4 Frontend Performance

- Single large JS bundle (743KB) could be code-split
- No image lazy loading in story reader
- Polling uses setInterval (not cleaned up on unmount in some paths)
- WizardContext re-renders all children on any state change

---

## 10. Quality Issues

### 10.1 Why Stories May Feel Generic

1. **Temperature 0.7** for all creative steps may not be varied enough
2. **Fallback stories** are completely static (hardcoded per theme)
3. **Single editorial pass** may not catch all issues
4. **No A/B testing** of prompt variants
5. **Generic world seeds** shared across all children in same theme

### 10.2 Prompt Weaknesses

- Story Bible prompt is ~3000 tokens (approaching attention dilution)
- No few-shot examples provided to the model
- Personalization instructions compete with structural format requirements
- Family phrase / nickname may be ignored when prompt is long

### 10.3 Narrative Consistency Issues

- No validation that recurring phrase actually appears 3+ times in output
- No check that sidekick name is consistent across pages
- Editorial review is advisory (no programmatic enforcement)

### 10.4 Illustration Consistency

- Each page's illustration is generated independently (no reference to previous pages)
- fal.ai has no concept of "same character" across images
- Art style consistency depends entirely on prompt text
- Child's likeness quality varies with photo quality and angle

### 10.5 Personalization Gaps

- Only first photo is used (others are uploaded but ignored)
- Reading level selection doesn't demonstrably affect output
- No feedback loop (parent can't say "make it more silly")

---

## 11. Recommended Architecture

### 11.1 Ideal AI Pipeline (Future State)

```
Photo Analysis
     |
     v
Story Bible Generation (with few-shot examples)
     |
     v
Story Text Generation (page-by-page with context window)
     |
     v
Editorial Review (with programmatic validation)
     |
     v
Illustration Prompts (with character reference sheet)
     |
     v
Character Reference Image Generation (1 consistent ref)
     |
     v
Per-Page Illustration (using character ref + page prompt)
     |
     v
Quality Check (automated scoring)
     |
     v
Delivery
```

### 11.2 Consistency Layer

- Generate a single "character reference image" first
- Use that as reference for all 8 page illustrations
- Implement embedding-based similarity check between generated images
- Store Story Bible for re-generation without re-planning

### 11.3 Moderation Layer

- Pre-generation: Sanitize all user inputs
- Post-generation: Score text against safety criteria
- Post-illustration: Run moderation API on generated images
- Block and regenerate if any check fails

### 11.4 Background Job System

```
Client -> API (creates job) -> Queue (Redis/Supabase Realtime)
                                    |
                              Worker (picks up job)
                                    |
                              AI Pipeline Steps
                                    |
                              Progress Updates (Realtime)
                                    |
                              Client receives updates
```

### 11.5 Caching Strategy

- Cache Story Bibles by (child_profile_id + theme + mood) for re-generation
- Cache photo analysis results by photo hash
- Cache illustration prompts when only style changes
- CDN-cache generated illustrations (immutable URLs)

---

## 12. Prioritized Roadmap

### Critical Fixes (Week 1)

1. Move child-photos to private bucket with signed URLs
2. Add input length limits and basic sanitization
3. Add edge function timeout handling with partial save
4. Fix story status to 'failed' when edge function errors
5. Add rate limiting (per session, per minute)

### Short-Term Improvements (Weeks 2-4)

1. Implement programmatic validation (refrain count, name consistency)
2. Add Supabase Realtime for progress updates (replace polling)
3. Generate character reference image before page illustrations
4. Add re-generation capability (re-roll with same bible)
5. Use all uploaded photos (not just first)
6. Code-split frontend bundle
7. Add image lazy loading in reader
8. Implement retry logic for OpenAI failures

### Long-Term Scalability (Months 2-3)

1. Background job queue (separate worker from HTTP handler)
2. A/B test prompt variants with quality scoring
3. Parent feedback loop ("more silly", "less scary")
4. PDF export with proper layout
5. Multi-language support
6. User accounts with story library
7. Webhook-based fal.ai integration (vs polling)
8. Implement embedding-based illustration consistency scoring
9. Add voice narration (TTS)
10. Implement subscription/payment model

---

## Appendix A: API Endpoints

### Edge Function: `generate-story`

**URL:** `POST {SUPABASE_URL}/functions/v1/generate-story`  
**Auth:** Bearer token (anon key)  
**JWT Verification:** Disabled

**Request Body:**
```typescript
{
  story_id: string;
  child_profile_id: string;
  name: string;
  age: number;
  interests: string[];
  favorite_things: string;
  themes_to_avoid: string;
  reading_level: string;
  theme: string;
  illustration_style: string;
  photo_urls: string[];
  favorite_toy: string;
  nickname: string;
  proud_of: string;
  currently_learning: string;
  story_mood: string;
  family_phrase: string;
}
```

**Response (Success):**
```json
{
  "success": true,
  "story_id": "uuid",
  "title": "Story Title"
}
```

**Response (Error):**
```json
{
  "error": "Error message"
}
```

---

## Appendix B: Supported Themes & Styles

### Themes
| ID | Label | World Description |
|----|-------|-------------------|
| superhero | Superhero Quest | Vibrant city with heroic characters |
| fairy-tale | Fairy Tale Kingdom | Whimsical kingdom with castles and dragons |

### Illustration Styles
| ID | Label | Description |
|----|-------|-------------|
| watercolor | Watercolor | Soft washes, dreamy colors |
| cartoon | Cartoon | Bold outlines, vivid colors |
| storybook | Classic Storybook | Warm, detailed traditional artwork |

### Story Moods
| ID | Label | Tone |
|----|-------|------|
| bedtime-calm | Bedtime Calm | Gentle, soothing, wind-down |
| silly-adventure | Silly Adventure | Giggly, goofy, surprising |
| bravery | Bravery | Courageous, overcoming fears |
| friendship | Friendship | Connection, sharing, teamwork |
| confidence | Confidence | Self-belief, trying new things |
| curiosity | Curiosity | Exploring, asking, discovering |
