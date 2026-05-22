# System Flow Diagrams

## Adventures Of... - AI Children's Storybook Platform

---

## 1. End-to-End User Journey

```mermaid
flowchart TD
    A[User visits Landing Page] --> B[Clicks Create Story CTA]
    B --> C[Photo Upload Step]
    C --> D[Child Profile Form]
    D --> E[Theme & Style Selection]
    E --> F[Story Generation Screen]
    F --> G{AI Pipeline}
    G -->|Success| H[Story Reader]
    G -->|Failure| I[Fallback Story]
    I --> H
    H --> J[Read Complete Book]
    J --> K{User Action}
    K -->|Create Another| C
    K -->|Go Home| A
```

---

## 2. Story Generation - Detailed Sequence

```mermaid
sequenceDiagram
    participant U as User Browser
    participant S as Supabase DB
    participant ST as Supabase Storage
    participant EF as Edge Function
    participant OAI as OpenAI GPT-4o
    participant FAL as fal.ai Flux Pro

    U->>ST: Upload 1-3 photos
    ST-->>U: Public URLs returned
    U->>S: INSERT child_profiles
    S-->>U: profile.id
    U->>S: INSERT stories (status: pending)
    S-->>U: story.id
    U->>EF: POST /generate-story (fire-and-forget)
    U->>U: Start polling stories.status every 2s

    EF->>S: UPDATE status = 'generating'
    
    Note over EF,OAI: Step 0: Photo Analysis
    EF->>OAI: Vision API (photo URL)
    OAI-->>EF: Child visual details (clothing/hair)

    Note over EF,OAI: Step 1: Story Bible
    EF->>OAI: Generate Story Bible prompt
    OAI-->>EF: Story Bible JSON (~2048 tokens)

    Note over EF,OAI: Step 2: Story Text
    EF->>OAI: Write story from Bible
    OAI-->>EF: 8 pages text JSON

    Note over EF,OAI: Step 2b: Editorial Review
    EF->>OAI: Review against 8 criteria
    OAI-->>EF: Revised pages JSON

    Note over EF,OAI: Step 3: Illustration Prompts
    EF->>OAI: Generate prompts with full context
    OAI-->>EF: 8 illustration prompts JSON

    Note over EF,FAL: Step 4: Image Generation (parallel)
    par Generate 8 illustrations
        EF->>FAL: Page 1 prompt + photo
        EF->>FAL: Page 2 prompt + photo
        EF->>FAL: Page 3 prompt + photo
        EF->>FAL: Page 4 prompt + photo
        EF->>FAL: Page 5 prompt + photo
        EF->>FAL: Page 6 prompt + photo
        EF->>FAL: Page 7 prompt + photo
        EF->>FAL: Page 8 prompt + photo
    end
    FAL-->>EF: 8 image URLs (or fallback Pexels)

    EF->>S: INSERT 8 story_pages
    EF->>S: UPDATE status = 'complete', page_count = 8
    
    U->>S: Poll detects status = 'complete'
    U->>U: Navigate to /create/story/:storyId
    U->>S: SELECT story + story_pages
    S-->>U: Complete story data
```

---

## 3. AI Pipeline - Internal Flow

```mermaid
flowchart TB
    subgraph Input[User Input Collection]
        P[Photos]
        CP[Child Profile]
        TH[Theme + Style]
    end

    subgraph Pipeline[AI Generation Pipeline]
        PA[Step 0: Photo Analysis<br/>GPT-4o Vision<br/>temp: 0.3, 200 tokens]
        SB[Step 1: Story Bible<br/>GPT-4o<br/>temp: 0.7, 2048 tokens]
        ST[Step 2: Story Text<br/>GPT-4o<br/>temp: 0.7, 2048 tokens]
        ER[Step 2b: Editorial Review<br/>GPT-4o<br/>temp: 0.4, 2048 tokens]
        IP[Step 3: Illustration Prompts<br/>GPT-4o<br/>temp: 0.7, 3000 tokens]
        IG[Step 4: Image Generation<br/>fal.ai Flux Pro Kontext<br/>8 parallel requests]
    end

    subgraph Output[Stored Results]
        SP[story_pages table<br/>8 records with text + image URLs]
        SS[stories table<br/>status: complete]
    end

    P --> PA
    CP --> SB
    TH --> SB
    PA -->|child visual details| SB
    SB -->|Story Bible JSON| ST
    SB -->|Story Bible JSON| ER
    ST -->|draft pages| ER
    SB -->|Story Bible JSON| IP
    ER -->|edited pages| IP
    PA -->|child details| IP
    IP -->|8 prompts| IG
    P -->|reference photo| IG
    TH -->|style + theme| IG
    IG --> SP
    ER -->|final text| SP
    SP --> SS
```

