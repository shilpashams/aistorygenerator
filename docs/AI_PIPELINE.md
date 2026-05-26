# AI Pipeline Architecture Document
## AI Children's Storybook Application

**Version**: 3.0  
**Date**: 2026-05-24  
**Models**: OpenAI GPT-4o, fal.ai Flux Pro Kontext/Max  
**Runtime**: Supabase Edge Functions (Deno)

---

## Pipeline Overview

The AI pipeline generates a complete 8-page personalized children's storybook from a child's profile and photos. It uses a consolidated 1-2 OpenAI API call approach (optimized for low-tier rate limits of 3 RPM) with automatic retry/backoff, followed by 8 parallel fal.ai calls for illustration.

```
INPUT:                           OUTPUT:
+------------------+             +------------------+
| Child Name       |             | Story Title      |
| Age (2-12)       |             | 8 Pages:         |
| Interests[]      |             |   - text_content |
| Reading Level    |   PIPELINE  |   - illustration |
| Theme            | ==========> | Character Sheet  |
| Style            |             +------------------+
| Photo URLs[]     |
| Personality Data |
+------------------+

PIPELINE STEPS:
  0. Photo Analysis             [GPT-4o Vision, T=0.3, 200 tok] (non-fatal, only if photos provided)
  1. Combined Story Generation  [GPT-4o Chat, T=0.85, 4096 tok] (story text + illustration prompts in one call)
  2. Validation + Rewrite       [Local check + GPT-4o, T=0.4, 3000 tok] (non-fatal, only if pages fail)
  3. Image Generation           [fal.ai x8 parallel, 120s timeout each]

RATE LIMIT HANDLING:
  - OpenAI account limit: 3 RPM (requests per minute)
  - Retry on 429: up to 5 attempts with 21s+ exponential backoff
  - Pipeline designed to use max 2 API calls (1 if validation passes)
```

---

## Step 0: Photo Analysis (Non-Fatal)

**Purpose:** Extract safe visual details from the child's photo for use in story illustrations while strictly avoiding any identity-sensitive descriptors.

**API Configuration:**
| Parameter | Value |
|-----------|-------|
| Model | gpt-4o (vision) |
| Temperature | 0.3 |
| Max Tokens | 200 |
| Image Detail | low (cost optimization) |
| Input | First photo URL from photo_urls array |

**Safety Rules (System Prompt):**
- ONLY describe: hairstyle (length/style), hair accessories, clothing color/type, glasses, shoes, accessories
- NEVER describe: race, ethnicity, skin color, weight, health conditions, disabilities, facial features, age appearance, gender identity
- Maximum 2-3 sentences
- If photo unclear or not of a child: return "no details extracted"

**Example Output:**
```
"The child has curly shoulder-length hair with a yellow bow. They are wearing a green t-shirt with a dinosaur on it and red sneakers."
```

**Error Handling:** Silent catch -> defaults to "no details extracted". Pipeline continues regardless.

**Note:** This call is subject to the same 429 retry logic (5 retries, 21s backoff). If it fails after all retries, pipeline proceeds without photo details.

---

## Step 1: Combined Story Generation

**Purpose:** Generate the complete story text AND illustration prompts in a single API call. This consolidation (previously 5 separate calls: story bible, story text, editorial review, character sheet, illustration prompts) was implemented to work within the 3 RPM rate limit.

**API Configuration:**
| Parameter | Value |
|-----------|-------|
| Model | gpt-4o |
| Temperature | 0.85 (creative freedom) |
| Max Tokens | 4096 |
| Input | Full StoryRequest + childVisualDetails + creative seed |

### Prompt Assembly Components

The combined prompt integrates all personalization, reading-level constraints, and illustration direction into a single request:

**1. Creative Seed (randomized per generation):**
- Random opening scenario (12 variants)
- Random central conflict (12 variants)
- Random plot twist (10 variants)
- Unique story ID (UUID prefix for maximum variation)

**2. Theme World-Building (5 pre-defined templates):**

| Theme | Setting | Sidekick Ideas |
|-------|---------|----------------|
| Superhero | Friendly neighborhood with park, shops, and rooftops | Flour-dusted baker with courage-cakes, speedy crossing guard |
| Fairy Tale | Storybook kingdom with wonky castle and cobblestone village | Tiny dragon afraid of fire, fairy godparent always late, jolly king |

