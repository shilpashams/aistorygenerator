# System Diagrams

## 1. User Journey (End-to-End Flow)

```
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Landing  │───▶│ Photo Upload │───▶│ Child Profile│───▶│Theme & Style │
│ Page     │    │ (1-3 images) │    │ (name, age,  │    │ Selection    │
│          │    │              │    │  interests)  │    │              │
│ /        │    │ /create/     │    │ /create/     │    │ /create/     │
│          │    │ photos       │    │ profile      │    │ theme        │
└──────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                               │
            ┌──────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────┐    ┌──────────────────┐
│ Story Generating │───▶│  Story Reader    │
│                  │    │                  │
│ • Upload photos  │    │ • 8-page story   │
│ • Create profile │    │ • Navigation     │
│ • Trigger AI     │    │ • Illustrations  │
│ • Poll status    │    │                  │
│                  │    │ /create/story/   │
│ /create/         │    │ :storyId         │
│ generating       │    │                  │
└──────────────────┘    └──────────────────┘
```

---

## 2. Edge Function Execution Sequence

```
Frontend                    Edge Function                 OpenAI                  fal.ai
   │                            │                          │                       │
   │── POST /generate-story ──▶│                          │                       │
   │   {story_id, name, ...}   │                          │                       │
   │                            │                          │                       │
   │                            │── UPDATE stories ────────────────────────────────│
   │                            │   status='generating'    │                       │
   │                            │                          │                       │
   │                            │── POST /v1/chat/completions ─▶│                  │
   │                            │   {model, messages, temp}│                       │
   │                            │                          │                       │
   │                            │◀── JSON response ────────│                       │
   │                            │   {title, pages[10]}     │                       │
   │                            │                          │                       │
   │                            │── UPDATE stories ────────────────────────────────│
   │                            │   title=$title           │                       │
   │                            │                          │                       │
   │                            │── POST /queue (page 1) ──────────────────────────▶│
   │                            │── POST /queue (page 2) ──────────────────────────▶│
   │                            │── POST /queue (page 3) ──────────────────────────▶│
   │                            │   ... (10 parallel) ...  │                       │
   │                            │── POST /queue (page 10) ─────────────────────────▶│
   │                            │                          │                       │
   │                            │◀── {status_url, response_url} x10 ───────────────│
   │                            │                          │                       │
   │                            │── GET status_url ────────────────────────────────▶│
   │                            │◀── {status: "IN_QUEUE"} ─────────────────────────│
   │                            │                          │                       │
   │                            │    ... poll every 3s ... │                       │
   │                            │                          │                       │
   │                            │── GET status_url ────────────────────────────────▶│
   │                            │◀── {status: "COMPLETED"} ────────────────────────│
   │                            │                          │                       │
   │                            │── GET response_url ──────────────────────────────▶│
   │                            │◀── {images: [{url}]} ────────────────────────────│
   │                            │                          │                       │
   │                            │── INSERT story_pages ────────────────────────────│
   │                            │   (10 rows)              │                       │
   │                            │                          │                       │
   │                            │── UPDATE stories ────────────────────────────────│
   │                            │   status='complete'      │                       │
   │                            │   page_count=10          │                       │
   │                            │                          │                       │
   │◀── 200 {success: true} ───│                          │                       │
   │                            │                          │                       │
```

---

## 3. Frontend Orchestration (StoryGenerating Component)

```
StoryGenerating.tsx
        │
        │  ① Upload photos (parallel per file)
        │     for each photo:
        │       POST storage/v1/object/child-photos/{session}/{uuid}.ext
        │       GET storage/v1/object/public/child-photos/{path}
        │     result: string[] of public URLs
        │
        │  ② Insert child profile
        │     POST rest/v1/child_profiles
        │     body: { name, age, interests, ..., photo_urls, session_id }
        │     result: { id: profile_uuid }
        │
        │  ③ Insert story (pending)
        │     POST rest/v1/stories
        │     body: { child_profile_id, theme, illustration_style, status: 'pending' }
        │     result: { id: story_uuid }
        │
        │  ④ Trigger generation (fire & forget)
        │     POST functions/v1/generate-story
        │     body: { story_id, child_profile_id, name, age, interests, theme, photo_urls }
        │     result: 200 (don't wait for completion)
        │
        │  ⑤ Poll for completion
        │     loop every 2s:
        │       GET rest/v1/stories?id=eq.{story_id}&select=status,title,page_count
        │       if status === 'complete' → break
        │       if status === 'failed' → break
        │
        │  ⑥ Navigate to reader
        │     router.navigate(/create/story/{story_id})
        │
        ▼
StoryReader.tsx
        │
        │  Fetch: GET rest/v1/stories?id=eq.{story_id}
        │  Fetch: GET rest/v1/story_pages?story_id=eq.{story_id}&order=page_number
        │  Display: paginated story with illustrations
        │
        ▼
     [End]
```

