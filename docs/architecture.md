# Architecture

## System Identity

**Adventures Of** is a personalized children's storybook generator. Parents upload 1-3 photos of their child, provide age/interests/preferences through a guided wizard, and the system produces an 8-page illustrated storybook where the child is the protagonist -- rendered in a chosen art style with AI-generated narrative and illustrations that preserve the child's facial likeness.

The system is architected as a **stateless SPA** backed by **Supabase** (managed Postgres + Edge Functions + Storage), with **OpenAI** for narrative generation and **fal.ai** for illustration synthesis.

---

## Technology Map

| Concern | Choice | Rationale |
|---------|--------|-----------|
| SPA Framework | React 18 + TypeScript | Type safety, ecosystem maturity, team familiarity |
| Routing | React Router v6 (nested) | Layout persistence during wizard flow via `<Outlet>` |
| Styling | Tailwind CSS 3 | Rapid iteration, design-token consistency, no runtime cost |
| Icons | Lucide React | Tree-shakeable SVG, consistent line weight |
| Bundler | Vite 5 | Sub-second HMR, ESM-native, minimal config |
| Database | Supabase PostgreSQL | Managed Postgres with RLS, realtime, storage in one platform |
| Serverless | Supabase Edge Functions (Deno) | Co-located with DB, zero cold-start penalty for auth bypass |
| Object Storage | Supabase Storage | Integrated auth policies, public URL generation |
| Text AI | OpenAI GPT-4o | Consolidated single-call approach (~$0.07/story), JSON-mode capable, higher creative quality |
| Image AI | fal.ai Flux Pro Kontext | Face-preserving style transfer, queue-based async |
| Fallback Images | Pexels | Royalty-free, no API key required for hotlinking |

---

## High-Level Data Flow

```
                         ┌─────────────────────────────────────────────┐
                         │              Browser (React SPA)             │
                         │                                             │
                         │  WizardContext ─── in-memory form state      │
                         │  supabase-js  ─── REST client + session ID   │
                         └───────┬────────────────┬────────────────────┘
                                 │                │
              Storage Upload     │                │  REST (PostgREST)
              (child-photos)     │                │
                                 ▼                ▼
                         ┌─────────────────────────────────────────────┐
                         │            Supabase Platform                 │
                         │                                             │
                         │  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
                         │  │ Storage │  │ Postgres │  │ Edge Fn   │  │
                         │  │ (photos)│  │ (3 tbls) │  │ generate- │  │
                         │  │         │  │ + RLS    │  │ story     │  │
                         │  └─────────┘  └──────────┘  └─────┬─────┘  │
                         └────────────────────────────────────┼────────┘
                                                              │
                                          ┌───────────────────┼──────────┐
                                          │                   │          │
                                          ▼                   ▼          │
                                   ┌────────────┐    ┌─────────────┐    │
                                   │   OpenAI   │    │   fal.ai    │    │
                                   │   GPT-4o   │    │ Flux Kontext│    │
                                   │ (narrative)│    │ (illust.)   │    │
                                   └────────────┘    └─────────────┘    │
                                                              │          │
                                                              │ writes   │
                                                              ▼          │
                                                      story_pages table  │
                                                      stories.status ────┘
```

---

## Module Decomposition