**3. Story Mood Guidance (6 moods):**

| Mood | Tone |
|------|------|
| bedtime-calm | Gentle, quiet, soothing. End with warmth and safety. |
| silly-adventure | Playful, giggly, full of surprises and funny sounds. |
| bravery | Encouraging, empowering. Child discovers they're braver than they thought. |
| friendship | Warm, kind, connected. Celebrates being there for someone. |
| confidence | Affirming, celebratory. Child tries something new and succeeds. |
| curiosity | Wondering, exploratory, delighted by discovery. |

**4. Personalization Rules:**

| Rule | How Applied |
|------|------------|
| Favorite Toy | Appears as magical item, companion, or plot-solving tool |
| Favorite Things | Colors -> world palette/sidekick trait; Animals -> sidekick species; Foods -> magical items |
| Interests as Actions | Must be ACTIVE in the plot (child DOES things related to them) |
| Pride & Learning | proud_of becomes HOW they solve the problem |
| Sidekick | Memorable name (Bramblesnout, Fizzbeak, Crumblewhisk style) |
| Refrain | Musical 5-8 word phrase appearing on at least 3 pages |

### Output JSON Schema (Combined -- Story Text + Illustration Prompts)

```json
{
  "title": "A catchy title a 4-year-old would love",
  "pages": [
    {
      "page_number": 1,
      "text": "Story text for this page...",
      "illustration_prompt": "Short scene description for image generator (max 25 words)..."
    },
    ... (8 pages total)
  ]
}
```

---

## Step 2: Reading-Level Validation + Targeted Rewrite (Non-Fatal)

**Purpose:** Automated local validation (no API) to catch reading-level violations, followed by targeted AI rewrite of only the failing pages. Only triggers a second API call if pages fail validation.

### Reading Level Specifications

| Parameter | Beginner (Ages 3-4) | Intermediate (Ages 5-6) |
|-----------|---------------------|-------------------------|
| Pages | 8 exactly | 8 exactly |
| Sentences/page | 1-2 (STRICT) | 2-4 |
| Words/sentence | 5-9 (STRICT) | 8-14 |
| Vocabulary | Preschool only (mama, big, little, run, jump, splash, yummy, uh-oh, yay) | Richer but concrete (curious, enormous, shimmer, tumbled, whispered) |
| Refrain | 3-5 words, repeat 4+ times | 5-8 words, repeat 3+ times |
| Dialogue | Single exclamations ONLY (Oh no! Yay! Whee!) - NEVER "said [char]" | Real short exchanges between child and sidekick, 4+ pages |
| Metaphors | None (unless extremely physical: "big as a house") | Exactly ONE gentle metaphor per story |
| Sensory | 1 onomatopoeia per page (SPLAT! BOOM!) - no other sensory detail | Rich sensory on every page (smell, sound, texture, taste, temperature) |
| Arc | discover -> try -> oops -> try again -> yay! | setup -> rising with twist -> false solution -> real solution -> denouement |
| Problem-solving | One direct physical action (push, pull, hug, shout) | Observe, think aloud, try idea, adjust if first attempt fails |
| Emotional growth | None - child simply happy at end | Simple learning: "I am braver than I thought" / "trying is what matters" |

### Forbidden Emotion Words

**Beginner:** determined, anxious, relieved, frustrated, overwhelmed, conflicted, proud, grateful, confident, hesitant, melancholy

**Intermediate:** existential, philosophical, resentful, vindictive, traumatized, nihilistic

### Output Format

```json
{
  "title": "Story Title",
  "pages": [
    { "page_number": 1, "text": "Page narrative..." },
    ...8 pages total
  ]
}
```

**Note:** The editorial review step (previously Step 2b -- an 8-criterion quality pass) was consolidated into the main generation prompt to reduce API calls. The quality criteria are now embedded in the combined prompt's writing constraints.

### Local Validation Engine

