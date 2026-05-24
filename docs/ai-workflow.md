# AI Workflow

## Pipeline Overview

Story generation is a two-stage pipeline: **text synthesis** (OpenAI GPT-4o) followed by **illustration synthesis** (fal.ai), with fallbacks at each stage. The text stage is consolidated into 1-2 API calls with retry logic to handle rate limits (3 RPM on the current OpenAI tier).

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Prompt Assembly │────▶│  OpenAI GPT-4o   │────▶│  Parse & Validate   │
│  (combined)     │     │  (w/ 429 retry)  │     │  JSON Response      │
└─────────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                             │
                              ┌───────────────────────────────┘
                              │ 8 pages with text + illustration_prompts
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Parallel Illustration Generation                       │
│                                                                          │
│   Page 1 ──▶ fal.ai     Page 5 ──▶ fal.ai                              │
│   Page 2 ──▶ fal.ai     Page 6 ──▶ fal.ai                              │
│   Page 3 ──▶ fal.ai     Page 7 ──▶ fal.ai                              │
│   Page 4 ──▶ fal.ai     Page 8 ──▶ fal.ai                              │
│                                                                          │
│   (Promise.allSettled -- failures use Pexels fallback per-page)          │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Database Write   │
                    │  (8 story_pages)  │
                    └──────────────────┘
```

---

## Stage 1: Text Generation (OpenAI)

### Model Selection

**GPT-4o** is used for all text generation. The consolidated single-call approach keeps costs low (~$0.07/story) while providing higher quality creative output than GPT-4o-mini.

### Rate Limit Handling

The OpenAI account is on a tier with **3 requests per minute (RPM)**. The `callOpenAI` function handles this with:
- Automatic 429 detection
- Up to 5 retries with exponential backoff (21s, 42s, 63s, 84s, 105s)
- Respects `retry-after` header when present

### Prompt Architecture

The entire story (text + illustration prompts) is generated in a single ~2000-token prompt with this structure:

```
1. ROLE DEFINITION
   "You are a beloved children's picture book author..."

2. CREATIVE SEED (randomized)
   Random opening scenario + conflict + twist + UUID
   (Ensures every story is unique)

3. READING LEVEL CONSTRAINTS
   Strict sentence/word limits, vocabulary rules, refrain requirements
   (Controls linguistic complexity)

4. CHILD CONTEXT
   Name, age, interests, favorites, toy, nickname, family phrase
   (Deep personalization inputs)

5. THEME WORLD-BUILDING
   Setting, sidekick ideas, sensory palette
   (Constrains the generative space)