---

## 4. Data Flow - Context Passing

```mermaid
flowchart LR
    subgraph S0[Step 0]
        Photo[Photo URL] --> Vision[GPT-4o Vision]
        Vision --> CVD[Child Visual Details]
    end

    subgraph S1[Step 1]
        CVD --> Bible[Story Bible Generator]
        UserInput[Name, Age, Interests<br/>Toy, Mood, Theme] --> Bible
        Bible --> BibleJSON[Story Bible JSON]
    end

    subgraph S2[Step 2]
        BibleJSON --> Writer[Story Writer]
        Writer --> DraftPages[Draft 8 Pages]
    end

    subgraph S2b[Step 2b]
        BibleJSON --> Editor[Editorial Reviewer]
        DraftPages --> Editor
        UserInput2[Personalization Fields] --> Editor
        Editor --> FinalPages[Final 8 Pages]
    end

    subgraph S3[Step 3]
        BibleJSON --> ArtDir[Art Director]
        FinalPages --> ArtDir
        CVD2[Child Visual Details] --> ArtDir
        Style[Art Style] --> ArtDir
        ArtDir --> Prompts[8 Illustration Prompts]
    end

    subgraph S4[Step 4]
        Prompts --> ImgGen[fal.ai x8]
        RefPhoto[Reference Photo] --> ImgGen
        ImgGen --> Images[8 Image URLs]
    end
```

---

## 5. Failure & Fallback Flow

```mermaid
flowchart TD
    Start[Edge Function Invoked] --> TryAI{Try AI Generation}
    
    TryAI -->|Success| AIStory[AI-Generated Story]
    TryAI -->|OpenAI Error| Fallback[Use Fallback Story]
    TryAI -->|Invalid JSON| Fallback
    TryAI -->|No API Key| Fallback

    AIStory --> EditCheck{Editorial Parse OK?}
    EditCheck -->|Yes| UseEdited[Use Edited Pages]
    EditCheck -->|No| UseOriginal[Use Original Draft]

    UseEdited --> TryImages
    UseOriginal --> TryImages
    Fallback --> TryImages

    TryImages{fal.ai Available?}
    TryImages -->|Yes + Photo| GenerateImages[Generate 8 Images]
    TryImages -->|No Key or No Photo| UsePexels[Use Pexels Fallbacks]

    GenerateImages --> PerPage{Each Page}
    PerPage -->|Success| AIImage[AI Image URL]
    PerPage -->|Failure| PexelsImage[Pexels Fallback URL]

    AIImage --> Save
    PexelsImage --> Save
    UsePexels --> Save

    Save[Save to Database] --> Complete[Status: Complete]
```

---

## 6. Frontend Routing & State

```mermaid
stateDiagram-v2
    [*] --> LandingPage: /
    LandingPage --> PhotoUpload: Click CTA
    
    state WizardFlow {
        PhotoUpload --> ChildProfile: Next (1+ photo)
        ChildProfile --> ThemeSelection: Next (validated)
        ThemeSelection --> StoryGenerating: Create Story
        StoryGenerating --> StoryReader: Status = complete
        
        ChildProfile --> PhotoUpload: Back
        ThemeSelection --> ChildProfile: Back
    }
    
    StoryReader --> PhotoUpload: Create Another
    StoryReader --> LandingPage: Home
    
    note right of WizardFlow
        All steps share WizardContext state.
        Data persists across navigation within wizard.
        No data saved to DB until generation begins.
    end note
```