| Check | Method | Beginner Trigger | Intermediate Trigger |
|-------|--------|-----------------|---------------------|
| Sentence count | Split on `. ! ?` + capital | < 1 or > 2 per page | < 2 or > 4 per page |
| Word count | Average per sentence | < 5 or > 9 | < 8 or > 14 |
| Complex vocab | 20-word banned list scan | Any found | N/A |
| Dialogue style | "said/asked/replied" detection | Any found | N/A |
| Word ceiling | Average words/sentence | > 11 | N/A |
| Richness floor | Sentence + word minimums | N/A | <=1 sentence AND <7 avg words |
| Forbidden emotions | Per-level word list | Level-specific matches | Level-specific matches |
| Refrain frequency | 3-word phrase repetition count | < 4 occurrences | < 3 occurrences |

### Complex Vocabulary Ban List (20 words)
```
determined, anxious, relieved, frustrated, overwhelmed, conflicted,
melancholy, hesitant, philosophical, existential, resentful, vindictive,
nevertheless, furthermore, consequently, approximately, extraordinary,
unfortunately, immediately, particularly
```

### Targeted Rewrite (If Validation Fails)

**API Configuration:**
| Parameter | Value |
|-----------|-------|
| Model | gpt-4o |
| Temperature | 0.4 |
| Max Tokens | 3000 |

**Input:** Failure report listing each page's specific failures + Story Bible + All pages (passing ones as reference) + Strict constraints

**Rules:**
- Fix ONLY the specific failures listed
- Keep same story beat and tone
- Keep character names and events consistent
- Ensure refrain appears required number of times
- Count words and sentences before submitting

**Output:** `{ "rewritten_pages": [{ "page_number": N, "text": "..." }] }` (only failed pages)

**Note:** Character sheet generation (previously Step 3a) and separate illustration prompt generation (previously Step 3b) were consolidated into the combined Step 1 call. The `childVisualDetails` from photo analysis is now used directly as the character reference. Illustration prompts are generated inline with the story text.

### Style-Specific Rendering (Applied at Image Generation Time)

| Style | Shorthand Applied to fal.ai Prompts |
|-------|--------------------------------------|
| Cartoon | "bold cartoon with thick outlines, flat vivid colors, big expressive eyes" |
| Storybook | "warm painterly storybook illustration with soft brushstrokes and golden lighting" |
| Watercolor | "gentle watercolor with soft washes, pastel colors, and white paper showing through" |

---

## Step 4: Image Generation (Parallel)

**Purpose:** Transform the child's photo into illustrated story scenes using fal.ai.

### fal.ai API Configuration

| Parameter | Value |
|-----------|-------|
| Endpoint | https://queue.fal.run/fal-ai/flux-pro/kontext/max |
| Auth | Key-based (Key ${FAL_KEY}) |
| Output Format | JPEG |
| Aspect Ratio | 4:3 |
| Safety Tolerance | 6 |
| Num Images | 1 |
| Queue Polling | 3s interval |
| Max Attempts | 40 (120s total timeout) |

### Full Prompt Construction Template

```
Transform this photo into a [style_description] illustration.
Keep the child's face, features, and likeness EXACTLY as shown in the reference photo.
[style_render_instructions - see below]
Place the child in this scene: [illustration_prompt from Step 3b]
Setting is [theme_suffix].
The scene should feel warm, friendly, and appropriate for ages 3-7.
No text, words, or watermarks in the image.
```

### Style Render Instructions

**Cartoon:**
```
Use thick black outlines around everything. Use flat, saturated colors with no gradients.
Make the child's head slightly oversized (1/3 of body height) with huge expressive eyes
(taking up 40% of face). Colors should be bold primaries and secondaries.
Background should be simple geometric shapes. Add motion lines for action.
No texture, no realistic shading.
```

**Storybook:**
```
Use visible brushstrokes throughout. Build rich, layered color with detailed textures
(wood grain, fabric weave, individual leaves). Add warm golden-hour glow lighting.
Edges should be soft and blended. Use muted, warm palette (forest green, amber, burnt
orange, teal). Create clear foreground, midground, and background depth layers.
```

**Watercolor:**
```
Use transparent color washes with visible white paper showing through. Keep soft pastel
palette (pale blue, blush pink, buttercup yellow). Edges should dissolve into white.
Minimize detail -- suggest rather than define. Keep the image light, airy, and dreamy.
Leave white space. No hard lines or bold colors.
```

### Execution Pattern