```
src/
├── main.tsx                         Entry point, React root mount
├── App.tsx                          Route tree, WizardProvider scope
├── index.css                        Tailwind directives + custom utilities
│
├── lib/
│   ├── supabase.ts                  Client singleton, session ID helper
│   └── types.ts                     Shared interfaces (ChildProfile, Story, StoryPage, WizardData)
│
├── context/
│   └── WizardContext.tsx            Multi-step form state (photos, profile, theme)
│
├── components/                      Landing page marketing sections (11 components)
│   ├── Header.tsx                   Fixed nav, scroll-aware bg, mobile menu
│   ├── Hero.tsx                     Value prop, animated shapes, primary CTA
│   ├── TrustStrip.tsx              Social proof stats + logos
│   ├── ProblemSection.tsx          Pain point articulation
│   ├── SolutionSection.tsx         Solution framing
│   ├── HowItWorks.tsx             4-step process visualization
│   ├── Features.tsx                6-card feature grid
│   ├── Testimonials.tsx            Parent quotes + metrics
│   ├── FAQ.tsx                     7-item accordion
│   ├── FinalCTA.tsx                Branded conversion section
│   └── Footer.tsx                  Links, company info
│
├── pages/
│   ├── ArchitectureDoc.tsx          Generates .docx export of system docs
│   └── create/
│       ├── WizardLayout.tsx         Persistent chrome (progress dots, back link)
│       ├── PhotoUpload.tsx          Step 1: Drag-drop image collection
│       ├── ChildProfile.tsx         Step 2: Name/age/interests form
│       ├── ThemeSelection.tsx       Step 3: Theme + illustration style picker
│       ├── StoryGenerating.tsx      Step 4: Orchestrator + progress UI
│       └── StoryReader.tsx          Step 5: Paginated story display

supabase/
├── migrations/
│   ├── 20260518195551_create_story_tables.sql
│   └── 20260518203954_create_photo_storage_bucket.sql
└── functions/
    └── generate-story/
        └── index.ts                 Story + illustration generation pipeline
```

---

## Design Decisions & Tradeoffs

### 1. Anonymous-First Identity (Session UUID)

**Decision**: Users get a UUID stored in localStorage on first visit. No account creation required. All RLS policies accept `session_id` OR `auth.uid()`.

**Tradeoff**: Zero-friction onboarding vs. no cross-device persistence. A user who clears localStorage loses access to their stories.

**Why**: For a demo/MVP product, conversion rate from "interested" to "story created" is the primary metric. Requiring signup before seeing value would kill this metric. The schema already includes `user_id` columns for future auth migration.

**Migration Path**: When auth is added, existing anonymous profiles can be "claimed" by updating `user_id` where `session_id` matches.

### 2. Fire-and-Forget with Polling (Not WebSockets)

**Decision**: The frontend POSTs to the edge function (fire-and-forget), then polls `stories.status` every 2 seconds until `complete` or `failed`.

**Tradeoff**: Polling generates ~15-60 unnecessary requests per story vs. WebSocket push which would notify instantly.

**Why**: 
- Edge functions can run 30-120 seconds (10 fal.ai illustrations in parallel). HTTP long-polling would timeout.
- Supabase Realtime requires channel subscription setup + teardown complexity.
- At current scale (<100 concurrent users), 500 req/min of lightweight SELECTs is trivial for Postgres.
- Polling is stateless and survives page refreshes -- if a user navigates away and comes back, polling resumes naturally.

**When to Migrate**: At >1000 concurrent generations, switch to Supabase Realtime subscriptions on `stories` table filtered by `id`.

### 3. Multi-Tier Fallback Architecture

**Decision**: Every external dependency has a fallback that guarantees story delivery:

```
OpenAI → hardcoded themed stories (personalized with child's name)
fal.ai  → theme-mapped Pexels stock photos (per-page granularity)
```

**Tradeoff**: Fallback stories are generic and not truly personalized. Stock photos don't show the child.

**Why**: The #1 UX failure mode is "I waited 2 minutes and got nothing." A mediocre story is infinitely better than an error screen for a parent who just uploaded their child's photos. The fallback stories are still themed, use the child's name, and provide a complete 8-page reading experience.

**Per-Page Granularity**: Illustration fallback is applied per-page, not all-or-nothing. If fal.ai succeeds for 7/8 pages and fails for 1, only that 1 gets a stock photo. This maximizes personalization.

### 4. Wizard Context (In-Memory Only)

**Decision**: Form state lives in React Context, not localStorage or the database, until the user clicks "Create Story."

**Tradeoff**: State is lost on page refresh mid-wizard.