---

## 7. Storage & File Handling

```mermaid
flowchart TD
    subgraph Client[Browser]
        F[File Input] --> V[Validate: image/*, max 3]
        V --> P[Create preview URLs]
        V --> S[Store in WizardContext]
    end

    subgraph Upload[Upload Phase - at generation time]
        S --> U[Upload to Supabase Storage]
        U --> B[child-photos bucket]
        B --> URL[Get public URL]
    end

    subgraph Usage[AI Usage]
        URL --> EF[Edge Function]
        EF --> OAI[OpenAI Vision - photo analysis]
        EF --> FAL[fal.ai - image reference]
    end

    subgraph Cleanup[No cleanup implemented]
        B -.->|Photos persist indefinitely| X[No TTL or deletion]
    end
```

---

## 8. Database Entity Relationship

```mermaid
erDiagram
    child_profiles {
        uuid id PK
        text name
        integer age
        text_array interests
        text favorite_things
        text themes_to_avoid
        text reading_level
        text_array photo_urls
        text session_id
        uuid user_id FK
        timestamptz created_at
    }

    stories {
        uuid id PK
        uuid child_profile_id FK
        text title
        text theme
        text illustration_style
        text status
        integer page_count
        timestamptz created_at
    }

    story_pages {
        uuid id PK
        uuid story_id FK
        integer page_number
        text text_content
        text illustration_url
        timestamptz created_at
    }

    auth_users {
        uuid id PK
    }

    storage_objects {
        text bucket_id
        text name
        text path
    }

    child_profiles ||--o{ stories : "has many"
    stories ||--o{ story_pages : "has many"
    auth_users ||--o{ child_profiles : "optional owner"
    storage_objects }|--|| child_profiles : "photos referenced by"
```

---

## 9. fal.ai Image Generation - Polling Flow

```mermaid
sequenceDiagram
    participant EF as Edge Function
    participant Q as fal.ai Queue API
    participant S as fal.ai Status API
    participant R as fal.ai Result API

    EF->>Q: POST /fal-ai/flux-pro/kontext/max
    
    alt Synchronous Result
        Q-->>EF: {images: [{url: "..."}]}
        EF->>EF: Return image URL
    else Queued
        Q-->>EF: {status_url, response_url}
        loop Every 3 seconds (max 40 attempts)
            EF->>S: GET status_url
            alt COMPLETED
                S-->>EF: {status: "COMPLETED"}
                EF->>R: GET response_url
                R-->>EF: {images: [{url: "..."}]}
                EF->>EF: Return image URL
            else IN_QUEUE / IN_PROGRESS
                S-->>EF: {status: "IN_PROGRESS"}
                EF->>EF: Wait 3 seconds
            else FAILED
                S-->>EF: {status: "FAILED"}
                EF->>EF: Throw error (use fallback)
            end
        end
        EF->>EF: Timeout after 40 attempts (use fallback)
    end
```

---

## 10. Deployment Architecture

```mermaid
flowchart TB
    subgraph Client[Client Layer]
        Browser[User Browser]
    end

    subgraph CDN[Static Hosting]
        Vite[Vite Build Output<br/>dist/index.html<br/>dist/assets/*.js<br/>dist/assets/*.css]
    end

    subgraph Supabase[Supabase Platform]
        PG[(PostgreSQL<br/>+ RLS Policies)]
        Storage[Object Storage<br/>child-photos bucket]
        Edge[Edge Functions<br/>Deno Runtime<br/>generate-story]
        Realtime[Realtime<br/>unused currently]
    end

    subgraph External[External APIs]
        OpenAI[OpenAI API<br/>GPT-4o + Vision]
        FalAI[fal.ai API<br/>Flux Pro Kontext Max]
        Pexels[Pexels CDN<br/>Fallback images]
    end

    Browser --> Vite
    Browser --> PG
    Browser --> Storage
    Browser --> Edge
    Edge --> PG
    Edge --> Storage
    Edge --> OpenAI
    Edge --> FalAI
    Edge -.->|fallback| Pexels
```