```javascript
const results = await Promise.allSettled(
  storyContent.pages.map((page, i) =>
    generateIllustrationWithQualityCheck(
      page.illustration_prompt,
      referencePhotoUrl,
      illustration_style,
      theme,
      openaiKey,
      characterSheet,
      pageEmotions[i]  // WONDER, DELIGHT, EMPATHY, etc.
    )
  )
);

// fulfilled -> use returned URL
// rejected -> use fallbackImages[i % fallbackImages.length]
```

**Note:** Quality checks (previously Step 4b -- GPT-4o Vision reviewing each generated image) have been removed from the production pipeline to reduce API calls and stay within rate limits. The fal.ai Flux Pro Kontext/Max model produces sufficiently consistent results without per-image QA. If quality issues are observed, this step can be re-enabled when the OpenAI account rate limit is increased.

---

## Fallback System

### Trigger Condition
Any unhandled exception during `generateWithAI()` causes the entire pipeline to fall back.

### Fallback Stories (5 themes)

| Theme | Title | Refrain | Personalization |
|-------|-------|---------|-----------------|
| Dinosaurs | "${name} and Bramblesnout" | "Brave and kind, that's what we are" | Name only |
| Space | "Captain ${name} and the Stars" | "One more step, one more star" | Name only |
| Enchanted Forest | "${name} and the Song of Mosshollow" | "Together we listen, together we sing" | Name only |
| Superhero | "${name} and the Kindness Badge" | "Small acts, big hearts, that's our start" | Name only |
| Fairy Tale | "${name} and the Wobbly Kingdom" | "A crown to find, a world to mend" | Name only |

### Fallback Illustration Handling

| Condition | Behavior |
|-----------|----------|
| FAL_KEY available + photo_urls | fal.ai generates from photo using generic illustration prompts |
| FAL_KEY unavailable | Pre-curated Pexels stock photos (8 per theme) |

---

## Token Budget & Cost Analysis

### Per-Story Token Usage (Consolidated Pipeline)

| Step | Input Tokens (est.) | Output Tokens | Cost (GPT-4o) |
|------|-------------------|---------------|---------------|
| Photo Analysis | ~500 + image | ~100 | ~$0.01 |
| Combined Story Generation | ~2,000 | ~3,000 | ~$0.06 |
| Validation Rewrite (conditional) | ~3,000 | ~1,000 | ~$0.03 |
| **Total OpenAI (typical)** | **~2,500** | **~3,100** | **~$0.07** |
| **Total OpenAI (with fix)** | **~5,500** | **~4,100** | **~$0.10** |

### fal.ai Cost Per Story

| Scenario | Images Generated | Estimated Cost |
|----------|-----------------|---------------|
| All pass first try | 8 | ~$0.40 |
| **Typical** | **8** | **~$0.40** |

### Total Cost Per Story

| Scenario | OpenAI | fal.ai | Total |
|----------|--------|--------|-------|
| Best case (no photo, validation passes) | $0.06 | $0.40 | **$0.46** |
| Typical (photo + no rewrite needed) | $0.07 | $0.40 | **$0.47** |
| Worst case (photo + validation rewrite) | $0.10 | $0.40 | **$0.50** |

**Note:** Costs reduced ~70% from v2.0 by consolidating 6 API calls into 1-2.

---

## Timing Analysis

### Sequential Phase (Story Text): 5-50 seconds

| Step | Duration | Notes |
|------|----------|-------|
| Photo Analysis | 2-4s | Single image, low detail (skipped if no photo) |
| Rate limit wait (if 429) | 0-21s | Only if recent API call used the slot |
| Combined Story Generation | 5-10s | Full story + illustration prompts in one call |
| Local Validation | <100ms | No API call |
| Rate limit wait (if needed) | 0-21s | Only if rewrite is required |
| Targeted Rewrite | 4-6s | Only if pages fail validation (conditional) |

### Parallel Phase (Illustrations): 20-60 seconds

| Step | Duration | Notes |
|------|----------|-------|
| fal.ai queue wait | 5-15s | Variable by load |
| fal.ai generation | 10-30s | Per image |
| **Limited by slowest** | **20-60s** | All 8 submitted simultaneously |

### End-to-End Summary

| Scenario | Duration |
|----------|----------|
| Best case (no photo, validation passes, fast fal.ai) | ~30 seconds |
| Typical (photo + no rewrite + normal fal.ai) | ~45-60 seconds |
| With rate limit waits | ~60-90 seconds |
| Worst case (rate limit retries + slow fal.ai queue) | ~120-180 seconds |