6. MOOD GUIDANCE
   Tone and emotional direction
   (Sets the story's feeling)

7. PERSONALIZATION RULES
   How to make interests active, toy present, sidekick memorable
   (Ensures story feels unique to THIS child)

8. WRITING CONSTRAINTS
   8 pages, sentence/word limits, onomatopoeia requirement, story arc
   (Structural enforcement)

9. OUTPUT FORMAT
   JSON with title + 8 pages (text + illustration_prompt each)
   (Enables reliable parsing)
```

### Temperature & Token Configuration

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| temperature | 0.85 | High enough for creative character names and unique plots; low enough for coherent narrative |
| max_tokens | 4096 | 8 pages x ~300 tokens/page + illustration prompts + JSON overhead |
| model | gpt-4o | Higher quality creative writing than mini; affordable with single-call approach |
| response_format | json_object | Enforces valid JSON output |

### JSON Output Parsing

The response is expected as raw JSON (no markdown fences). Parsing includes:
1. Strip any accidental markdown code fences
2. `JSON.parse()` the cleaned string
3. Validate: must have `title` (non-empty) and `pages` (array, length > 0)
4. On any failure: fall back to hardcoded template

---

## Stage 2: Illustration Generation (fal.ai)

### Model: Flux Pro Kontext (Max)

This is a face-preserving image-to-image model. It takes:
- A **reference photo** (the child's uploaded face)
- A **text prompt** (describing the desired scene and style)

And produces an illustration where the child's facial features are preserved while the style, clothing, and environment are transformed.

### Prompt Assembly for Illustrations

Each page's `illustration_prompt` (from GPT) is wrapped in a standardized template:

```
Transform this photo into a [STYLE DESCRIPTION] children's book illustration.
Keep the child's face, features, and likeness exactly the same but render them
in the illustrated art style.
Place the child as the main character in this scene: [GPT'S ILLUSTRATION PROMPT].
The setting is [THEME DESCRIPTION].
The image should be warm, friendly, colorful and appropriate for young children.
No text or words in the image.
```

### Style Descriptions (Injected per illustration_style)

| Style | Prompt Description |
|-------|-------------------|
| cartoon | Bright and cheerful cartoon illustration style with bold outlines and vivid colors |
| storybook | Classic children's storybook illustration with warm, detailed artwork |
| digital-art | Polished digital art illustration with rich colors and smooth gradients |

### Queue-Based Execution Protocol

fal.ai uses an asynchronous queue system (not synchronous inference):

```
Client                              fal.ai
  │                                    │
  │── POST /queue/fal-ai/flux-pro ────▶│
  │                                    │ (queued)
  │◀── { status_url, response_url } ───│
  │                                    │
  │── GET status_url ─────────────────▶│
  │◀── { status: "IN_QUEUE" } ─────────│
  │                                    │
  │    ... (poll every 3s) ...         │
  │                                    │
  │── GET status_url ─────────────────▶│
  │◀── { status: "COMPLETED" } ────────│
  │                                    │
  │── GET response_url ───────────────▶│
  │◀── { images: [{ url: "..." }] } ───│
```

**Timeout**: 40 polls x 3 seconds = 2 minutes max per image.

**Parallelism**: All 8 pages are submitted simultaneously. `Promise.allSettled()` ensures one failure doesn't block the others.

### Parameters

```json
{
  "prompt": "<full assembled prompt>",
  "image_url": "<first photo from photo_urls array>",
  "output_format": "jpeg",
  "aspect_ratio": "4:3",
  "safety_tolerance": "6",
  "num_images": 1
}
```

**aspect_ratio 4:3**: Matches the `aspect-[16/10]` display container in StoryReader (close enough; slight letterboxing is acceptable).

**safety_tolerance 6**: High tolerance to avoid false positives on children's content. Children's illustrations sometimes trigger safety filters due to depicting minors in stylized form.

---

## Fallback System

### Tier 1: Text Fallback

If OpenAI returns a non-429 error, timeout, or unparseable response after all retries:

```typescript
storyContent = generateFallbackStory(body);
```

Each theme has a complete 8-page hardcoded story with:
- Named characters (Bramblesnout, Fizzbeak, Nettlewick, Prism, Cinders, etc.)
- Child's name interpolated throughout
- Full narrative arc (introduction through resolution)
- Illustration prompts for each page (used by fal.ai if available)
- Musical refrain repeated across pages

**Known limitation:** Fallback stories are static -- the same theme always produces the same story. Only the child's name is personalized.

### Tier 2: Illustration Fallback

If fal.ai fails for any individual page:

```typescript
fallbackImages[i % fallbackImages.length]
```

Each theme maps to curated Pexels URLs (nature/landscape photos matching the theme mood). Applied per-page independently -- a story can have 7 AI-generated illustrations and 1 stock photo.

### Fallback Decision Matrix

| OpenAI | fal.ai | User Experience |
|--------|--------|-----------------|
| OK | OK | Full personalization (AI text + face-preserved illustrations) |
| OK | Partial fail | AI text + mix of personalized and stock illustrations |
| OK | Full fail | AI text + all stock illustrations |
| Fail | OK | Template text + face-preserved illustrations |
| Fail | Fail | Template text + stock illustrations |

In ALL cases, the user receives a complete 8-page readable story. The quality degrades gracefully, never the availability.

---

## Quality Control Mechanisms

### Preventing Cross-Theme Contamination

- Each theme has an explicit `ABSOLUTELY NO:` list in the prompt
- The world rules describe what IS in the world (positive constraints)
- The illustration prompt references "the setting is [THEME DESCRIPTION]" to anchor visual generation

### Ensuring Narrative Coherence

- Prescribed 8-page arc prevents rushed or meandering stories
- Character requirements mandate named, visually described allies introduced early
- Dialogue requirement on every page prevents narration-heavy walls of text
- Sensory detail requirement on every page grounds the story in physical reality

### Character Consistency

- Prompt requires "consistent visual details across all pages"
- Each character must be described with specific colors, features, and clothing
- Illustration prompts reference characters by their established visual description

### Reading Level Enforcement

| Level | Pages | Sentences/Page | Words/Sentence | Key Constraints |
|-------|-------|---------------|----------------|-----------------|
| Beginner (3-4) | 8 | 1-2 | 5-9 | Preschool vocabulary only, single exclamations (no dialogue), one onomatopoeia/page |
| Intermediate (5-6) | 8 | 2-4 | 8-14 | Richer vocabulary, real dialogue on 4+ pages, one metaphor allowed, rich sensory details |

Post-generation, a local validation engine checks each page against these constraints. If pages fail, a targeted rewrite API call fixes only the failing pages.

---

## Future Improvements

### Near-Term (High Impact, Low Effort)

1. **Upgrade OpenAI tier**: Increasing from 3 RPM would allow re-enabling the multi-step pipeline (story bible, editorial review, character sheet) for higher quality output.
2. **Illustration URL persistence**: Download fal.ai images to Supabase Storage (they expire after ~7 days on fal.ai CDN).
3. **Progressive delivery**: Show each page illustration as it completes instead of waiting for all 8.

### Medium-Term (High Impact, Medium Effort)

4. **Few-shot examples**: Include 1 complete example story per theme in the prompt for output quality.
5. **Re-enable editorial review**: Once rate limits allow, add back the quality pass as a separate API call.
6. **Supabase Realtime**: Replace polling with realtime subscriptions for completion notification.

### Long-Term (Transformative)

7. **LoRA fine-tuning**: Train a per-child face model using their 3 uploaded photos for better likeness.
8. **Voice narration**: Add TTS (text-to-speech) layer for audio story experience.
9. **Story continuation**: Allow "Part 2" generation using same characters and world state.
