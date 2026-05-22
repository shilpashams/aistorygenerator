# AI Pipeline Architecture Document
## AI Children's Storybook Application

**Version**: 2.0  
**Date**: 2026-05-21  
**Models**: OpenAI GPT-4o, fal.ai Flux Pro Kontext/Max  
**Runtime**: Supabase Edge Functions (Deno)

---

## Pipeline Overview

The AI pipeline generates a complete 8-page personalized children's storybook from a child's profile and photos. It orchestrates 6-8 sequential OpenAI calls for text generation, followed by 8 parallel fal.ai calls for illustration, each with up to 2 quality-check retries.

```
INPUT:                           OUTPUT:
+------------------+             +------------------+
| Child Name       |             | Story Title      |
| Age (2-12)       |             | 8 Pages:         |
| Interests[]      |             |   - text_content |
| Reading Level    |   PIPELINE  |   - illustration |
| Theme            | ==========> | Character Sheet  |
| Style            |             | Story Bible      |
| Photo URLs[]     |             +------------------+
| Personality Data |
+------------------+

PIPELINE STEPS:
  0. Photo Analysis        [GPT-4o Vision, T=0.3, 200 tok]
  1. Story Bible           [GPT-4o Chat,   T=0.7, 4096 tok]
  2. Story Writing         [GPT-4o Chat,   T=0.7, 3000 tok]
  2b. Editorial Review     [GPT-4o Chat,   T=0.4, 3000 tok] (non-fatal)
  2c. Validation + Rewrite [Local + GPT-4o, T=0.4, 3000 tok] (non-fatal)
  3a. Character Sheet      [GPT-4o Chat,   T=0.4, 2000 tok] (non-fatal)
  3b. Illustration Prompts [GPT-4o Chat,   T=0.7, 4000 tok]
  4.  Image Generation     [fal.ai x8 parallel, 120s timeout each]
  4b. Quality Checks       [GPT-4o Vision x8, T=0.2, 500 tok each]
```

---

## Step 0: Photo Analysis

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

---

## Step 1: Story Bible Generation

**Purpose:** Create a comprehensive narrative blueprint ensuring story coherence, deep personalization, and age-appropriateness before any text is written.

**API Configuration:**
| Parameter | Value |
|-----------|-------|
| Model | gpt-4o |
| Temperature | 0.7 (creative freedom) |
| Max Tokens | 4096 |
| Input | Full StoryRequest + childVisualDetails |

### Prompt Assembly Components

**1. Theme World-Building (5 pre-defined templates):**

| Theme | Setting | Characters | Sensory Palette |
|-------|---------|------------|-----------------|
| Dinosaurs | Warm valley, ferns, river | Baby triceratops, pterodactyl, brachiosaurus | Earthy, warm, crunchy |
| Space | Cozy spaceship, planets, stars | Crystal creatures, jelly-blobs, station keepers | Sparkly, humming, weightless |
| Enchanted Forest | Magical forest, mushrooms, brook | Badger, owl, woodland mice | Mossy, rustling, glowing |
| Superhero | Neighborhood, park, rooftops | Baker, crossing guard, neighbors | Urban, bustling, warm |
| Fairy Tale | Castle, cobblestone village | Tiny dragon, fairy godparent, jolly king | Golden, silky, echoing |

**2. Age-Appropriate Problem-Solving:**

| Age | Strategy Complexity |
|-----|-------------------|
| <= 3 | Simple physical actions (push, pull, stack, hug, shout). One thing works. |
| <= 4 | One-step idea voiced aloud + physical action |
| <= 5 | Pattern recognition, asking for help, combining two simple ideas |
| > 5 | Creative planning, explaining to others, two-step strategy |

**3. Story Mood Guidance (6 moods):**

| Mood | Tone | Emotional Movement | Ending |
|------|------|-------------------|--------|
| bedtime-calm | Gentle, quiet, soothing | Slowing pace through story | Eyes closing, warmth, safety |
| silly-adventure | Playful, giggly, surprising | Absurd escalation | Belly-laugh joy |
| bravery | Encouraging, empowering | Uncertain -> courageous | Proud |
| friendship | Warm, kind, connected | Alone -> together | Deep belonging |
| confidence | Affirming, celebratory | Self-doubt -> self-belief | Pride |
| curiosity | Wondering, exploratory | Questions -> exploration | Wonder + excitement |

**4. Personalization Rules (6 rules):**