**Why**: 
- The wizard is 3 screens (photos, profile, theme) -- takes <2 minutes total.
- Persisting File objects to localStorage is impossible (they're not serializable).
- Writing incomplete profiles to the DB creates orphan rows that complicate RLS and cleanup.
- If we stored partial state, we'd need conflict resolution when a user starts a new wizard flow.
- The cost of re-doing 2 minutes of input is acceptable for MVP.

### 5. Theme-Specific World-Building Rules (Not Generic Prompt)

**Decision**: Each theme (dinosaurs, space, enchanted-forest, superhero, fairy-tale) has its own block of world rules including allowed elements, required character types, physical details, AND an explicit prohibition list.

**Tradeoff**: More prompt tokens consumed per request (~200 extra tokens per theme block) vs. a shorter generic prompt.

**Why**: GPT models are "magpies" -- they grab shiny elements from training data. Without explicit prohibitions, an enchanted forest story will sometimes include "a rocket ship landed in the clearing" because the model associates "adventure" with space. The `ABSOLUTELY NO: spaceships, rockets, planets...` line eliminates this cross-contamination entirely. The extra cost is ~$0.0003 per story -- negligible.

### 6. 10-Page Stories with Prescribed Arc Structure

**Decision**: Stories are exactly 8 pages following a rigid emotional arc (WONDER, DELIGHT, EMPATHY, EXCITEMENT, TEAMWORK, TENSION, TRIUMPH, WARMTH).

**Tradeoff**: Less creative freedom for the AI vs. consistent narrative quality.

**Why**: Without structure, GPT produces stories that rush through events or meander without resolution. The prescribed 8-beat arc ensures every story has proper pacing: characters are introduced before they're needed, tension builds before it resolves, and the ending feels earned. This is the single most impactful quality improvement over "just write a story."

### 7. Single Edge Function (Not Microservices)

**Decision**: One function handles text generation, illustration generation (10 parallel requests), and database writes.

**Tradeoff**: Longer execution time (30-120s) in a single function vs. better observability and independent scaling of text vs. image generation.

**Why**:
- Cold-start multiplication: 3 separate functions = 3x cold-start risk.
- Coordination complexity: An orchestrator + workers pattern requires a queue and state machine.
- Error atomicity: If image generation fails, the text function would need to know to use fallbacks. Keeping everything in one function makes the fallback logic simple and linear.
- Supabase Edge Functions scale horizontally -- concurrent requests get independent isolates.

**When to Migrate**: When image generation needs priority queuing or retry logic independent of text generation.

---

## Request Lifecycle (Happy Path)

```
t=0s    User clicks "Create Story" on ThemeSelection
        ├── Upload 1-3 photos to Storage (child-photos/{session}/{uuid}.ext)
        ├── INSERT child_profiles (returns profile.id)
        ├── INSERT stories (status='pending', returns story.id)
        └── POST /functions/v1/generate-story (fire-and-forget)
             Body: { story_id, name, age, interests, theme, photo_urls, ... }

t=0.5s  Frontend navigates to /create/generating
        └── Starts polling: SELECT status FROM stories WHERE id=$1 (every 2s)

t=1s    Edge Function receives request
        ├── UPDATE stories SET status='generating'
        └── POST to OpenAI (story text generation)

t=5-30s OpenAI returns JSON (title + 8 pages with text + illustration_prompts; may include rate limit waits)
        ├── UPDATE stories SET title=$1
        └── Launch 10 parallel fal.ai requests (one per page illustration)

t=15s   fal.ai illustrations start completing (some may take 30s+)
        └── Each completed illustration URL stored in memory

t=30s   All 10 illustrations complete (or fallback to Pexels)
        ├── INSERT 10 rows into story_pages
        └── UPDATE stories SET status='complete', page_count=10

t=32s   Frontend poll detects status='complete'
        └── Navigate to /create/story/{storyId}

t=33s   StoryReader fetches story + story_pages
        └── Renders page 1 with illustration + text
```

---

## Failure Modes & Recovery

| Failure | Detection | Recovery |
|---------|-----------|----------|
| OpenAI API down | HTTP 5xx or timeout | Use hardcoded fallback story template |
| OpenAI returns invalid JSON | JSON.parse throws | Same fallback |
| fal.ai single page fails | Promise.allSettled rejected | Pexels URL for that page only |
| fal.ai all pages fail | All promises rejected | All pages get Pexels fallback |
| fal.ai queue timeout (2 min) | 40 polls x 3s elapsed | Treat as failure, use Pexels |
| Supabase DB write fails | Error propagated | 500 response; story stuck in 'generating' |
| Photo upload fails | Error in StoryGenerating | Navigation blocked, error shown |
| Edge Function crashes | story.status never updates | Frontend polls indefinitely (needs timeout) |
| User refreshes during generation | Context lost, but story_id in URL | Can navigate back to /create/story/:id after completion |

**Known Gap**: No client-side timeout on polling. If the edge function crashes, the user sees a spinner forever. Recommendation: Add a 5-minute ceiling with "something went wrong" fallback UI.

---

## Component Responsibility Matrix

| Component | State Owned | Side Effects | Depends On |
|-----------|-------------|--------------|------------|
| WizardContext | photos, profile data, theme | None | None |
| PhotoUpload | None (reads/writes context) | URL.createObjectURL, URL.revokeObjectURL | WizardContext |
| ChildProfile | Local validation state | None | WizardContext |
| ThemeSelection | None (reads/writes context) | None | WizardContext |
| StoryGenerating | uploadState, progress | Storage upload, DB inserts, edge function call, polling interval | WizardContext, supabase |
| StoryReader | story, pages, currentPage | DB read (story + pages) | supabase, route params |
| Header | scrolled, mobileMenuOpen | scroll event listener | None |
| FAQ | openIndex | None | None |

---

## Security Boundary Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                     PUBLIC BOUNDARY                           │
│                                                             │
│  Frontend code (minified JS)                                │
│  ├── VITE_SUPABASE_URL (public, by design)                  │
│  ├── VITE_SUPABASE_ANON_KEY (public, gated by RLS)          │
│  └── Session UUID (client-generated, unguessable)           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     RLS BOUNDARY                             │
│                                                             │
│  PostgREST (Supabase)                                       │
│  ├── anon role can only access rows matching session_id      │
│  ├── Cannot read other users' profiles/stories              │
│  └── Cannot write to story_pages (service role only)        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     TRUSTED BOUNDARY                         │
│                                                             │
│  Edge Function (Deno isolate)                               │
│  ├── SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)               │
│  ├── OPENAI_API_KEY (billed to account)                     │
│  └── FAL_KEY (billed to account)                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Critical**: API keys for OpenAI and fal.ai are currently hardcoded in `supabase/functions/generate-story/index.ts`. These should be migrated to Supabase Edge Function Secrets before any public deployment.

---

## Performance Characteristics

| Operation | Latency | Bottleneck |
|-----------|---------|-----------|
| Photo upload (3 images) | 2-5s | Network bandwidth |
| DB inserts (profile + story) | <200ms | Supabase REST |
| OpenAI text generation | 3-8s | Model inference |
| fal.ai single illustration | 8-20s | GPU queue depth |
| fal.ai 10 illustrations (parallel) | 15-45s | Longest single image |
| Total generation (happy path) | 20-50s | fal.ai queue |
| Frontend poll overhead | ~15-25 requests | 2s interval x generation time |
| Story reader page fetch | <500ms | Single DB query |

---

## Cost Model

| Resource | Per Story | Monthly (1K stories) |
|----------|-----------|---------------------|
| OpenAI GPT-4o (4K tokens out) | ~$0.07 | $70 |
| fal.ai Flux Kontext (10 images) | ~$0.20 | $200 |
| Supabase (Pro plan) | included | $25 |
| Storage (3 photos x 3MB) | negligible | <$1 |
| **Total** | **~$0.20** | **~$228** |

fal.ai dominates cost. Optimization levers: fewer illustrations per story (7-8 instead of 10), cheaper model for background-only pages, or client-side image caching for re-reads.