---

## 4. Database Entity Relationships

```
┌─────────────────────────────────┐
│         child_profiles           │
├─────────────────────────────────┤
│ PK  id              uuid        │
│     name            text        │
│     age             integer     │
│     interests       text[]      │
│     favorite_things text        │
│     themes_to_avoid text        │
│     reading_level   text        │
│     photo_urls      text[]      │
│ IDX session_id      text        │
│ FK  user_id         uuid → auth.users │
│     created_at      timestamptz │
└──────────────┬──────────────────┘
               │
               │ 1:N
               ▼
┌─────────────────────────────────┐
│            stories               │
├─────────────────────────────────┤
│ PK  id              uuid        │
│ FK  child_profile_id uuid       │
│     title           text        │
│     theme           text        │
│     illustration_style text     │
│     status          text        │  pending → generating → complete
│     page_count      integer     │                       → failed
│     created_at      timestamptz │
└──────────────┬──────────────────┘
               │
               │ 1:N
               ▼
┌─────────────────────────────────┐
│          story_pages             │
├─────────────────────────────────┤
│ PK  id              uuid        │
│ FK  story_id        uuid        │
│     page_number     integer     │
│     text_content    text        │
│     illustration_url text       │
│     created_at      timestamptz │
│                                 │
│ IDX (story_id)                  │
│ IDX (story_id, page_number)     │
└─────────────────────────────────┘
```

---

## 5. RLS Policy Evaluation Chain

```
REQUEST arrives with headers:
  Authorization: Bearer <anon_key>
  x-session-id: <uuid>

                    ┌──────────────────────────┐
                    │   PostgREST (Supabase)    │
                    └─────────────┬────────────┘
                                  │
                    ┌─────────────▼────────────┐
                    │  Extract session_id from  │
                    │  request.headers          │
                    └─────────────┬────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │ child_profiles  │ │    stories      │ │  story_pages    │
    │                 │ │                 │ │                 │
    │ WHERE           │ │ WHERE           │ │ WHERE           │
    │  session_id =   │ │  child_profile  │ │  story_id IN    │
    │  header_value   │ │  _id IN         │ │  (SELECT id     │
    │  OR             │ │  (SELECT id     │ │   FROM stories  │
    │  auth.uid() =   │ │   FROM child_   │ │   WHERE child_  │
    │  user_id        │ │   profiles      │ │   profile_id IN │
    │                 │ │   WHERE owned)  │ │   (SELECT id    │
    │                 │ │                 │ │    FROM profiles │
    │                 │ │                 │ │    WHERE owned)) │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
         Direct              1-level              2-level
         match               subquery             subquery
```

---

## 6. Fallback Decision Tree

```
                         ┌────────────────────┐
                         │  Start Generation  │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │  Call OpenAI API    │
                         └─────────┬──────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                SUCCESS                       FAILURE
                    │                             │
                    ▼                             ▼
         ┌──────────────────┐         ┌──────────────────┐
         │ AI-Generated     │         │ Hardcoded         │
         │ Story (8 pages)  │         │ Fallback Story    │
         │ + custom prompts │         │ (themed template) │
         └────────┬─────────┘         └────────┬─────────┘
                  │                             │
                  └──────────────┬──────────────┘
                                 │
                       ┌─────────▼──────────┐
                       │ Has photo_url?      │
                       └─────────┬──────────┘
                                 │
                  ┌──────────────┴──────────────┐
                  │                             │
                 YES                            NO
                  │                             │
                  ▼                             ▼
       ┌──────────────────┐         ┌──────────────────┐
       │ For each page:    │         │ All pages:       │
       │ Call fal.ai       │         │ Use Pexels URLs  │
       └─────────┬────────┘         └──────────────────┘
                 │
        Per-page result:
                 │
         ┌───────┴───────┐
         │               │
      SUCCESS          FAILURE
         │               │
         ▼               ▼
  ┌────────────┐  ┌────────────┐
  │ fal.ai URL │  │ Pexels URL │
  │ (personal) │  │ (stock)    │
  └────────────┘  └────────────┘
```