---

## Error Handling Matrix

| Step | Error Type | Behavior | User Impact |
|------|-----------|----------|-------------|
| Photo Analysis | API error / timeout / 429 after retries | Silent catch, default "no details" | Illustrations less personalized |
| Combined Story Gen | 429 rate limit | Retry up to 5x with 21s+ backoff | Adds 21-105s to generation time |
| Combined Story Gen | Non-429 API error | **FATAL** - throws | Triggers fallback story |
| Combined Story Gen | JSON parse fail | **FATAL** - throws | Triggers fallback story |
| Validation/Rewrite | Any error | Non-fatal, skip | May have minor level violations |
| Validation/Rewrite | 429 after retries | Non-fatal, skip | Story text unchanged (still good) |
| Image Generation | Timeout (120s) | Use fallback image for that page | Stock photo for 1 page |
| Image Generation | API error | Use fallback image for that page | Stock photo for 1 page |
| DB Insert | Any error | Return 500, story stuck "generating" | User sees infinite loading |

### Rate Limit Retry Behavior

```
429 Response -> Parse retry-after header (or default 21s)
             -> Wait (attempt + 1) * 21s
             -> Retry (max 5 attempts)
             -> After 5 failures: throw (triggers fallback for fatal steps)
```

---

## Consistency Strategy

### How Consistency is Maintained

| Layer | Method | Effectiveness |
|-------|--------|--------------|
| Narrative | Single Story Bible referenced by all text steps | High |
| Character voice | Editorial review criterion #8 | Medium-High |
| Visual identity | Character Sheet + photo reference per call | Medium |
| Color palette | Specified in illustration_notes + style config | Medium |
| Style | Render instructions in each prompt | Medium-Low |
| Cross-page visual | Independent generation (no inter-page reference) | Low |

### Known Consistency Gaps

1. **Cross-image drift** -- Each fal.ai call is independent; no reference to other generated pages
2. **Outfit variation** -- Text description doesn't guarantee identical clothing rendering
3. **Sidekick appearance** -- Character description in prompt but no visual reference image
4. **Style bleeding** -- Single model handling 3 very different styles via prompt alone
5. **No feedback loop** -- If page 3 deviates, page 4 doesn't compensate

### Recommended Improvements

1. **LoRA fine-tuning** -- Train per-child adapter on 3 uploaded photos for consistent face across all pages
2. **Sequential with reference** -- Use page 1 output as style reference for pages 2-8
3. **Consistent seed** -- Pass fixed random seed for all pages of one story
4. **Style-specific models** -- Use different fal.ai models per art style
5. **CLIP similarity scoring** -- Measure embedding distance between pages, regenerate outliers
6. **Negative prompt parameters** -- Pass negatives as model parameter, not just in text prompt

---

## Optimization History

### Completed (v3.0)

1. **Consolidated 6 API calls into 1-2** -- Reduced from story bible + story text + editorial review + validation rewrite + character sheet + illustration prompts to a single combined call + conditional validation fix
2. **Added 429 retry with backoff** -- 5 retries with 21s+ exponential wait handles 3 RPM limit
3. **Removed per-image quality checks** -- Eliminated 8 additional GPT-4o Vision calls per story
4. **Cost reduction ~70%** -- From ~$0.35 to ~$0.07-0.10 per story (OpenAI portion)

### Remaining Opportunities

#### Short-term (No architecture changes)

1. **Upgrade OpenAI tier** -- Increasing from 3 RPM eliminates all rate limit waits and would allow re-enabling the multi-step pipeline for higher quality
2. **Cache validated stories** -- Skip validation rewrite for repeat theme+level combinations
3. **Progressive page display** -- Show each page as it completes instead of all-at-once

#### Medium-term

1. **Streaming responses** -- Stream story text to show real-time progress
2. Use **Supabase Realtime** instead of polling for completion notification
3. **Re-enable editorial review** -- Once rate limits allow, add back the quality pass as a separate call

#### Long-term

1. **Fine-tuned story model** -- Custom model trained on children's literature corpus
2. **LoRA per child** -- Persistent adapters for returning users
3. **Evaluation pipeline** -- Automated scoring against quality rubric
4. **A/B testing** -- Systematic prompt improvement with engagement metrics

---

*End of AI Pipeline Architecture Document*