| Rule | How Applied |
|------|------------|
| Favorite Toy | Appears as magical item, companion, or plot-solving tool |
| Favorite Things | Colors -> world palette/sidekick trait; Animals -> sidekick species; Foods -> magical items |
| Interests as Actions | Dinosaurs -> recognizes tracks/speaks dino; Space -> navigates stars/presses buttons; Art -> draws solution alive; Music -> sings/hums/plays rhythm |
| Pride & Learning | proud_of becomes "superpower"; currently_learning becomes gentle lesson/fear to overcome |
| Age Shapes Hero | Solution achievable for actual age; emotional moment age-appropriate; strength age-genuine |
| Nickname & Family Phrase | Nickname used naturally by sidekick; family_phrase inspires the recurring 5-8 word refrain |

### Output JSON Schema

```json
{
  "title": "Short catchy title",
  "main_character": {
    "name": "child's name",
    "personality": ["trait1", "trait2", "trait3"],
    "child_specific_details": ["moment1", "moment2", "moment3"],
    "age_appropriate_strength": "description"
  },
  "sidekick": {
    "name": "creative name (Bramblesnout, Fizzbeak, etc.)",
    "species_or_type": "type",
    "appearance": ["detail1", "detail2", "detail3", "detail4"],
    "personality_trait": "description",
    "voice": "speech pattern",
    "catchphrase": "short phrase"
  },
  "story_world": {
    "setting": { "named_place": "location", "landmarks": ["x", "y", "z"] },
    "magical_object": "description (inspired by toy/thing)",
    "sensory_details": { "smell": "...", "sound": "...", "texture": "..." },
    "rules": "one magical/special rule"
  },
  "emotional_core": {
    "child_strength": "action using interest as verb",
    "small_fear": "relatable uncertainty (not phobia)",
    "recurring_phrase": "5-8 word musical phrase",
    "emotional_arc": { "starting": "emotion", "mid": "emotion", "ending": "emotion" }
  },
  "page_outline": [
    { "beat": "WONDER", "one_line": "..." },
    { "beat": "DELIGHT", "one_line": "..." },
    { "beat": "EMPATHY", "one_line": "..." },
    { "beat": "EXCITEMENT", "one_line": "..." },
    { "beat": "TEAMWORK", "one_line": "..." },
    { "beat": "TENSION", "one_line": "..." },
    { "beat": "TRIUMPH", "one_line": "..." },
    { "beat": "WARMTH", "one_line": "..." }
  ],
  "illustration_notes": {
    "child_depiction": "visual details from photo analysis",
    "child_visual_in_story": "how to lightly weave appearance (1-2 moments)",
    "sidekick_visual": "exact repeated visual description",
    "color_palette": ["color1", "color2", "color3", "color4"],
    "lighting_mood": "warm golden / soft morning / etc."
  }
}
```

---

## Step 2: Story Text Writing

**Purpose:** Write the complete 8-page story text following the Story Bible exactly, enforcing strict reading-level constraints.

**API Configuration:**
| Parameter | Value |
|-----------|-------|
| Model | gpt-4o |
| Temperature | 0.7 |
| Max Tokens | 3000 |
| Input | StoryRequest + Story Bible JSON + Reading Level block |

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

---

## Step 2b: Editorial Review (Non-Fatal)

**Purpose:** Professional editing pass against 8 strict quality criteria.

**API Configuration:**
| Parameter | Value |
|-----------|-------|
| Model | gpt-4o |
| Temperature | 0.4 (conservative) |
| Max Tokens | 3000 |
| Input | StoryRequest + Story Bible + Draft Pages |

### 8 Review Criteria

1. **Reading Level Enforcement** - All constraints from level config verified
2. **Emotional Arc** - WONDER -> DELIGHT -> EMPATHY -> EXCITEMENT -> TEAMWORK -> TENSION -> TRIUMPH -> WARMTH; tension must be mild "can I do this?" uncertainty
3. **Repetition & Refrain** - Musical phrase appearing required number of times as anticipated drumbeat
4. **Read-Aloud Rhythm** - Alliteration, assonance, varied cadence, one onomatopoeia per page
5. **Safety** - No violence, peril, death, abandonment, bullying, exclusion, anxiety triggers
6. **No Generic Filler** - Every sentence specific to THIS child's story; if not serving plot/emotion, replace
7. **Child Personalization** - Interests ACTIVE, toy present, nickname used, pride connected, family phrase inspiring refrain
8. **Page-to-Page Consistency** - Names, personality, objects, setting, mood maintained throughout

**Error Handling:** On any failure (parse error, malformed response, different page count), original draft text is preserved unchanged.

---

## Step 2c: Reading-Level Validation (Non-Fatal)

**Purpose:** Automated local validation (no API) to catch reading-level violations, followed by targeted AI rewrite of only the failing pages.

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

---

## Step 3a: Character Sheet Generation (Non-Fatal)