---

## 7. Component Architecture

```
                              App.tsx
                                │
                   ┌────────────┴────────────┐
                   │                         │
            WizardProvider              Routes
                   │                         │
                   │          ┌──────────────┼──────────────────────────┐
                   │          │              │                          │
                   │     Landing Page   /architecture            /create (Outlet)
                   │          │                                        │
                   │     ┌────┴──────────┐            ┌───────────────┼────────────────┐
                   │     │ Header        │            │               │                │
                   │     │ Hero          │       WizardLayout    StoryGenerating  StoryReader
                   │     │ TrustStrip    │            │
                   │     │ ProblemSection│       ┌────┼────────┐
                   │     │ SolutionSect. │       │    │        │
                   │     │ HowItWorks   │  PhotoUpload │  ThemeSelection
                   │     │ Features     │       ChildProfile
                   │     │ Testimonials │
                   │     │ FAQ          │
                   │     │ FinalCTA     │
                   │     │ Footer       │
                   │     └──────────────┘
                   │
                   └─── Provides: { data, updateData, reset }
                        Consumed by: PhotoUpload, ChildProfile,
                                     ThemeSelection, StoryGenerating
```

---

## 8. State Lifecycle

```
                    WizardContext State
                    ┌──────────────────────────────────────────────┐
                    │ photos: File[]                                │
                    │ photoPreviewUrls: string[]                    │
                    │ name: string                                  │
  PhotoUpload ────▶ │ age: number                                  │
                    │ interests: string[]                           │
  ChildProfile ───▶ │ favorite_things: string                      │
                    │ themes_to_avoid: string                       │
  ThemeSelection ─▶ │ reading_level: string                        │
                    │ theme: string                                 │
                    │ illustration_style: string                    │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           │ StoryGenerating reads all fields,
                                           │ flushes to database, then context
                                           │ becomes irrelevant
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │               Database (permanent)            │
                    │                                              │
                    │  child_profiles ← wizard data                │
                    │  stories ← theme + style + status            │
                    │  story_pages ← AI-generated content          │
                    │                                              │
                    └──────────────────────────────────────────────┘
                                           │
                                           │ StoryReader fetches from DB
                                           │ (context no longer needed)
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │          StoryReader local state              │
                    │                                              │
                    │  story: Story                                │
                    │  pages: StoryPage[]                          │
                    │  currentPage: number (0-9)                   │
                    │                                              │
                    └──────────────────────────────────────────────┘
```

---

