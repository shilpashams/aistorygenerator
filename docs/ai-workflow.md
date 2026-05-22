# AI Workflow

## Pipeline Overview

Story generation is a two-stage pipeline: **text synthesis** (OpenAI) followed by **illustration synthesis** (fal.ai), with fallbacks at each stage.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Prompt Assembly │────▶│  OpenAI GPT-4o-  │────▶│  Parse & Validate   │
│  (buildPrompt)  │     │  mini            │     │  JSON Response      │
└─────────────────┘     └──────────────────┘     └──────────┬──────────┘
                                                             │
                              ┌───────────────────────────────┘
                              │ 10 pages with text + illustration_prompts
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Parallel Illustration Generation                       │
│                                                                          │
│   Page 1 ──▶ fal.ai     Page 6 ──▶ fal.ai                              │
│   Page 2 ──▶ fal.ai     Page 7 ──▶ fal.ai                              │
│   Page 3 ──▶ fal.ai     Page 8 ──▶ fal.ai                              │
│   Page 4 ──▶ fal.ai     Page 9 ──▶ fal.ai                              │
│   Page 5 ──▶ fal.ai     Page 10 ──▶ fal.ai                             │
│                                                                          │
│   (Promise.allSettled -- failures use Pexels fallback per-page)          │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Database Write   │
                    │  (10 story_pages) │
                    └──────────────────┘
```

---

## Stage 1: Text Generation (OpenAI)

### Model Selection

**GPT-4o-mini** was chosen over GPT-4o for:
- 10x lower cost ($0.003 vs $0.03 per story)
- 2-3x faster response time (3-8s vs 8-15s)
- Sufficient quality for structured children's narratives (formulaic output benefits from instruction-following over creative reasoning)

The tradeoff: slightly less nuanced character voice and less surprising plot twists. Acceptable for ages 3-9.

### Prompt Architecture

The prompt is ~1500-2000 tokens (varies by theme) and follows this structure:

```
1. ROLE DEFINITION
   "You are an award-winning children's storybook author..."
   (Sets expertise context and quality bar)

2. CHILD CONTEXT
   Name, age, interests, favorites, exclusions
   (Personalization inputs)

3. READING LEVEL CALIBRATION
   Sentence length, vocabulary constraints
   (Controls linguistic complexity)

4. WORLD-BUILDING RULES (theme-specific)
   Allowed elements, character archetypes, sensory expectations
   EXPLICIT PROHIBITION LIST
   (Prevents cross-theme contamination)

5. PAGE STRUCTURE (narrative arc)
   Pages 1-2: Introduction + inciting incident
   Pages 3-4: Meet 2-3 named allies
   Pages 5-6: Journey + small obstacle
   Pages 7-8: Main challenge + turning point
   Pages 9-10: Resolution + celebration
   (Forces proper pacing)

6. CHARACTER REQUIREMENTS
   Creative names, consistent visual descriptions,
   personality traits, dialogue expectations
   (Ensures memorable, re-readable characters)

7. ILLUSTRATION PROMPT RULES
   Action, multiple characters, environment depth,
   lighting, no text, "the child" as reference
   (Guides fal.ai input quality)

8. OUTPUT FORMAT
   Strict JSON schema with 10 pages
   (Enables reliable parsing)
```

### Theme-Specific World Rules

Each theme has an explicit world definition (~150 tokens) that constrains the generative space:

**Dinosaurs**: Tropical prehistoric valley. Characters must be specific dinosaur species with personality traits. Prohibited: spaceships, magic, castles, underwater, technology.

**Space**: Aboard a cozy ship visiting distinct planets. Characters are aliens adapted to their environment (not generic). Prohibited: forests, castles, underwater, dinosaurs, fantasy.

**Enchanted Forest**: Deep ancient woodland only. Characters are woodland creatures with magical abilities. Prohibited: spaceships, planets, cities, technology, oceans, castles.

**Superhero**: Friendly neighborhood/city. Characters are everyday people with heart-based powers (non-violent). Prohibited: forests, space, dinosaurs, medieval settings, actual violence.

**Fairy Tale**: Storybook kingdom. Characters are classic archetypes with personality twists. Prohibited: spaceships, technology, prehistoric settings, modern cities, underwater.

### Why Explicit Prohibitions Work

Without prohibitions, GPT associates "adventure" with cross-domain elements (rockets in forests, dragons in space). The explicit `ABSOLUTELY NO:` instruction acts as a hard constraint that the model reliably respects. This single technique eliminated the "space references in enchanted forest" failure mode.

### Temperature & Token Configuration

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| temperature | 0.85 | High enough for creative character names and plot twists; low enough for coherent narrative |
| max_tokens | 6000 | 10 pages x ~500 tokens/page + JSON overhead |
| model | gpt-4o-mini | Cost/quality sweet spot for structured output |

### JSON Output Parsing

The response is expected as raw JSON (no markdown fences). Parsing includes:
1. Strip any accidental markdown code fences (`\`\`\`json`, `\`\`\``)
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