**Purpose:** Create a visual reference ensuring the child character looks consistent across all 8 illustrations.

**API Configuration:**
| Parameter | Value |
|-----------|-------|
| Model | gpt-4o |
| Temperature | 0.4 |
| Max Tokens | 2000 |
| Input | childVisualDetails + illustration_style + Story Bible |

**Output Fields:**
- Hair (style, color, length, accessories)
- Outfit (clothing items, colors, patterns)
- Shoes and accessories
- Body type/proportions (age-appropriate)
- Expression range (matched to story mood)
- Art style rendering (how to draw in selected style)
- Consistent elements (what must NEVER change between pages)

**Fallback:** If generation fails, uses raw `childVisualDetails` from photo analysis.

---

## Step 3b: Illustration Prompt Generation

**Purpose:** Generate precise, style-specific art direction for each page.

**API Configuration:**
| Parameter | Value |
|-----------|-------|
| Model | gpt-4o |
| Temperature | 0.7 |
| Max Tokens | 4000 |
| Input | Story Bible + Final Pages + Style + Character Sheet |

### Style-Specific Directives

| Style | Prompt Prefix | Key Traits | Negatives |
|-------|--------------|-----------|-----------|
| Cartoon | "Bright 2D cartoon illustration for a preschool storybook." | Rounded shapes, bold clean outlines, expressive eyes, saturated colors, simple backgrounds, funny energetic poses | No painterly texture, no realistic lighting, no 3D, no text |
| Storybook | "Soft hand-painted children's storybook illustration." | Warm gentle lighting, watercolor/gouache texture, soft strokes, cozy details, emotional expression, classic composition | No bold outlines, no 3D, no text, no distorted faces |
| Watercolor | "Delicate watercolor painting for a children's picture book." | Transparent washes, gentle bleeds, white paper showing, dreamy pastels, soft undefined edges, luminous, quiet graceful poses | No bold outlines, no saturated flat colors, no hard edges, no 3D, no text |

### Style Avoidance Lists

| Style | Must Avoid |
|-------|-----------|
| Cartoon | painterly textures, realistic lighting, 3D plastic look, text, watercolor washes, soft blended edges, muted earthy tones, complex shadows |
| Storybook | bold cartoon outlines, 3D plastic look, text, flat color fills, exaggerated proportions, neon colors, sticker-like graphics, hard geometric shapes |
| Watercolor | bold outlines, saturated flat colors, hard edges, complex detail, dark shadows, geometric shapes, 3D rendering, text |

**Output:** `{ "illustration_prompts": [{ "page_number": N, "illustration_prompt": "Single sentence..." }] }`

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
The scene should feel warm, friendly, and appropriate for ages 3-6.
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

---

## Step 4b: Quality Check (Per Image)

**Purpose:** Verify each illustration meets quality and consistency standards before accepting.

**API Configuration:**
| Parameter | Value |
|-----------|-------|
| Model | gpt-4o (vision) |
| Temperature | 0.2 (strict/deterministic) |
| Max Tokens | 500 |
| Input | Generated image URL + evaluation criteria |

### 10-Point Quality Criteria

| # | Category | Rejection Condition |
|---|----------|-------------------|
| 1 | IDENTITY | Child looks like a different person (wrong hair/outfit/age) |
| 2 | FACE | Distorted, asymmetric, uncanny valley effect |
| 3 | AGE | Child appears older than 7 |
| 4 | HANDS | Malformed, extra/missing fingers |
| 5 | TEXT | Any text, letters, words, watermarks visible |
| 6 | BLUR | Blurry, low-resolution, unfocused areas |
| 7 | STYLE MATCH | Style doesn't match expected (cartoon/storybook/watercolor) |
| 8 | STYLE CONFUSION | Cartoon looks painted OR Storybook looks flat |
| 9 | EMOTION | Page emotion doesn't match expected beat |
| 10 | CONSISTENCY | Outfit/hairstyle dramatically changed from character sheet |

### Retry Logic

```
attempt 0: generate -> quality check -> pass: done / fail: retry
attempt 1: generate -> quality check -> pass: done / fail: retry
attempt 2: generate -> return immediately (skip check, guaranteed output)
```

**Max per page:** 3 generations, 2 quality checks
**Max per story (worst case):** 24 generations, 16 quality checks

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

### Per-Story Token Usage (All Steps)