## 9. AI Prompt Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM MESSAGE                                     │
│  "You are a talented children's book author. Always respond with         │
│   valid JSON only, no markdown formatting."                              │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                         USER MESSAGE (buildPrompt)                         │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ 1. ROLE DEFINITION                                                 │   │
│  │    "You are an award-winning children's storybook author..."       │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ 2. CHILD CONTEXT                                                   │   │
│  │    Name: {name} | Age: {age} | Interests: {interests}             │   │
│  │    Favorites: {favorite_things} | Avoid: {themes_to_avoid}        │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ 3. READING LEVEL                                                   │   │
│  │    beginner (3-4): 1-2 sentences/page, 5-9 words, repetition      │   │
│  │    intermediate (5-7): 2-3 sentences/page, 8-14 words, dialogue   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ 4. WORLD-BUILDING RULES (theme-specific, ~150 tokens)             │   │
│  │    ┌─────────────────┐ ┌─────────────────┐                       │   │
│  │    │   SUPERHERO     │ │   FAIRY TALE    │                       │   │
│  │    │ neighborhood +  │ │ storybook       │                       │   │
│  │    │ rooftops, park  │ │ kingdom, castle │                       │   │
│  │    │ NO: castles,    │ │ NO: city,       │                       │   │
│  │    │     dragons     │ │     capes       │                       │   │
│  │    └─────────────────┘ └─────────────────┘                       │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ 5. PAGE STRUCTURE (8 pages)                                        │   │
│  │    1-2: Introduction + inciting incident                           │   │
│  │    3-4: Meet 2-3 named allies                                      │   │
│  │    5-6: Journey + small obstacle                                   │   │
│  │    7-8: Main challenge + turning point                             │   │
│  │    9-10: Resolution + celebration                                  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ 6. CHARACTER REQUIREMENTS                                          │   │
│  │    Creative names (not generic), consistent visual descriptions,   │   │
│  │    personality traits, 2-3 dialogue lines each, role in solution   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ 7. WRITING RULES                                                   │   │
│  │    4-6 sentences/page, dialogue every page, sensory details,       │   │
│  │    STAY WITHIN WORLD, make reader FEEL something                   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ 8. ILLUSTRATION PROMPT RULES                                       │   │
│  │    Child WITH character (never alone), specific action,            │   │
│  │    consistent character visuals, environment depth,                │   │
│  │    lighting/mood, no text in image                                 │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │ 9. OUTPUT FORMAT (strict JSON)                                     │   │
│  │    { "title": "...", "pages": [                                    │   │
│  │      { "page_number": 1, "text": "...",                            │   │
│  │        "illustration_prompt": "..." }, ... x10                     │   │
│  │    ] }                                                             │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Deployment Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                                     │
│                                                                           │
│  ┌────────────┐  ┌────────────────┐  ┌─────────────────────────────────┐│
│  │ React SPA  │  │ localStorage   │  │ supabase-js client              ││
│  │ (dist/)    │  │ session_id     │  │ REST + Storage API              ││
│  └─────┬──────┘  └────────────────┘  └──────────────┬──────────────────┘│
└────────┼─────────────────────────────────────────────┼──────────────────┘
         │                                             │
         │ Static assets (HTML/JS/CSS)                 │ API calls (HTTPS)
         │                                             │
         ▼                                             ▼
┌────────────────┐                     ┌──────────────────────────────────┐
│  Static Host   │                     │        Supabase Platform          │
│  (Vercel/      │                     │                                   │
│   Netlify/     │                     │  ┌───────────┐ ┌──────────────┐  │
│   CF Pages)    │                     │  │PostgREST  │ │  Storage API │  │
│                │                     │  │(REST→SQL) │ │  (S3-compat) │  │
└────────────────┘                     │  └─────┬─────┘ └──────┬───────┘  │
                                       │        │              │           │
                                       │  ┌─────▼──────────────▼───────┐  │
                                       │  │      PostgreSQL             │  │
                                       │  │  ┌───────────────────────┐ │  │
                                       │  │  │ child_profiles (RLS)  │ │  │
                                       │  │  │ stories (RLS)         │ │  │
                                       │  │  │ story_pages (RLS)     │ │  │
                                       │  │  └───────────────────────┘ │  │
                                       │  └────────────────────────────┘  │
                                       │                                   │
                                       │  ┌────────────────────────────┐  │
                                       │  │  Edge Functions (Deno)     │  │
                                       │  │  ┌──────────────────────┐  │  │
                                       │  │  │ generate-story       │  │  │
                                       │  │  │ • OpenAI integration │  │  │
                                       │  │  │ • fal.ai integration │  │  │
                                       │  │  │ • DB writes (svc role)│  │  │
                                       │  │  └──────────────────────┘  │  │
                                       │  └────────────────────────────┘  │
                                       └──────────────────────────────────┘
                                                       │
                                          ┌────────────┼────────────┐
                                          │            │            │
                                          ▼            ▼            ▼
                                   ┌──────────┐ ┌──────────┐ ┌──────────┐
                                   │  OpenAI  │ │  fal.ai  │ │  Pexels  │
                                   │  API     │ │  API     │ │  CDN     │
                                   │(text gen)│ │(img gen) │ │(fallback)│
                                   └──────────┘ └──────────┘ └──────────┘
```