**Parallelism**: All 10 pages are submitted simultaneously. `Promise.allSettled()` ensures one failure doesn't block the others.

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

If OpenAI returns an error, timeout, or unparseable response:

```typescript
storyContent = generateFallbackStory(body);
```

Each theme has a complete 10-page hardcoded story with:
- Named characters (Bramblesnout, Fizzbeak, Nettlewick, Prism, etc.)
- Child's name interpolated throughout
- First interest woven into plot
- Full narrative arc (introduction through resolution)
- Illustration prompts for each page (used by fal.ai if available)

### Tier 2: Illustration Fallback

If fal.ai fails for any individual page:

```typescript
fallbackImages[i % fallbackImages.length]
```

Each theme maps to 10 curated Pexels URLs (nature/landscape photos matching the theme mood). Applied per-page independently -- a story can have 7 AI-generated illustrations and 3 stock photos.

### Fallback Decision Matrix

| OpenAI | fal.ai | User Experience |
|--------|--------|-----------------|
| OK | OK | Full personalization (AI text + face-preserved illustrations) |
| OK | Partial fail | AI text + mix of personalized and stock illustrations |
| OK | Full fail | AI text + all stock illustrations |
| Fail | OK | Template text + face-preserved illustrations |
| Fail | Fail | Template text + stock illustrations |

In ALL cases, the user receives a complete 10-page readable story. The quality degrades gracefully, never the availability.

---

## Quality Control Mechanisms

### Preventing Cross-Theme Contamination

- Each theme has an explicit `ABSOLUTELY NO:` list in the prompt
- The world rules describe what IS in the world (positive constraints)
- The illustration prompt references "the setting is [THEME DESCRIPTION]" to anchor visual generation

### Ensuring Narrative Coherence

- Prescribed 10-page arc prevents rushed or meandering stories
- Character requirements mandate named, visually described allies introduced early
- Dialogue requirement on every page prevents narration-heavy walls of text
- Sensory detail requirement on every page grounds the story in physical reality

### Character Consistency

- Prompt requires "consistent visual details across all pages"
- Each character must be described with specific colors, features, and clothing
- Illustration prompts reference characters by their established visual description

### Reading Level Enforcement

| Level | Constraints |
|-------|------------|
| Beginner (3-4) | 3-6 words/sentence, repetition, rhythm, very simple vocabulary |
| Intermediate (5-6) | Simple + compound sentences, expressive dialogue |
| Advanced (7-9) | Full paragraphs, metaphors, descriptive language |

---

## Future Improvements

### Near-Term (High Impact, Low Effort)

1. **Add output validation**: Check that GPT's response has exactly 10 pages, each with non-empty text and illustration_prompt. Retry once on failure before falling back.
2. **Illustration URL persistence**: Download fal.ai images to Supabase Storage (they expire after ~7 days on fal.ai CDN).
3. **Retry logic for fal.ai**: Single retry with exponential backoff before falling back to Pexels.

### Medium-Term (High Impact, Medium Effort)

4. **Few-shot examples**: Include 1 complete example story per theme in the prompt. Most impactful single change for output quality (~$0.001 extra per call).
5. **Character reference sheet**: Generate character descriptions once, then reference them across all 10 illustration prompts for visual consistency.
6. **Progressive delivery**: Stream story text to client as soon as OpenAI responds; show illustrations as they complete (don't wait for all 10).

### Long-Term (Transformative)

7. **LoRA fine-tuning**: Train a per-child face model using their 3 uploaded photos. Produces dramatically better likeness than single-image reference.
8. **Voice narration**: Add TTS (text-to-speech) layer for audio story experience.
9. **Story continuation**: Allow "Part 2" generation using same characters and world state.