| Step | Input Tokens (est.) | Output Tokens | Cost (GPT-4o) |
|------|-------------------|---------------|---------------|
| Photo Analysis | ~500 + image | ~100 | ~$0.01 |
| Story Bible | ~3,000 | ~2,000 | ~$0.04 |
| Story Writing | ~4,000 | ~2,000 | ~$0.05 |
| Editorial Review | ~5,000 | ~2,000 | ~$0.06 |
| Targeted Rewrite | ~4,000 | ~1,000 | ~$0.04 |
| Character Sheet | ~2,000 | ~800 | ~$0.02 |
| Illustration Prompts | ~4,000 | ~2,000 | ~$0.05 |
| Quality Checks (8x) | ~500 + img x8 | ~200 x8 | ~$0.08 |
| **Total OpenAI** | **~27,000** | **~12,000** | **~$0.35** |

### fal.ai Cost Per Story

| Scenario | Images Generated | Estimated Cost |
|----------|-----------------|---------------|
| All pass first try | 8 | ~$0.40 |
| 50% need 1 retry | 12 | ~$0.60 |
| Worst case (all max retry) | 24 | ~$1.20 |
| **Typical** | **10** | **~$0.50** |

### Total Cost Per Story

| Scenario | OpenAI | fal.ai | Total |
|----------|--------|--------|-------|
| Best case | $0.27 | $0.40 | **$0.67** |
| Typical | $0.35 | $0.50 | **$0.85** |
| Worst case | $0.35 | $1.20 | **$1.55** |

---

## Timing Analysis

### Sequential Phase (Story Text): 25-50 seconds

| Step | Duration | Notes |
|------|----------|-------|
| Photo Analysis | 2-4s | Single image, low detail |
| Story Bible | 5-10s | Large output (4096 tokens) |
| Story Writing | 5-8s | Medium output |
| Editorial Review | 5-8s | Lower temperature, analysis-heavy |
| Validation | <100ms | Local computation, no API |
| Targeted Rewrite | 4-6s | Only if pages fail (conditional) |
| Character Sheet | 3-5s | Small output |
| Illustration Prompts | 5-8s | Medium output |

### Parallel Phase (Illustrations): 20-60 seconds

| Step | Duration | Notes |
|------|----------|-------|
| fal.ai queue wait | 5-15s | Variable by load |
| fal.ai generation | 10-30s | Per image |
| Quality check | 3-5s | Per image |
| Retry (if needed) | +15-35s | Per failed image |
| **Limited by slowest** | **20-60s** | |

### End-to-End Summary

| Scenario | Duration |
|----------|----------|
| Best case | ~45 seconds |
| Typical | ~60-90 seconds |
| Worst case (retries + slow queue) | ~120-180 seconds |

---

## Error Handling Matrix

| Step | Error Type | Behavior | User Impact |
|------|-----------|----------|-------------|
| Photo Analysis | API error / timeout | Silent catch, default "no details" | Illustrations less personalized |
| Story Bible | JSON parse fail | Log warning, use raw text | Downstream quality may degrade |
| Story Bible | API error | **FATAL** - throws | Triggers fallback story |
| Story Writing | Any error | **FATAL** - throws | Triggers fallback story |
| Editorial Review | Any error | Non-fatal, skip | Unedited text (still good) |
| Validation/Rewrite | Any error | Non-fatal, skip | May have level violations |
| Character Sheet | Any error | Use photo details fallback | Less consistent illustrations |
| Illustration Prompts | Any error | **FATAL** - throws | Triggers fallback story |
| Image Generation | Timeout (120s) | Use fallback image for that page | Stock photo for 1 page |
| Image Generation | API error | Use fallback image for that page | Stock photo for 1 page |
| Quality Check | API error | Auto-pass (accept image) | May accept lower quality |
| DB Insert | Any error | Return 500, story stuck "generating" | User sees infinite loading |

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

## Optimization Opportunities

### Short-term (No architecture changes)

1. Use **gpt-4o-mini** for editorial review and validation rewrite (same quality, 10x cheaper, 2x faster)
2. Skip editorial review for beginner level (simpler text needs less editing)
3. Reduce quality check retries to **1** (diminishing returns on 3rd attempt)
4. Cache Story Bibles for same child+theme combinations

### Medium-term

1. **Streaming responses** -- Stream story text to show real-time progress
2. **Progressive page display** -- Show each page as it completes instead of all-at-once
3. **Batch fal.ai submission** -- Submit all 8 simultaneously with webhook callbacks
4. Use **Supabase Realtime** instead of polling for completion notification

### Long-term

1. **Fine-tuned story model** -- Custom model trained on children's literature corpus
2. **LoRA per child** -- Persistent adapters for returning users
3. **Evaluation pipeline** -- Automated scoring against quality rubric
4. **A/B testing** -- Systematic prompt improvement with engagement metrics
5. **Pre-generated Story Bibles** -- Popular combinations pre-cached

---

*End of AI Pipeline Architecture Document*
