import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StoryRequest {
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

interface GeneratedPage {
  page_number: number;
  text: string;
  illustration_prompt: string;
}

interface GeneratedStory {
  title: string;
  pages: GeneratedPage[];
  characterSheet: string;
}

const themeDescriptions: Record<string, string> = {
  dinosaurs: "a colorful prehistoric world with friendly dinosaurs, lush jungles, and volcanoes in the background",
  space: "outer space with colorful planets, sparkling stars, nebulae, and a cozy spaceship",
  "enchanted-forest": "a magical enchanted forest with glowing mushrooms, fairy lights, ancient trees, and woodland creatures",
  superhero: "a vibrant city skyline with dramatic lighting, capes flowing in the wind, and heroic poses",
  "fairy-tale": "a whimsical fairy tale kingdom with castles, dragons, enchanted gardens, and sparkling magic",
};

const styleDescriptions: Record<string, string> = {
  watercolor: "soft watercolor painting with transparent washes bleeding into white paper, pastel palette, gentle pencil underdrawing, dreamy dissolved edges, minimal detail, flowing organic shapes, Oliver Jeffers aesthetic",
  cartoon: "bold cartoon illustration with thick black outlines, flat vivid saturated colors, exaggerated expressions with huge eyes, oversized head proportions, dynamic poses with motion lines, simple geometric backgrounds, Cartoon Network aesthetic",
  storybook: "traditional painterly storybook illustration with visible brushstrokes, rich layered color, realistic proportions, detailed textured environments, warm golden atmospheric lighting, soft blended edges, muted earthy palette with jewel accents, Beatrix Potter meets Studio Ghibli aesthetic",
};

interface ReadingLevelConfig {
  label: string;
  ageRange: string;
  pages: number;
  sentencesPerPage: [number, number];
  wordsPerSentence: [number, number];
  vocabulary: string;
  refrainRule: string;
  forbiddenEmotions: string[];
  allowedEmotions: string[];
  dialogueRule: string;
  descriptionRule: string;
  metaphorRule: string;
  arcStructure: string;
  problemSolving: string;
  emotionalGrowth: string;
  sensoryDetails: string;
}

const readingLevelConfig: Record<string, ReadingLevelConfig> = {
  beginner: {
    label: "BEGINNER",
    ageRange: "ages 3-4",
    pages: 8,
    sentencesPerPage: [1, 2],
    wordsPerSentence: [5, 9],
    vocabulary: "common preschool words only (mama, dada, big, little, run, jump, splash, yummy, uh-oh, yay, look, go, stop, more, up, down, in, out, happy, sad, loud, soft, hot, cold)",
    refrainRule: "repeat a simple 3-5 word refrain every 2 pages (pages 1, 3, 5, 7 or pages 2, 4, 6, 8)",
    forbiddenEmotions: ["determined", "anxious", "relieved", "frustrated", "overwhelmed", "conflicted", "proud", "grateful", "confident", "hesitant", "melancholy"],
    allowedEmotions: ["happy", "sad", "scared", "brave", "silly", "surprised", "excited", "mad", "tired", "shy"],
    dialogueRule: "NO dialogue except single exclamations: 'Oh no!' 'Yay!' 'Whee!' 'Look!' 'Uh-oh!' -- never 'said [character]' constructions",
    descriptionRule: "no long descriptions -- one action per sentence, show don't describe",
    metaphorRule: "no metaphors unless extremely simple and physical (e.g., 'big as a house')",
    arcStructure: "discover -> try -> oops -> try again -> yay!",
    problemSolving: "problems solved by one direct physical action (push, pull, hug, shout)",
    emotionalGrowth: "no emotional growth arc -- child is simply happy at the end",
    sensoryDetails: "one sound effect per page (SPLAT! BOOM! SWOOSH!) -- no other sensory detail needed",
  },
  intermediate: {
    label: "INTERMEDIATE",
    ageRange: "ages 5-6",
    pages: 8,
    sentencesPerPage: [2, 4],
    wordsPerSentence: [8, 14],
    vocabulary: "simple but richer vocabulary allowed (curious, enormous, shimmer, tumbled, whispered, glimmered, wobbled, enormous, scattered, rumbled) -- still concrete, never abstract",
    refrainRule: "a 5-8 word musical refrain appears on at least 3 pages, naturally woven into the narrative",
    forbiddenEmotions: ["existential", "philosophical", "resentful", "vindictive", "traumatized", "nihilistic"],
    allowedEmotions: ["happy", "sad", "scared", "brave", "silly", "surprised", "excited", "nervous", "proud", "curious", "determined", "relieved", "grateful", "shy", "hopeful"],
    dialogueRule: "include dialogue on at least 4 pages -- real short exchanges between child and sidekick (1-2 lines each)",
    descriptionRule: "use sensory details actively on every page -- what it smells, tastes, feels, sounds like",
    metaphorRule: "allow exactly ONE gentle metaphor per story (e.g., 'courage bloomed in her chest like a sunflower') -- no more than one",
    arcStructure: "setup -> rising action with a twist -> false solution attempt -> real solution -> denouement with emotional reflection",
    problemSolving: "light problem-solving: child observes, thinks aloud, tries an idea, adjusts approach if first attempt fails",
    emotionalGrowth: "simple emotional growth: the child learns one thing about themselves by the end (I am braver than I thought / I can ask for help / trying is what matters)",
    sensoryDetails: "rich sensory details on every page -- one smell, sound, texture, taste, or temperature per page minimum",
  },
};

function getReadingLevelPromptBlock(level: string): string {
  const cfg = readingLevelConfig[level] || readingLevelConfig.beginner;

  const beginnerExample = `
EXAMPLE PAGE (this is the target quality and style):
"Luna found a blue shell. Tap, tap, tap! Something was inside."
WHY THIS WORKS:
- Very short (2 sentences, 5 and 7 words)
- Concrete and physical (found, tap)
- Easy to read aloud (rhythm, onomatopoeia)
- One clear action per sentence
- No abstract explanation -- the reader SEES what happens`;

  const intermediateExample = `
EXAMPLE PAGE (this is the target quality and style):
"Luna found a blue shell glowing under the sand. When she tapped it gently, a tiny crab peeked out and whispered, 'I lost my moon map!'"
WHY THIS WORKS:
- Still simple but more detail (glowing under the sand)
- Richer vocabulary (glowing, gently, peeked, whispered)
- Dialogue that establishes character and story setup
- Stronger story hook (lost my moon map = mystery + quest)
- Sensory detail woven in naturally (glowing, under the sand)
- Two sentences, 9 and 18 words -- varied length for rhythm`;

  const example = level === "beginner" ? beginnerExample : intermediateExample;

  return `READING LEVEL CONFIG: ${cfg.label} (${cfg.ageRange})
- Pages: ${cfg.pages}
- Sentences per page: ${cfg.sentencesPerPage[0]}-${cfg.sentencesPerPage[1]} (STRICT -- never exceed ${cfg.sentencesPerPage[1]})
- Words per sentence: ${cfg.wordsPerSentence[0]}-${cfg.wordsPerSentence[1]} (STRICT -- count words, stay in range)
- Vocabulary: ${cfg.vocabulary}
- Refrain: ${cfg.refrainRule}
- FORBIDDEN emotion words: ${cfg.forbiddenEmotions.join(", ")} -- NEVER use these
- ALLOWED emotion words: ${cfg.allowedEmotions.join(", ")} -- use ONLY these
- Dialogue: ${cfg.dialogueRule}
- Descriptions: ${cfg.descriptionRule}
- Metaphors: ${cfg.metaphorRule}
- Story arc: ${cfg.arcStructure}
- Problem-solving: ${cfg.problemSolving}
- Emotional growth: ${cfg.emotionalGrowth}
- Sensory: ${cfg.sensoryDetails}
${example}`;
}

function generateCreativeSeed(): string {
  const openings = [
    "The story begins with an unusual discovery",
    "The story starts with the child waking to find something changed",
    "The story opens mid-adventure with the child already on a mission",
    "The story begins with a mysterious sound that draws the child outside",
    "The story starts with the child receiving a strange gift",
    "The story opens with the child noticing something nobody else can see",
    "The story begins with the child being asked for help by a tiny creature",
    "The story starts when something falls from the sky",
    "The story opens with the child following a trail of glowing footprints",
    "The story begins when the child's favorite thing comes alive",
    "The story starts with a map appearing in an unexpected place",
    "The story opens with a riddle whispered by the wind",
  ];
  const conflicts = [
    "Someone has lost something precious and needs help finding it",
    "Two friends are arguing and need a peacemaker",
    "A magical place is fading and needs to be restored",
    "A creature is stuck and can't get home alone",
    "Something important has been accidentally broken",
    "A celebration is about to go wrong unless someone steps up",
    "A path forward is blocked by a puzzle only a child can solve",
    "An enchantment has gone sideways and needs creative undoing",
    "Someone is too scared to try something new and needs encouragement",
    "A secret has been discovered that changes everything",
    "The weather has gone wild and needs calming",
    "A mischievous creature has mixed everything up",
  ];
  const twists = [
    "The obvious solution doesn't work and something unexpected is needed",
    "A character who seemed unhelpful turns out to be the key",
    "The problem is actually a disguised opportunity",
    "The child must use their least favorite skill to succeed",
    "What looked scary turns out to be friendly",
    "The child discovers the answer was with them all along",
    "Two problems combine into one elegant solution",
    "A mistake accidentally reveals the right path",
    "The sidekick's quirky habit saves the day",
    "The child must teach someone else to solve the final challenge",
  ];
  const opening = openings[Math.floor(Math.random() * openings.length)];
  const conflict = conflicts[Math.floor(Math.random() * conflicts.length)];
  const twist = twists[Math.floor(Math.random() * twists.length)];
  return `CREATIVE DIRECTION (follow these story seeds to create a UNIQUE story):
- Opening: ${opening}
- Central conflict: ${conflict}
- Twist: ${twist}
- Unique story ID: ${crypto.randomUUID().slice(0, 8)}`;
}

function buildStoryBiblePrompt(req: StoryRequest, childVisualDetails: string): string {
  const creativeSeed = generateCreativeSeed();

  const themeWorldBuilding: Record<string, string> = {
    dinosaurs: `WORLD SEED: A warm, green prehistoric valley with giant ferns, a sparkly river, and friendly dinosaurs.
POSSIBLE CHARACTERS: A clumsy baby triceratops, a chatty pterodactyl, a gentle old brachiosaurus.
SENSORY PALETTE: Crunchy leaves, warm mud, rumbling footsteps, sweet tropical flowers.`,

    space: `WORLD SEED: A cozy little spaceship visiting colorful planets and twinkling stars.
POSSIBLE CHARACTERS: A sparkly crystal creature, a bouncy jelly-blob alien, a kind station keeper.
SENSORY PALETTE: Humming engines, floating in zero-gravity, warm cockpit glow, cold starlight.`,

    "enchanted-forest": `WORLD SEED: A deep magical forest with glowing mushrooms, mossy paths, and a babbling brook.
POSSIBLE CHARACTERS: A badger in a berry-stained apron, a copper-feathered owl, woodland mice.
SENSORY PALETTE: Crunching twigs, pine smell, dappled sunlight, cool moss, birdsong.`,

    superhero: `WORLD SEED: A friendly neighborhood with a park, shops, and rooftops to leap between.
POSSIBLE CHARACTERS: A flour-dusted baker with courage-cakes, a speedy crossing guard, kind neighbors.
SENSORY PALETTE: Wind on rooftops, warm sunshine, cape fluttering, city sounds, the smell of cinnamon rolls.`,

    "fairy-tale": `WORLD SEED: A storybook kingdom with a wonky castle, rolling hills, and a cobblestone village.
POSSIBLE CHARACTERS: A tiny dragon afraid of fire, a fairy godparent who is always late, a jolly king.
SENSORY PALETTE: Creaking drawbridge, trumpet fanfares, velvet cloaks, feast smells, dewy grass.`,
  };

  const ageProblemSolving = req.age <= 3
    ? "Problems are solved through simple physical actions: pushing, pulling, stacking, hugging, calling out loud. The child succeeds by trying one thing and it works."
    : req.age <= 4
    ? "Problems are solved through one-step ideas the child voices aloud: 'What if we...?' Physical actions combined with a single observation."
    : req.age <= 5
    ? "Problems are solved by noticing a pattern, asking a friend for help, or combining two simple ideas. The child can make one logical connection."
    : "Problems are solved by the child thinking of a creative plan, explaining it to others, and leading the effort. Can involve a two-step strategy.";

  const storyMoodGuidance: Record<string, string> = {
    "bedtime-calm": "TONE: Gentle, quiet, soothing. The pace slows with each page. End with eyes closing, warmth, safety. Use soft sounds (whisper, hush, murmur). The emotional arc should end in deep comfort and peace.",
    "silly-adventure": "TONE: Playful, giggly, full of surprises. Include something absurd or unexpected on every page. Use funny sounds and slapstick moments. The emotional arc should end in belly-laugh joy.",
    "bravery": "TONE: Encouraging, empowering. The child faces something that feels big and discovers they're braver than they thought. The emotional arc should move from uncertain to courageous to proud.",
    "friendship": "TONE: Warm, kind, connected. The story celebrates what it means to be there for someone. Include acts of sharing, listening, and helping. The emotional arc should end in deep belonging.",
    "confidence": "TONE: Affirming, celebratory. The child tries something new and discovers they can do it. Include a moment of self-doubt that transforms into self-belief. The emotional arc should end in pride and self-trust.",
    "curiosity": "TONE: Wondering, exploratory, delighted by discovery. The child asks questions and finds answers through exploration. Include moments of surprise and 'aha!' realizations. The emotional arc should end in wonder and excitement to learn more.",
  };

  const readingLevelBlock = getReadingLevelPromptBlock(req.reading_level);

  return `You are a children's picture book author planning a story for ages 3-6. Before writing, you always create a Story Bible -- a creative blueprint that ensures consistency, emotional depth, and a story children will demand again and again.

IMPORTANT: Every story you create must be COMPLETELY UNIQUE. Never reuse the same plot, sidekick name, title, or narrative structure. Each story should feel like a brand new adventure even if the same child and theme are used.

${creativeSeed}

${readingLevelBlock}

CHILD DETAILS:
- Name: ${req.name}
- Age: ${req.age}
- Nickname: ${req.nickname || "none provided"}
- Interests: ${req.interests.join(", ")}
- Favorite things (color, animal, food): ${req.favorite_things || "not specified"}
- Favorite toy or comfort object: ${req.favorite_toy || "not specified"}
- Something they're proud of: ${req.proud_of || "not specified"}
- Something they're currently learning: ${req.currently_learning || "not specified"}
- Family phrase: ${req.family_phrase || "none provided"}
- Themes to AVOID: ${req.themes_to_avoid || "none"}
- Visual details from photo: ${childVisualDetails !== "no details extracted" ? childVisualDetails : "none available"}

STORY MOOD: ${req.story_mood || "silly-adventure"}
${storyMoodGuidance[req.story_mood] || storyMoodGuidance["silly-adventure"]}

THEME: ${req.theme}
${themeWorldBuilding[req.theme] || themeWorldBuilding["enchanted-forest"]}

AGE-APPROPRIATE PROBLEM SOLVING (age ${req.age}):
${ageProblemSolving}

CRITICAL -- PERSONALIZATION RULES:
The child's details are NOT decorations. They must be CENTRAL to the plot. This story should feel like it could ONLY be about THIS child.

1. FAVORITE TOY/COMFORT OBJECT: "${req.favorite_toy || "not specified"}"
   - If provided, this object MUST appear in the story as a magical item, a companion, or a tool that helps solve the problem
   - Example: "Stuffed bunny named Flopsy" = Flopsy comes alive as a character, or a bunny-shaped key unlocks the solution

2. FAVORITE THINGS AS PLOT ELEMENTS: Parse "${req.favorite_things || "not specified"}" and use them:
   - If a COLOR is mentioned: it becomes the color of the magical world, the sidekick's key visual trait, or a glowing magical object
   - If an ANIMAL is mentioned: it inspires or becomes the sidekick character
   - If a TOY or OBJECT is mentioned: it appears as a story object central to the plot
   - If a FOOD is mentioned: it becomes a magical food in the story world

3. INTERESTS AS ACTIONS: The child's interests (${req.interests.join(", ")}) must become things ${req.name} DOES in the story -- not things they merely like:
   - "Dinosaurs" = ${req.name} recognizes dino tracks, speaks dino language, or digs up something
   - "Space" = ${req.name} navigates by stars, presses buttons on a ship, floats in zero gravity
   - "Art & Drawing" = ${req.name} draws something that comes to life or paints a solution
   - "Music" = ${req.name} sings, hums, or plays a rhythm to solve the problem
   - "Animals" = ${req.name} understands animal feelings, feeds/cares for a creature
   - "Sports" = ${req.name} uses running/jumping/throwing to overcome an obstacle

4. PRIDE & LEARNING as character depth:
   - Proud of: "${req.proud_of || "not specified"}" -- this becomes ${req.name}'s superpower or the skill that saves the day
   - Learning: "${req.currently_learning || "not specified"}" -- this becomes the story's gentle lesson or the small fear/challenge they overcome

5. AGE SHAPES THE HERO: ${req.name} is ${req.age} years old.
   - Their solution must feel achievable for a ${req.age}-year-old
   - Their emotional moment (fear/uncertainty) must be age-appropriate
   - Their strength comes from something a ${req.age}-year-old would genuinely be proud of

6. NICKNAME & FAMILY PHRASE:
   - Nickname "${req.nickname || ""}": If provided, weave it in naturally -- perhaps the sidekick uses it as a term of endearment, or it appears at a tender moment
   - Family phrase "${req.family_phrase || ""}": If provided, use it as inspiration for the story's RECURRING REFRAIN (adapt it to be 5-8 words, musical, child-friendly). If not provided, create an original refrain.

Generate a Story Bible with ALL of the following sections. Be specific and creative -- this will be used to write the final story.

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks, just raw JSON):
{
  "title": "A short, catchy title that a 4-year-old would love to say out loud",
  "main_character": {
    "name": "${req.name}",
    "personality": "2-3 personality traits drawn directly from being a ${req.age}-year-old who loves ${req.interests.join(" and ")}",
    "child_specific_details": "3 specific moments where ${req.name}'s interests/favorites drive the plot (not just mentioned -- they DO something with them)",
    "age_appropriate_strength": "The skill a real ${req.age}-year-old would use to solve the problem (tied to their interests)"
  },
  "sidekick": {
    "name": "One creative memorable name (like Bramblesnout, Fizzbeak, Crumblewhisk)",
    "species_or_type": "What they are (inspired by the child's favorite animal if one is mentioned in favorite_things)",
    "appearance": "3-4 specific visual details -- incorporate the child's favorite color if mentioned (e.g., if child loves red, the sidekick has a red scarf or red spots)",
    "personality_trait": "One defining trait that complements ${req.name}'s strength",
    "voice": "How they talk -- a catchphrase or speech pattern"
  },
  "story_world": {
    "setting": "The specific place (name it, describe 3 key landmarks). Weave the child's favorite color into the world's palette.",
    "magical_object": "An object central to the plot -- inspired by the child's favorite toy/thing/food if provided. What it does and why it matters.",
    "sensory_details": "One smell, one sound, one texture that recur through the story",
    "rules": "One magical or special rule of this world that matters to the plot"
  },
  "emotional_core": {
    "child_strength": "The specific action ${req.name} performs to save the day -- must use their interest as a VERB (e.g., 'draws a bridge', 'sings the password', 'stacks rocks like building blocks')",
    "small_fear": "A relatable uncertainty for age ${req.age} (not a phobia -- a gentle 'can I really do this?' moment)",
    "recurring_phrase": "A 5-8 word refrain that captures the story's heart. Musical, simple, repeatable. Appears on at least 3 pages.",
    "emotional_arc": "One sentence describing the feeling journey: from [starting emotion] through [mid emotion] to [ending emotion]"
  },
  "page_outline": [
    {"page": 1, "beat": "WONDER", "one_line": "What happens -- must connect to the child's world/interests"},
    {"page": 2, "beat": "DELIGHT", "one_line": "Sidekick appears -- show their personality in one action"},
    {"page": 3, "beat": "EMPATHY", "one_line": "The problem is revealed -- the magical_object is involved"},
    {"page": 4, "beat": "EXCITEMENT", "one_line": "They set off -- ${req.name} uses an interest-related skill"},
    {"page": 5, "beat": "TEAMWORK", "one_line": "A small challenge solved using ${req.name}'s and sidekick's combined strengths"},
    {"page": 6, "beat": "TENSION", "one_line": "The big problem feels hard -- ${req.name}'s small_fear surfaces"},
    {"page": 7, "beat": "TRIUMPH", "one_line": "${req.name} uses their age_appropriate_strength to solve it"},
    {"page": 8, "beat": "WARMTH", "one_line": "A farewell gift (connected to favorite_things), a promise to return"}
  ],
  "illustration_notes": {
    "child_depiction": "MUST include any visual details from the photo (hairstyle, clothing color, glasses, accessories). Describe as 'the child with [details from photo]'. These details should stay CONSISTENT across all 8 pages.",
    "child_visual_in_story": "1-2 moments in the story text where a visual detail from the photo is lightly woven in (e.g., 'her red boots splashed in the puddle' or 'he pushed his glasses up and grinned'). Keep it natural -- never forced.",
    "sidekick_visual": "Exact repeated visual description for the sidekick across all 8 pages",
    "color_palette": "3-4 dominant colors -- must include the child's favorite color if mentioned",
    "lighting_mood": "The overall lighting style (e.g., warm golden, soft morning, sunset glow)"
  }
}`;
}

function buildStoryFromBiblePrompt(req: StoryRequest, storyBible: string): string {
  const cfg = readingLevelConfig[req.reading_level] || readingLevelConfig.beginner;
  const levelBlock = getReadingLevelPromptBlock(req.reading_level);

  return `You are writing a children's picture book based on the Story Bible below. Follow it precisely -- every character detail, every emotional beat, every visual note.

STORY BIBLE:
${storyBible}

${levelBlock}

STRICT WRITING CONSTRAINTS:
- EXACTLY ${cfg.pages} pages.
- Each page has ${cfg.sentencesPerPage[0]}-${cfg.sentencesPerPage[1]} sentences. NEVER exceed ${cfg.sentencesPerPage[1]}.
- Each sentence is ${cfg.wordsPerSentence[0]}-${cfg.wordsPerSentence[1]} words. Count them. Stay in range.
- FORBIDDEN emotion words (NEVER use): ${cfg.forbiddenEmotions.join(", ")}
- ALLOWED emotion words (ONLY these): ${cfg.allowedEmotions.join(", ")}
- Dialogue rule: ${cfg.dialogueRule}
- Metaphor rule: ${cfg.metaphorRule}
- Sensory rule: ${cfg.sensoryDetails}
- Story arc: ${cfg.arcStructure}
- ${req.name} is the hero. The sidekick's personality and voice must match the Story Bible exactly.
- Follow the page_outline beats exactly.
- End with "The End."
- Do NOT write illustration prompts. Only write the story text.

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks, just raw JSON):
{
  "title": "${req.name}'s story title from the bible",
  "pages": [
    {"page_number": 1, "text": "..."},
    {"page_number": 2, "text": "..."},
    {"page_number": 3, "text": "..."},
    {"page_number": 4, "text": "..."},
    {"page_number": 5, "text": "..."},
    {"page_number": 6, "text": "..."},
    {"page_number": 7, "text": "..."},
    {"page_number": 8, "text": "..."}
  ]
}`;
}

interface IllustrationStyleConfig {
  label: string;
  promptPrefix: string;
  styleTraits: string;
  negatives: string;
  avoid: string[];
}

const illustrationStyleConfig: Record<string, IllustrationStyleConfig> = {
  cartoon: {
    label: "CARTOON",
    promptPrefix: "Bright 2D cartoon illustration for a preschool storybook.",
    styleTraits: "rounded shapes, bold clean outlines, expressive eyes, cheerful saturated colors, simple playful background, and a funny energetic pose",
    negatives: "No painterly texture, no realistic lighting, no 3D plastic look, no text",
    avoid: ["painterly textures", "realistic lighting", "3D plastic look", "text in image", "watercolor washes", "soft blended edges", "muted earthy tones", "complex shadows"],
  },
  storybook: {
    label: "CLASSIC STORYBOOK",
    promptPrefix: "Soft hand-painted children's storybook illustration.",
    styleTraits: "warm gentle lighting, watercolor/gouache texture, soft brush strokes, cozy background details, emotional expression, and classic picture-book composition",
    negatives: "No bold cartoon outlines, no 3D look, no text, no distorted face",
    avoid: ["bold cartoon outlines", "3D plastic look", "text in image", "flat color fills", "exaggerated proportions", "neon colors", "sticker-like graphics", "hard geometric shapes"],
  },
  watercolor: {
    label: "WATERCOLOR",
    promptPrefix: "Delicate watercolor painting for a children's picture book.",
    styleTraits: "transparent washes, gentle bleeds, white paper showing through, dreamy pastel palette, soft undefined edges, flowing organic shapes, luminous from within, and quiet graceful poses",
    negatives: "No bold outlines, no saturated flat colors, no hard edges, no 3D rendering, no text",
    avoid: ["bold outlines", "saturated flat colors", "hard edges", "complex detail", "dark shadows", "geometric shapes", "3D rendering", "text in image"],
  },
};


function buildCharacterSheetPrompt(childVisualDetails: string, illustrationStyle: string, storyBible: string): string {
  const styleCfg = illustrationStyleConfig[illustrationStyle] || illustrationStyleConfig.storybook;

  return `You are a character design artist for a children's picture book. Create a detailed CHARACTER SHEET that will be used as a reference for every single page illustration. This ensures the child looks IDENTICAL across all 8 pages.

PHOTO ANALYSIS (safe visual details extracted from uploaded photo):
${childVisualDetails !== "no details extracted" ? childVisualDetails : "No photo available -- design a generic young child (approximately 4 years old) with simple, memorable features."}

STORY BIBLE (for context on sidekick and world):
${storyBible}

ART STYLE: ${styleCfg.label}
Style properties: ${styleCfg.styleTraits}

Create a CHARACTER SHEET with these exact sections. Be extremely specific and concrete -- an illustrator must be able to draw this child identically every time.

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks, just raw JSON):
{
  "character_sheet": {
    "child_visual_description": "Full physical description derived ONLY from the photo analysis. Include height relative to the sidekick. Do NOT infer sensitive traits.",
    "outfit_description": "Exact clothing: type, color, fit, distinctive details (buttons, patterns, pockets). This outfit NEVER changes across pages.",
    "hairstyle": "Exact hair description: length, texture, color, how it falls, any clips or ties. This NEVER changes.",
    "facial_expression_baseline": "The child's neutral/default expression. Describe eye shape, mouth shape, cheek roundness. Other expressions are variations of this baseline.",
    "color_palette": "5-6 exact colors that define this character (hair color, skin indication if from photo, outfit primary, outfit secondary, accent color for accessories).",
    "art_style_rendering": "How this character should be rendered in the ${styleCfg.label} style. Describe line weight, shading approach, and texture specific to this child.",
    "proportions": "Head-to-body ratio, limb length, hand size, overall build. Be precise so proportions stay consistent.",
    "do_not_change": "List of 5-8 specific visual anchors that must remain IDENTICAL on every page (e.g., 'red sneakers with white laces', 'round glasses with thin gold frames', 'three freckles on left cheek'). These are the consistency checkpoints."
  }
}`;
}

function buildIllustrationPromptsPrompt(storyBible: string, pages: { page_number: number; text: string }[], _illustrationStyle: string, _characterSheet: string): string {
  return `You write SHORT scene descriptions for a children's picture book AI image generator.

IMPORTANT: The AI image generator will receive a photo of the child separately. Your job is ONLY to describe the SCENE and ACTION -- what the child is doing and what's around them. Keep it SHORT (max 25 words per prompt).

STORY BIBLE (for sidekick names and setting details):
${storyBible}

PAGE TEXT:
${pages.map(p => `Page ${p.page_number}: "${p.text}"`).join("\n")}

RULES:
- Each prompt is ONE short phrase (max 25 words)
- Describe: the child's action/pose, their expression, the sidekick, and the immediate setting
- The child MUST be the main focus of every scene
- Do NOT include style instructions, art direction, or "no text" -- that's handled separately
- Do NOT describe the child's appearance (hair, clothes) -- the photo handles that
- DO describe what they're DOING and their EMOTION

GOOD EXAMPLE: "the child reaching excitedly toward a glowing star while a small fox bounces beside them, colorful night sky"
BAD EXAMPLE: "Bright 2D cartoon illustration for a preschool storybook. The child has a consistent face and outfit from the reference photo, shown reaching up..." (TOO LONG, includes style)

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks, just raw JSON):
{
  "illustration_prompts": [
    {"page_number": 1, "illustration_prompt": "..."},
    {"page_number": 2, "illustration_prompt": "..."},
    {"page_number": 3, "illustration_prompt": "..."},
    {"page_number": 4, "illustration_prompt": "..."},
    {"page_number": 5, "illustration_prompt": "..."},
    {"page_number": 6, "illustration_prompt": "..."},
    {"page_number": 7, "illustration_prompt": "..."},
    {"page_number": 8, "illustration_prompt": "..."}
  ]
}`;
}

function buildEditorialReviewPrompt(req: StoryRequest, storyBible: string, pages: { page_number: number; text: string }[]): string {
  const cfg = readingLevelConfig[req.reading_level] || readingLevelConfig.beginner;

  return `You are a senior children's book editor. You have received a draft story for a child aged ${req.age} named ${req.name}. Review it against 8 strict criteria, then output the REVISED pages.

STORY BIBLE (for reference):
${storyBible}

DRAFT STORY:
${pages.map(p => `Page ${p.page_number}: "${p.text}"`).join("\n")}

REVIEW CHECKLIST -- fix any issues you find:

1. READING LEVEL ENFORCEMENT (${cfg.label} -- ${cfg.ageRange}):
   - STRICT: Sentences per page must be ${cfg.sentencesPerPage[0]}-${cfg.sentencesPerPage[1]}. If a page exceeds ${cfg.sentencesPerPage[1]} sentences, cut or merge.
   - STRICT: Words per sentence must be ${cfg.wordsPerSentence[0]}-${cfg.wordsPerSentence[1]}. Count them. Split sentences that exceed ${cfg.wordsPerSentence[1]} words.
   - STRICT: Vocabulary must match: ${cfg.vocabulary}. Replace any word that doesn't fit.
   - FORBIDDEN emotion words -- if ANY of these appear, replace them: ${cfg.forbiddenEmotions.join(", ")}
   - ALLOWED emotion words -- ONLY these may be used: ${cfg.allowedEmotions.join(", ")}
   - Dialogue enforcement: ${cfg.dialogueRule}
   - Metaphor enforcement: ${cfg.metaphorRule}
   - Description enforcement: ${cfg.descriptionRule}
   - Sensory enforcement: ${cfg.sensoryDetails}
   - Problem-solving enforcement: ${cfg.problemSolving}
   - Emotional growth enforcement: ${cfg.emotionalGrowth}
   - Refrain enforcement: ${cfg.refrainRule}

2. EMOTIONAL ARC:
   - Pages should flow: wonder -> delight -> empathy -> excitement -> teamwork -> tension -> triumph -> warmth
   - Each page must have ONE clear emotion. If a page feels flat, sharpen it.
   - The tension page (6) must feel real but NOT scary -- just a gentle "can I do this?" moment.

3. REPETITION & REFRAIN:
   - The recurring phrase must appear the required number of times (see criterion 1).
   - If missing or inconsistent, add it back naturally.
   - The refrain should feel like a drumbeat the child anticipates.

4. READ-ALOUD RHYTHM:
   - Every sentence should feel musical when spoken aloud.
   - Use alliteration, assonance, and rhythmic cadence.
   - Each page must have at least one onomatopoeia (splash, whoosh, crunch, pop, etc.).
   - Vary sentence length within a page for rhythm.

5. SAFETY -- NO SCARY OR UNSAFE CONTENT:
   - No violence, peril, death, abandonment, or being lost without resolution.
   - No mean characters, bullying, or exclusion.
   - No content that could trigger anxiety at bedtime.
   - The tension moment must be mild uncertainty, never fear.

6. NO GENERIC FILLER:
   - Delete any line that could appear in ANY children's book (e.g., "It was a beautiful day", "They had so much fun").
   - Every sentence must be specific to THIS child's story.
   - If a line doesn't serve the plot or emotion, cut it and replace with something specific.

7. CHILD PERSONALIZATION:
   - ${req.name}'s interests (${req.interests.join(", ")}) must be ACTIVE in the story (they DO things related to them).
   - Their favorite toy ("${req.favorite_toy || "not specified"}") should appear if provided.
   - The sidekick should use the nickname "${req.nickname || ""}" if provided.
   - Something they're proud of ("${req.proud_of || ""}") should connect to how they save the day.
   - The family phrase ("${req.family_phrase || ""}") should inspire the refrain if provided.
   - If any personalization is missing or feels surface-level, deepen it.

8. PAGE-TO-PAGE CONSISTENCY:
   - Character names must be spelled the same throughout.
   - The sidekick's personality/voice must stay consistent.
   - Objects introduced must be resolved (nothing appears then vanishes).
   - The setting must be consistent (no teleporting between scenes without transition).
   - The tone set by story_mood ("${req.story_mood}") must be maintained throughout.

RULES:
- Keep EXACTLY ${cfg.pages} pages.
- Each page: ${cfg.sentencesPerPage[0]}-${cfg.sentencesPerPage[1]} sentences. NEVER exceed ${cfg.sentencesPerPage[1]}.
- Each sentence: ${cfg.wordsPerSentence[0]}-${cfg.wordsPerSentence[1]} words. NEVER exceed ${cfg.wordsPerSentence[1]}.
- Preserve the title and overall plot -- only revise language and fix issues.
- If a page is already strong, leave it unchanged.
- End with "The End." on page 8.

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks, just raw JSON):
{
  "pages": [
    {"page_number": 1, "text": "..."},
    {"page_number": 2, "text": "..."},
    {"page_number": 3, "text": "..."},
    {"page_number": 4, "text": "..."},
    {"page_number": 5, "text": "..."},
    {"page_number": 6, "text": "..."},
    {"page_number": 7, "text": "..."},
    {"page_number": 8, "text": "..."}
  ]
}`;
}

interface PageValidationResult {
  page_number: number;
  passed: boolean;
  failures: string[];
}

interface ValidationResult {
  allPassed: boolean;
  pageResults: PageValidationResult[];
  failingPages: number[];
}

function validateStoryAgainstLevel(
  pages: { page_number: number; text: string }[],
  level: string
): ValidationResult {
  const cfg = readingLevelConfig[level] || readingLevelConfig.beginner;
  const pageResults: PageValidationResult[] = [];

  let refrainDetected = false;
  const allTexts = pages.map(p => p.text);
  const twoWordPhrases: Record<string, number> = {};
  for (const text of allTexts) {
    const words = text.toLowerCase().replace(/[^a-z\s']/g, "").split(/\s+/);
    for (let i = 0; i < words.length - 2; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      twoWordPhrases[phrase] = (twoWordPhrases[phrase] || 0) + 1;
    }
  }
  const maxRepeat = Math.max(0, ...Object.values(twoWordPhrases));
  if (level === "beginner" && maxRepeat >= 4) refrainDetected = true;
  if (level === "intermediate" && maxRepeat >= 3) refrainDetected = true;

  const complexWords = ["determined", "anxious", "relieved", "frustrated", "overwhelmed", "conflicted", "melancholy", "hesitant", "philosophical", "existential", "resentful", "vindictive", "nevertheless", "furthermore", "consequently", "approximately", "extraordinary", "unfortunately", "immediately", "particularly"];

  for (const page of pages) {
    const failures: string[] = [];
    const sentences = page.text
      .replace(/([.!?])\s*(?=[A-Z"'])/g, "$1|SPLIT|")
      .split("|SPLIT|")
      .filter(s => s.trim().length > 0);

    const sentenceCount = sentences.length;
    if (sentenceCount < cfg.sentencesPerPage[0]) {
      failures.push(`too few sentences: ${sentenceCount} (min ${cfg.sentencesPerPage[0]})`);
    }
    if (sentenceCount > cfg.sentencesPerPage[1]) {
      failures.push(`too many sentences: ${sentenceCount} (max ${cfg.sentencesPerPage[1]})`);
    }

    const wordCounts = sentences.map(s => s.replace(/[^a-zA-Z'\s-]/g, "").split(/\s+/).filter(w => w.length > 0).length);
    const avgWords = wordCounts.reduce((a, b) => a + b, 0) / Math.max(wordCounts.length, 1);

    if (avgWords < cfg.wordsPerSentence[0] - 1) {
      failures.push(`avg sentence length too short: ${avgWords.toFixed(1)} words (target ${cfg.wordsPerSentence[0]}-${cfg.wordsPerSentence[1]})`);
    }
    if (avgWords > cfg.wordsPerSentence[1] + 2) {
      failures.push(`avg sentence length too long: ${avgWords.toFixed(1)} words (target ${cfg.wordsPerSentence[0]}-${cfg.wordsPerSentence[1]})`);
    }

    const lowerText = page.text.toLowerCase();
    const foundComplex = complexWords.filter(w => lowerText.includes(w));
    if (level === "beginner" && foundComplex.length > 0) {
      failures.push(`vocabulary too advanced for beginner: [${foundComplex.join(", ")}]`);
    }

    if (level === "beginner") {
      const hasSaidDialogue = /said\s+\w|asked\s+\w|replied\s+\w|whispered\s+\w|exclaimed/i.test(page.text);
      if (hasSaidDialogue) {
        failures.push("beginner pages must not have dialogue constructions (said/asked/replied)");
      }
      if (avgWords > 11) {
        failures.push("beginner text is too advanced -- sentences are too long for ages 3-4");
      }
    }

    if (level === "intermediate") {
      if (sentenceCount <= 1 && avgWords < 7) {
        failures.push("intermediate text is too simplistic -- needs more detail and richness for ages 5-6");
      }
    }

    const forbiddenFound = cfg.forbiddenEmotions.filter(e => lowerText.includes(e));
    if (forbiddenFound.length > 0) {
      failures.push(`forbidden emotion words used: [${forbiddenFound.join(", ")}]`);
    }

    pageResults.push({
      page_number: page.page_number,
      passed: failures.length === 0,
      failures,
    });
  }

  if (!refrainDetected) {
    const minRefrain = level === "beginner" ? 4 : 3;
    for (const pr of pageResults) {
      if (pr.passed) {
        pr.passed = false;
        pr.failures.push(`refrain not detected (needs a repeated phrase on ${minRefrain}+ pages)`);
        break;
      }
    }
  }

  const failingPages = pageResults.filter(p => !p.passed).map(p => p.page_number);

  return {
    allPassed: failingPages.length === 0,
    pageResults,
    failingPages,
  };
}

function buildTargetedRewritePrompt(
  req: StoryRequest,
  storyBible: string,
  allPages: { page_number: number; text: string }[],
  validation: ValidationResult
): string {
  const cfg = readingLevelConfig[req.reading_level] || readingLevelConfig.beginner;
  const levelBlock = getReadingLevelPromptBlock(req.reading_level);

  const failureReport = validation.pageResults
    .filter(p => !p.passed)
    .map(p => `Page ${p.page_number} FAILURES:\n${p.failures.map(f => `  - ${f}`).join("\n")}`)
    .join("\n\n");

  const passingPages = allPages
    .filter(p => !validation.failingPages.includes(p.page_number))
    .map(p => `Page ${p.page_number}: "${p.text}"`)
    .join("\n");

  const failingPagesText = allPages
    .filter(p => validation.failingPages.includes(p.page_number))
    .map(p => `Page ${p.page_number}: "${p.text}"`)
    .join("\n");

  return `You are a children's book editor fixing SPECIFIC pages that failed reading-level validation. ONLY rewrite the failing pages. Do NOT change passing pages.

STORY BIBLE (for context):
${storyBible}

${levelBlock}

STRICT CONSTRAINTS FOR REWRITE:
- Each page: ${cfg.sentencesPerPage[0]}-${cfg.sentencesPerPage[1]} sentences (NEVER exceed ${cfg.sentencesPerPage[1]})
- Each sentence: ${cfg.wordsPerSentence[0]}-${cfg.wordsPerSentence[1]} words (COUNT them)
- FORBIDDEN emotions: ${cfg.forbiddenEmotions.join(", ")}
- ALLOWED emotions: ${cfg.allowedEmotions.join(", ")}
- Dialogue rule: ${cfg.dialogueRule}
- Metaphor rule: ${cfg.metaphorRule}

PASSING PAGES (do NOT change these):
${passingPages}

FAILING PAGES (rewrite ONLY these):
${failingPagesText}

VALIDATION FAILURES TO FIX:
${failureReport}

REWRITE RULES:
- Fix ONLY the specific failures listed above
- Keep the same story beat and emotional tone for each page
- Keep character names and events consistent with passing pages
- Ensure the refrain appears the required number of times across the full story
- Count your words and sentences before submitting

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks, just raw JSON):
{
  "rewritten_pages": [
    {"page_number": N, "text": "..."}
  ]
}`;
}

async function callOpenAI(openaiKey: string, system: string, user: string, temperature: number, maxTokens: number): Promise<string> {
  const maxRetries = 5;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
    });

    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("retry-after");
      let waitMs = (attempt + 1) * 21000; // default: 21s, 42s, 63s...
      if (retryAfterHeader) {
        waitMs = Math.max(parseInt(retryAfterHeader, 10) * 1000, 21000);
      }
      console.log(`Rate limited (429). Attempt ${attempt + 1}/${maxRetries}. Waiting ${waitMs / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI request failed:", response.status, err.substring(0, 500));
      throw new Error(`OpenAI API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("OpenAI returned empty content:", JSON.stringify(data).substring(0, 500));
      throw new Error("OpenAI returned empty content");
    }
    return content.trim();
  }

  throw new Error("OpenAI rate limit exceeded after maximum retries");
}

async function analyzeChildPhoto(openaiKey: string, photoUrl: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You extract ONLY child-safe visual details from a photo for use in a children's storybook illustration. You describe what the child is WEARING and their hairstyle -- nothing else.

RULES:
- ONLY describe: hairstyle (length, style like curly/straight/braids/ponytail), hair accessories (bows, clips), clothing color and type (red shirt, blue dress, striped sweater), glasses (if worn), shoes (if visible), accessories (backpack, hat, cape, scarf)
- NEVER describe or guess: race, ethnicity, skin color, weight, health conditions, disabilities, facial features, age appearance, gender identity
- NEVER make judgments about the child's appearance
- Keep it to 2-3 short factual sentences maximum
- If the photo is unclear or not of a child, respond with "no details extracted"
- Use simple, neutral language

Example good output: "The child has curly shoulder-length hair with a yellow bow. They are wearing a green t-shirt with a dinosaur on it and red sneakers."
Example bad output: anything mentioning skin, race, weight, attractiveness, age-guessing, or identity.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Describe ONLY the safe visual details (hairstyle, clothing, accessories) of the child in this photo for storybook illustration reference." },
            { type: "image_url", image_url: { url: photoUrl, detail: "low" } },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    return "no details extracted";
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || "no details extracted";
  return content;
}

function buildCombinedStoryPrompt(req: StoryRequest, childVisualDetails: string): string {
  const creativeSeed = generateCreativeSeed();
  const readingLevelBlock = getReadingLevelPromptBlock(req.reading_level);
  const cfg = readingLevelConfig[req.reading_level] || readingLevelConfig.beginner;

  const themeWorldBuilding: Record<string, string> = {
    dinosaurs: `WORLD: A warm prehistoric valley with giant ferns, sparkly river, friendly dinosaurs. SIDEKICK IDEAS: clumsy baby triceratops, chatty pterodactyl, gentle brachiosaurus.`,
    space: `WORLD: A cozy spaceship visiting colorful planets and twinkling stars. SIDEKICK IDEAS: sparkly crystal creature, bouncy jelly-blob alien, kind station keeper.`,
    "enchanted-forest": `WORLD: A deep magical forest with glowing mushrooms, mossy paths, babbling brook. SIDEKICK IDEAS: badger in berry-stained apron, copper-feathered owl, woodland mice.`,
    superhero: `WORLD: A friendly neighborhood with park, shops, rooftops to leap between. SIDEKICK IDEAS: flour-dusted baker with courage-cakes, speedy crossing guard, kind neighbors.`,
    "fairy-tale": `WORLD: A storybook kingdom with wonky castle, rolling hills, cobblestone village. SIDEKICK IDEAS: tiny dragon afraid of fire, fairy godparent always late, jolly king.`,
  };

  const storyMoodGuidance: Record<string, string> = {
    "bedtime-calm": "TONE: Gentle, quiet, soothing. End with warmth and safety.",
    "silly-adventure": "TONE: Playful, giggly, full of surprises and funny sounds.",
    "bravery": "TONE: Encouraging, empowering. Child discovers they're braver than they thought.",
    "friendship": "TONE: Warm, kind, connected. Celebrates being there for someone.",
    "confidence": "TONE: Affirming, celebratory. Child tries something new and succeeds.",
    "curiosity": "TONE: Wondering, exploratory, delighted by discovery.",
  };

  return `You are a world-class children's picture book author. Write a COMPLETE, UNIQUE story for a child.

${creativeSeed}

${readingLevelBlock}

CHILD: ${req.name}, age ${req.age}
- Interests: ${req.interests.join(", ")}
- Favorite things: ${req.favorite_things || "not specified"}
- Favorite toy: ${req.favorite_toy || "not specified"}
- Nickname: ${req.nickname || "none"}
- Proud of: ${req.proud_of || "not specified"}
- Learning: ${req.currently_learning || "not specified"}
- Family phrase: ${req.family_phrase || "none"}
- Themes to AVOID: ${req.themes_to_avoid || "none"}
- Visual from photo: ${childVisualDetails !== "no details extracted" ? childVisualDetails : "none available"}

THEME: ${req.theme}
${themeWorldBuilding[req.theme] || themeWorldBuilding["enchanted-forest"]}

MOOD: ${req.story_mood || "silly-adventure"}
${storyMoodGuidance[req.story_mood] || storyMoodGuidance["silly-adventure"]}

PERSONALIZATION RULES:
- The child's interests MUST be active in the plot (they DO things with them)
- Their favorite toy should appear as a magical item or companion if provided
- Their strength/pride should be HOW they solve the problem
- Create a memorable sidekick with a fun name (like Bramblesnout, Fizzbeak, Crumblewhisk)
- Include a musical 5-8 word refrain that appears on at least 3 pages

WRITING CONSTRAINTS:
- EXACTLY ${cfg.pages} pages
- ${cfg.sentencesPerPage[0]}-${cfg.sentencesPerPage[1]} sentences per page (STRICT)
- ${cfg.wordsPerSentence[0]}-${cfg.wordsPerSentence[1]} words per sentence (STRICT)
- Story arc: ${cfg.arcStructure}
- End with "The End."
- Each page needs one onomatopoeia (SPLASH! WHOOSH! etc.)

For each page, also write a SHORT (max 25 words) illustration prompt describing the scene action.

RESPOND IN THIS EXACT JSON FORMAT (no markdown, no code blocks):
{
  "title": "A catchy title a 4-year-old would love",
  "pages": [
    {"page_number": 1, "text": "story text...", "illustration_prompt": "scene description for image generator..."},
    {"page_number": 2, "text": "...", "illustration_prompt": "..."},
    {"page_number": 3, "text": "...", "illustration_prompt": "..."},
    {"page_number": 4, "text": "...", "illustration_prompt": "..."},
    {"page_number": 5, "text": "...", "illustration_prompt": "..."},
    {"page_number": 6, "text": "...", "illustration_prompt": "..."},
    {"page_number": 7, "text": "...", "illustration_prompt": "..."},
    {"page_number": 8, "text": "...", "illustration_prompt": "..."}
  ]
}`;
}

async function generateWithAI(req: StoryRequest): Promise<GeneratedStory> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    throw new Error("NO_API_KEY");
  }

  // Step 0: Analyze child photo for safe visual details (non-fatal)
  let childVisualDetails = "no details extracted";
  if (req.photo_urls && req.photo_urls.length > 0) {
    try {
      childVisualDetails = await analyzeChildPhoto(openaiKey, req.photo_urls[0]);
      console.log("Photo analysis complete:", childVisualDetails.substring(0, 100));
    } catch (e) {
      console.log("Photo analysis failed (non-fatal):", (e as Error).message);
      childVisualDetails = "no details extracted";
    }
  }

  // Step 1: Generate complete story + illustration prompts in a single call
  console.log("Step 1: Generating complete story...");
  const storyRaw = await callOpenAI(
    openaiKey,
    "You are a beloved children's picture book author. You write stories that are simple, musical, emotionally true, and completely unique every time. Always respond with valid JSON only, no markdown, no code fences.",
    buildCombinedStoryPrompt(req, childVisualDetails),
    0.85,
    4096
  );
  const storyJson = storyRaw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const storyParsed: { title: string; pages: { page_number: number; text: string; illustration_prompt?: string }[] } = JSON.parse(storyJson);

  if (!storyParsed.title || !storyParsed.pages || storyParsed.pages.length === 0) {
    throw new Error("Invalid story format from AI");
  }
  console.log("Story generated:", storyParsed.title, "pages =", storyParsed.pages.length);

  // Step 2: Reading-level validation + fix in a single call (non-fatal)
  try {
    const validation = validateStoryAgainstLevel(storyParsed.pages, req.reading_level);

    if (!validation.allPassed && validation.failingPages.length > 0) {
      console.log("Validation found", validation.failingPages.length, "failing pages, requesting fix...");
      const storyBibleSummary = JSON.stringify({ title: storyParsed.title, pages: storyParsed.pages.map(p => ({ page_number: p.page_number, text: p.text })) });
      const rewriteRaw = await callOpenAI(
        openaiKey,
        "You are a children's book editor who fixes pages that fail reading-level requirements. You count words and sentences precisely. Always respond with valid JSON only, no markdown.",
        buildTargetedRewritePrompt(req, storyBibleSummary, storyParsed.pages, validation),
        0.4,
        3000
      );
      const rewriteJson = rewriteRaw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const rewriteParsed: { rewritten_pages: { page_number: number; text: string }[] } = JSON.parse(rewriteJson);

      if (rewriteParsed.rewritten_pages && rewriteParsed.rewritten_pages.length > 0) {
        for (const rewritten of rewriteParsed.rewritten_pages) {
          const idx = storyParsed.pages.findIndex(p => p.page_number === rewritten.page_number);
          if (idx !== -1) {
            storyParsed.pages[idx].text = rewritten.text;
          }
        }
        console.log("Fixed", rewriteParsed.rewritten_pages.length, "pages");
      }
    } else {
      console.log("All pages passed validation");
    }
  } catch (e) {
    console.log("Validation/rewrite failed (non-fatal):", (e as Error).message);
  }

  // Build final pages
  const mergedPages: GeneratedPage[] = storyParsed.pages.map(page => ({
    page_number: page.page_number,
    text: page.text,
    illustration_prompt: page.illustration_prompt || page.text.substring(0, 80),
  }));

  console.log("AI generation complete:", storyParsed.title);
  return {
    title: storyParsed.title,
    pages: mergedPages,
    characterSheet: childVisualDetails,
  };
}

const styleShorthand: Record<string, string> = {
  cartoon: "bold cartoon with thick outlines, flat vivid colors, big expressive eyes",
  storybook: "warm painterly storybook illustration with soft brushstrokes and golden lighting",
  watercolor: "gentle watercolor with soft washes, pastel colors, and white paper showing through",
};

async function submitToFal(
  falKey: string,
  prompt: string,
  imageUrl: string
): Promise<string> {
  // Use queue endpoint with polling (shorter timeout for edge function limits)
  const submitResponse = await fetch("https://queue.fal.run/fal-ai/flux-pro/kontext/max", {
    method: "POST",
    headers: {
      "Authorization": `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl,
      output_format: "jpeg",
      aspect_ratio: "4:3",
      safety_tolerance: "6",
    }),
  });

  if (!submitResponse.ok) {
    const errText = await submitResponse.text();
    throw new Error(`fal.ai submit error: ${submitResponse.status} - ${errText}`);
  }

  const submitData = await submitResponse.json();

  if (submitData.images && submitData.images.length > 0) {
    return submitData.images[0].url;
  }

  const statusUrl = submitData.status_url;
  const responseUrl = submitData.response_url;

  if (!statusUrl || !responseUrl) {
    throw new Error("No status_url/response_url returned from fal.ai");
  }

  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;

    const statusResponse = await fetch(statusUrl, {
      headers: { "Authorization": `Key ${falKey}` },
    });

    if (!statusResponse.ok) continue;

    const statusData = await statusResponse.json();

    if (statusData.status === "COMPLETED") {
      const resultResponse = await fetch(responseUrl, {
        headers: { "Authorization": `Key ${falKey}` },
      });

      if (!resultResponse.ok) {
        throw new Error("Failed to fetch fal.ai result");
      }

      const resultData = await resultResponse.json();
      if (resultData.images && resultData.images.length > 0) {
        return resultData.images[0].url;
      }
      throw new Error("No images in fal.ai result");
    }

    if (statusData.status === "FAILED") {
      throw new Error(`fal.ai generation failed: ${JSON.stringify(statusData)}`);
    }
  }

  throw new Error("fal.ai generation timed out");
}

function buildIllustrationPrompt(
  illustrationPrompt: string,
  illustrationStyle: string,
  theme: string
): string {
  const style = styleShorthand[illustrationStyle] || styleShorthand.storybook;
  const themeSuffix = themeDescriptions[theme] || "";

  return `Transform this photo into a ${style} children's book illustration. KEEP THE SAME CHILD - preserve their face, hairstyle, and clothing exactly. Place them in this scene: ${illustrationPrompt}. Setting: ${themeSuffix}. The child must be the large, central, prominent figure in the illustration. No text in the image.`;
}

function buildReferenceChainedPrompt(
  illustrationPrompt: string,
  illustrationStyle: string,
  theme: string,
  _characterSheet: string,
  anchorDescription: string
): string {
  const style = styleShorthand[illustrationStyle] || styleShorthand.storybook;
  const themeSuffix = themeDescriptions[theme] || "";

  return `Transform this photo into a ${style} children's book illustration. KEEP THE SAME CHILD exactly - same face, same hairstyle, same clothing: ${anchorDescription}. Place them in this scene: ${illustrationPrompt}. Setting: ${themeSuffix}. The child must be the large, central, prominent figure in the illustration. No text in the image.`;
}

async function generateIllustrationWithFal(
  illustrationPrompt: string,
  photoUrl: string,
  illustrationStyle: string,
  theme: string
): Promise<string> {
  const falKey = Deno.env.get("FAL_KEY");
  if (!falKey) {
    throw new Error("NO_FAL_KEY");
  }

  const prompt = buildIllustrationPrompt(illustrationPrompt, illustrationStyle, theme);
  return submitToFal(falKey, prompt, photoUrl);
}

async function generateIllustrationChained(
  illustrationPrompt: string,
  photoUrl: string,
  illustrationStyle: string,
  theme: string,
  characterSheet: string,
  anchorDescription: string
): Promise<string> {
  const falKey = Deno.env.get("FAL_KEY");
  if (!falKey) {
    throw new Error("NO_FAL_KEY");
  }

  const prompt = buildReferenceChainedPrompt(illustrationPrompt, illustrationStyle, theme, characterSheet, anchorDescription);
  return submitToFal(falKey, prompt, photoUrl);
}

interface QualityCheckResult {
  passed: boolean;
  failures: string[];
}

async function qualityCheckIllustration(
  openaiKey: string,
  imageUrl: string,
  illustrationPrompt: string,
  characterSheet: string,
  illustrationStyle: string,
  pageEmotion: string
): Promise<QualityCheckResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a quality assurance reviewer for AI-generated children's book illustrations. You check each image against strict criteria and REJECT images that fail. Be strict -- children's books demand high quality and consistency.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Review this generated illustration against these REJECT criteria. If ANY criterion fails, the image must be rejected.

CHARACTER SHEET (the child must match this):
${characterSheet}

ILLUSTRATION PROMPT USED:
${illustrationPrompt}

SELECTED STYLE: ${illustrationStyle}
EXPECTED PAGE EMOTION: ${pageEmotion}

REJECT CRITERIA (check each one):
1. IDENTITY: Does the child look like a different person from the character sheet? (wrong hair, wrong outfit, wrong age)
2. FACE: Is the face distorted, asymmetric, or uncanny?
3. AGE: Does the child look too old (older than 7)?
4. HANDS: Are the hands malformed, extra fingers, or missing fingers?
5. TEXT: Does the image contain any text, letters, words, or watermarks?
6. BLUR: Is the image blurry, low-resolution, or unfocused?
7. STYLE MATCH: Does the style NOT match "${illustrationStyle}"? (cartoon should have bold outlines and flat colors; storybook should have painterly textures and warm lighting)
8. STYLE CONFUSION: If style is "cartoon", does it look like a painted storybook? If "storybook", does it look like a flat cartoon?
9. EMOTION: Does the page emotion NOT match "${pageEmotion}"? Is the expression wrong or unreadable?
10. CONSISTENCY: Has the outfit or hairstyle changed dramatically from the character sheet description?

RESPOND IN THIS EXACT JSON FORMAT (no markdown):
{
  "passed": true/false,
  "failures": ["criterion 1 description", "criterion 2 description"]
}

If all criteria pass, return {"passed": true, "failures": []}.
If ANY criterion fails, return {"passed": false, "failures": [...list of failed criteria...]}.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    return { passed: true, failures: [] };
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(cleaned) as QualityCheckResult;
  } catch {
    return { passed: true, failures: [] };
  }
}

async function generateIllustrationWithQualityCheck(
  openaiKey: string,
  illustrationPrompt: string,
  photoUrl: string,
  illustrationStyle: string,
  theme: string,
  characterSheet: string,
  pageEmotion: string
): Promise<string> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const imageUrl = await generateIllustrationWithFal(
      illustrationPrompt,
      photoUrl,
      illustrationStyle,
      theme
    );

    if (attempt === maxRetries) {
      return imageUrl;
    }

    const check = await qualityCheckIllustration(
      openaiKey,
      imageUrl,
      illustrationPrompt,
      characterSheet,
      illustrationStyle,
      pageEmotion
    );

    if (check.passed) {
      return imageUrl;
    }

    console.log(`Quality check failed (attempt ${attempt + 1}/${maxRetries + 1}): ${check.failures.join(", ")}`);
  }

  throw new Error("Unreachable");
}

async function generateChainedWithQualityCheck(
  openaiKey: string,
  illustrationPrompt: string,
  photoUrl: string,
  illustrationStyle: string,
  theme: string,
  characterSheet: string,
  pageEmotion: string,
  anchorDescription: string
): Promise<string> {
  const maxRetries = 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const imageUrl = await generateIllustrationChained(
      illustrationPrompt,
      photoUrl,
      illustrationStyle,
      theme,
      characterSheet,
      anchorDescription
    );

    if (attempt === maxRetries) {
      return imageUrl;
    }

    const check = await qualityCheckIllustration(
      openaiKey,
      imageUrl,
      illustrationPrompt,
      characterSheet,
      illustrationStyle,
      pageEmotion
    );

    if (check.passed) {
      return imageUrl;
    }

    console.log(`Chained quality check failed (attempt ${attempt + 1}/${maxRetries + 1}): ${check.failures.join(", ")}`);
  }

  throw new Error("Unreachable");
}

const fallbackIllustrationMap: Record<string, string[]> = {
  dinosaurs: [
    "https://images.pexels.com/photos/3571551/pexels-photo-3571551.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/33535/praying-mantis-702-702-702.jpg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2832034/pexels-photo-2832034.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1374295/pexels-photo-1374295.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/36717/amazing-animal-beautiful-beauty.jpg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3571551/pexels-photo-3571551.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2832034/pexels-photo-2832034.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1374295/pexels-photo-1374295.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  space: [
    "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1341279/pexels-photo-1341279.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/956981/pexels-photo-956981.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1274260/pexels-photo-1274260.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1229042/pexels-photo-1229042.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/956981/pexels-photo-956981.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1341279/pexels-photo-1341279.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  "enchanted-forest": [
    "https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2295744/pexels-photo-2295744.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1423600/pexels-photo-1423600.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1486974/pexels-photo-1486974.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1423600/pexels-photo-1423600.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2295744/pexels-photo-2295744.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  superhero: [
    "https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1089842/pexels-photo-1089842.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1118873/pexels-photo-1118873.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1252890/pexels-photo-1252890.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1089842/pexels-photo-1089842.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
  "fairy-tale": [
    "https://images.pexels.com/photos/2832040/pexels-photo-2832040.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1485894/pexels-photo-1485894.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3617500/pexels-photo-3617500.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1028600/pexels-photo-1028600.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/2832040/pexels-photo-2832040.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/3617500/pexels-photo-3617500.jpeg?auto=compress&cs=tinysrgb&w=800",
    "https://images.pexels.com/photos/1485894/pexels-photo-1485894.jpeg?auto=compress&cs=tinysrgb&w=800",
  ],
};

function generateFallbackStory(req: StoryRequest): GeneratedStory {
  const name = req.name || "our hero";
  const theme = req.theme;

  const stories: Record<string, GeneratedStory> = {
    dinosaurs: {
      title: `${name} and Bramblesnout`,
      pages: [
        { page_number: 1, text: `${name} dug in the garden and found a golden egg, warm as sunshine. It cracked -- POP! -- and two big amber eyes blinked up.`, illustration_prompt: `The child kneeling in a sunny garden holding a cracked golden egg, a tiny green baby triceratops with amber eyes peeking out, warm morning light, ferns around them` },
        { page_number: 2, text: `Out tumbled a tiny green triceratops with clumsy feet. THUMP, CRASH -- it knocked over a flowerpot and sneezed. "I'll call you Bramblesnout," ${name} laughed.`, illustration_prompt: `The child giggling as a small green triceratops stumbles into a flowerpot, dirt and petals flying, bright cheerful garden scene` },
        { page_number: 3, text: `Bramblesnout tugged ${name}'s hand toward the old stone wall. Behind the ivy was a glowing archway -- and through it, a sad WHOOO echoed. Someone needed help. Brave and kind, that's what we are.`, illustration_prompt: `The child and Bramblesnout discovering a glowing stone archway behind ivy on a garden wall, warm amber light spilling through, curiosity on both faces` },
        { page_number: 4, text: `They stepped through into a jungle of giant ferns! STOMP, STOMP -- the ground shook. A pterodactyl named Fizzbeak swooped down. "Granny Fern is stuck in the mud! Follow me -- quick, quick, quick!"`, illustration_prompt: `The child and Bramblesnout in a lush prehistoric valley looking up at a colorful pterodactyl swooping down toward them, giant ferns and a copper river behind` },
        { page_number: 5, text: `At the mud flats, a big gentle brachiosaurus was sinking. "Don't worry!" ${name} called. Bramblesnout dragged logs, Fizzbeak carried sticks, and together they built a bridge. Brave and kind, that's what we are.`, illustration_prompt: `The child directing as Bramblesnout drags a log and Fizzbeak carries sticks, building a bridge across grey mud toward a large gentle brachiosaurus, teamwork scene` },
        { page_number: 6, text: `The mud was thick and gloopy. SQUELCH! The bridge wobbled. ${name} took a deep breath. It was scary -- but friends were counting on them.`, illustration_prompt: `The child carefully stepping onto a wobbly log bridge over bubbling mud, Bramblesnout behind looking worried, tense but brave moment` },
        { page_number: 7, text: `${name} pushed with all their might. Bramblesnout pulled. Fizzbeak heaved. GLORP! -- out came Granny Fern with a great big splash! "Thank you, little ones," she rumbled. Brave and kind, that's what we are.`, illustration_prompt: `The child pushing, Bramblesnout pulling, Fizzbeak heaving as the brachiosaurus lurches free from mud with a big splash, triumphant joyful moment, golden light` },
        { page_number: 8, text: `Granny Fern hummed a deep warm song. Bramblesnout fell asleep in ${name}'s lap, snoring softly. "Come back tomorrow?" she asked. "Tomorrow," ${name} promised. And the golden archway glowed, waiting for the next adventure. The End.`, illustration_prompt: `The child sitting in golden sunset light with sleeping Bramblesnout in their lap, Granny Fern's gentle silhouette humming in the background, a glowing archway nearby, peaceful and warm` },
      ],
    },
    space: {
      title: `Captain ${name} and the Stars`,
      pages: [
        { page_number: 1, text: `${name} counted stars from the rooftop when -- WHOOSH! -- a tiny silver ship landed on the railing. A hatch popped open and a sparkly crystal creature tumbled out, jingling like bells.`, illustration_prompt: `The child on a rooftop at night as a tiny silver spaceship lands on the railing, a small crystalline creature tumbling out, stars everywhere, moonlit` },
        { page_number: 2, text: `"I'm Prism!" it chimed. "I'm lost -- three galaxies off course. Will you help me find my way home?" Its little crystal face looked so hopeful. One more step, one more star.`, illustration_prompt: `The child crouching down to meet Prism, a small rainbow-refracting crystal creature with hopeful eyes, silver spaceship behind them, starry night` },
        { page_number: 3, text: `Inside the ship, Prism showed ${name} a broken star-map with scattered dots. "Without this, I'll never find Station Wanderlost." A tear like a diamond rolled down its cheek.`, illustration_prompt: `The child and Prism inside a cozy cockpit looking at a flickering broken star-map on a screen, Prism looking sad, blue and green light filling the cabin` },
        { page_number: 4, text: `"Let's fix it together!" ${name} said. The ship shot upward -- ZOOM! Stars streaked past the windows. They whooshed through a pink-and-gold nebula that smelled like cotton candy. One more step, one more star.`, illustration_prompt: `The child and Prism flying through a magnificent pink-and-gold nebula, stars streaking past the viewport, wonder on the child's face` },
        { page_number: 5, text: `A big bouncy blob named Bloop floated alongside. "Need help? I know shortcuts!" Bloop bounced the ship around asteroids -- BOING, BOING, BOING -- while ${name} read the stars and Prism lit the way.`, illustration_prompt: `The child pointing directions while a purple jelly-blob creature bounces them past asteroids, Prism glowing to light the path, playful and energetic scene` },
        { page_number: 6, text: `But the station was dark and cold when they arrived. Its lights had gone out. "Oh no," Prism whispered, crystals dimming. "Everyone's lost in the dark." ${name}'s tummy fluttered, but they squeezed Prism's hand.`, illustration_prompt: `The child and Prism arriving at a dark flickering space station, lights going out, Prism dimming with worry, the child squeezing Prism's hand, tense moment` },
        { page_number: 7, text: `"Everyone glow a little!" ${name} called. Prism sparkled. Bloop bounced the light. Tiny creatures flickered on, one by one, brighter and brighter until -- FLASH! -- the whole station blazed with color! One more step, one more star.`, illustration_prompt: `The child in the center with arms raised as Prism refracts light and dozens of creatures glow, the station lighting up in a burst of rainbow color, triumphant joy` },
        { page_number: 8, text: `Prism gave ${name} a tiny glowing orb. "A piece of starlight -- so you always find your way." Back on the rooftop, the stars felt closer than ever. ${name} held the orb tight and smiled. One more step, one more star. The End.`, illustration_prompt: `The child back on the rooftop at dawn holding a small glowing orb, the silver ship departing as a twinkle in the sky, warm sunrise colors, peaceful smile` },
      ],
    },
    "enchanted-forest": {
      title: `${name} and the Song of Mosshollow`,
      pages: [
        { page_number: 1, text: `Behind the garden wall, ${name} found a crack that breathed out warm air smelling of pine and honey. Through the gap, green light danced between ancient trees. CREAK -- the crack opened wider.`, illustration_prompt: `The child peering through a crack in a mossy stone wall, warm green light spilling out from an ancient forest beyond, curiosity and wonder on their face` },
        { page_number: 2, text: `On the other side sat a badger in a berry-stained apron, stirring a bubbling pot. "I'm Nettlewick!" she said in a gravelly voice. "Haven't had a visitor in forty acorn-seasons. Come, come -- bramble tea?" Together we listen, together we sing.`, illustration_prompt: `The child meeting a stout friendly badger in a berry-stained apron next to a bubbling pot between giant tree roots, cozy warm light, welcoming scene` },
        { page_number: 3, text: `Nettlewick's whiskers drooped. "The forest has gone quiet," she said. "The Song Tree is tangled up, and without its music, nothing will bloom. Spring can't come." Her eyes looked to ${name}. "Will you help?"`, illustration_prompt: `The child and Nettlewick looking out at a grey, budless forest, Nettlewick's whiskers drooping sadly, bare branches visible, the child looking determined` },
        { page_number: 4, text: `They padded down the mossy path -- CRUNCH, CRUNCH -- past glowing mushrooms and sleeping hedgehogs. A copper owl named Quillsworth glided down. "Following you two! Together we'll figure it out." Together we listen, together we sing.`, illustration_prompt: `The child and Nettlewick walking down a mossy path past glowing mushrooms as a copper-feathered owl glides down to join them, dappled forest light` },
        { page_number: 5, text: `Inside the great hollow tree, silver threads crisscrossed like a giant harp -- but all knotted up. Nettlewick's nimble paws untied the low ones. Quillsworth flew to the high ones. ${name} listened for which notes matched. PLUCK -- a sweet sound rang out!`, illustration_prompt: `The child listening intently inside a hollow tree while Nettlewick unties low silver threads and Quillsworth works on high ones, a few threads glowing with freed musical notes` },
        { page_number: 6, text: `But the biggest knot was in the middle -- too high for Nettlewick, too tight for Quillsworth's beak. ${name} looked up at it and felt small. The forest was counting on them.`, illustration_prompt: `The child looking up at a large stubborn knot of silver threads in the center of the tree, Nettlewick and Quillsworth beside them looking worried, dramatic light from above` },
        { page_number: 7, text: `${name} climbed onto Nettlewick's shoulders, reached up, and gently -- gently -- pulled the knot loose. TWANG! The whole tree sang! Music poured out like water. Flowers popped open on every branch. Together we listen, together we sing.`, illustration_prompt: `The child on Nettlewick's shoulders pulling a knot free as the tree explodes with music and flowers bloom instantly on every branch, joyful burst of color and light` },
        { page_number: 8, text: `Nettlewick pressed a tiny jar into ${name}'s hand -- inside, a thread hummed softly. "So you'll find your way back." Outside the wall, the first flowers of spring were already blooming. Together we listen, together we sing. The End.`, illustration_prompt: `The child back at the mossy wall holding a small glowing jar, Nettlewick and Quillsworth waving from the forest side, spring flowers blooming on both sides, warm evening light` },
      ],
    },
    superhero: {
      title: `${name} and the Kindness Badge`,
      pages: [
        { page_number: 1, text: `CLINK! A shiny badge bounced off the mailbox and landed at ${name}'s feet. It was warm to the touch, with a little compass that pointed straight at ${name}'s heart. Something amazing was about to happen.`, illustration_prompt: `The child on a sunny sidewalk picking up a glowing circular badge near a blue mailbox, warm afternoon light, friendly neighborhood behind` },
        { page_number: 2, text: `${name} pinned it on and -- WHOOSH -- the world got brighter. Golden lines connected all the neighbors like a big web of kindness. A flour-dusted woman on the rooftop waved down. "I'm Captain Crumble! Welcome to the Kindness Corps!" Small acts, big hearts, that's our start.`, illustration_prompt: `The child wearing the glowing badge looking up at a rooftop where a stout flour-dusted woman in a baker's hat waves down, golden threads visible connecting houses, bright and cheerful` },
        { page_number: 3, text: `"Mrs. Chen's party decorations blew away in the storm," Captain Crumble said, her voice soft. "The whole street is sad. Nobody knows what to do." ${name} felt a tug at their heart. They wanted to fix it.`, illustration_prompt: `The child and Captain Crumble looking down a quiet street with torn paper lanterns in puddles, a woman on a porch looking sad, empathetic expressions` },
        { page_number: 4, text: `"I have an idea!" ${name} said. "What if everyone helps -- just a little bit each?" Captain Crumble grinned and handed ${name} a courage-cinnamon-roll. CRUNCH! Warmth flooded through them. Small acts, big hearts, that's our start.`, illustration_prompt: `The child biting into a cinnamon roll with a determined grin, Captain Crumble beside them smiling proudly, the badge glowing, energy and excitement` },
        { page_number: 5, text: `Speedy Dash knocked on doors. Mr. Dimitri folded paper cranes. Kids painted banners. Captain Crumble baked. ${name} helped everyone, running from group to group with a big smile. The street buzzed with busy hands.`, illustration_prompt: `The child running between groups of neighbors all making decorations together on a sunny street, paper cranes and painted banners everywhere, bustling happy community scene` },
        { page_number: 6, text: `Then dark clouds rolled in. RUMBLE! Wind tugged at the paper lanterns. "Not again!" Mrs. Chen whispered. Everything they made was about to blow away. ${name}'s tummy clenched -- but the badge glowed warm.`, illustration_prompt: `The child looking up at dark storm clouds gathering as wind tugs at fresh decorations, neighbors looking worried, the badge glowing on the child's chest, tense moment` },
        { page_number: 7, text: `"Follow me -- quick!" ${name} called. Everyone grabbed their decorations and ducked under the big awning just as rain PATTERED down. Safe! Dry! Together! They laughed and cheered. Small acts, big hearts, that's our start.`, illustration_prompt: `The child leading neighbors with armfuls of colorful decorations under a large awning as rain pours outside, everyone laughing together, relief and joy, golden glow` },
        { page_number: 8, text: `When the sun came back, Elm Street sparkled with lanterns and banners. Mrs. Chen smiled so big. "Better than before -- because we made it together." ${name} walked home, badge warm against their chest, ready for tomorrow. Small acts, big hearts, that's our start. The End.`, illustration_prompt: `The child walking down a beautifully decorated street at golden sunset, paper lanterns glowing, neighbors waving, the badge glowing softly, peaceful happy ending` },
      ],
    },
    "fairy-tale": {
      title: `${name} and the Wobbly Kingdom`,
      pages: [
        { page_number: 1, text: `${name} opened the old attic book and -- WHOOSH! -- tumbled onto a cobblestone path. Everything was tilted! The castle leaned left. Flags flew upside down. On the steps sat a tiny mint-green dragon in a singed bow tie. A crown to find, a world to mend.`, illustration_prompt: `The child landing on a cobblestone path before a comically tilted castle with upside-down flags, a small mint-green dragon in a singed bow tie sitting on the steps, whimsical fairy tale scene` },
        { page_number: 2, text: `"I'm Cinders!" the dragon squeaked. "I'm scared of fire -- embarrassing, I know. ACHOO!" A tiny spark popped from his nose and he jumped behind ${name}. His big eyes looked worried but friendly.`, illustration_prompt: `The child looking down at a small nervous mint-green dragon who has just sneezed a tiny spark, the dragon hiding behind the child's legs, endearing and funny moment` },
        { page_number: 3, text: `"The crown rolled into the Giggling Gorge," Cinders said, his voice wobbly. "Without it, everything stays crooked forever." His little chin trembled. "I tried to get it back, but the jokes are too funny. I laughed so hard I fell over."`, illustration_prompt: `The child crouching to comfort Cinders the dragon who looks like he might cry, the tilted castle behind them, empathetic moment, warm light` },
        { page_number: 4, text: `"We'll go together!" ${name} said. They marched down the tilted path -- WOBBLE, WOBBLE -- with Cinders flapping beside them. A crown to find, a world to mend. Past leaning cottages and sliding sheep they went.`, illustration_prompt: `The child and Cinders marching bravely down a tilted path past leaning cottages, Cinders flapping his small wings beside the child, sheep sliding in the background, adventurous energy` },
        { page_number: 5, text: `At the gorge, rocks with silly faces told jokes. "What's green and wobbly? CINDERS!" They all laughed. ${name} covered their ears. Cinders hummed a loud tune. Together they tiptoed past, step by step.`, illustration_prompt: `The child with hands over ears and Cinders humming with eyes squeezed shut, tiptoeing past grinning purple rocks in a gorge, funny tense moment` },
        { page_number: 6, text: `But the crown sat behind the FUNNIEST rock of all. It told joke after joke. ${name}'s giggles bubbled up no matter what. Their legs went wobbly. So close -- but so hard to stop laughing!`, illustration_prompt: `The child trying desperately not to laugh, cheeks puffed, as a grinning rock tells jokes, a golden crown visible just behind it, Cinders covering his ears, comic tension` },
        { page_number: 7, text: `${name} closed their eyes tight and sang as loud as they could -- LA LA LA! They reached out, felt the cold metal, and grabbed the crown! The gorge went quiet, then CLAP CLAP CLAP from every rock. A crown to find, a world to mend!`, illustration_prompt: `The child with eyes closed singing, grabbing the golden crown triumphantly, Cinders cheering, the rocks clapping with surprised happy faces, burst of golden light` },
        { page_number: 8, text: `Back at the castle, everything straightened up. Cinders flew a perfect loop -- "I did it! I flew straight!" The king gave ${name} a gold clasp. "So you can open the story again." ${name} smiled. A crown to find, a world to mend. The End.`, illustration_prompt: `The child holding the gold clasp gift as Cinders flies a happy loop overhead, the castle standing perfectly straight with flags right-side-up, the king waving, warm celebration` },
      ],
    },
  };

  const story = stories[theme] || stories["enchanted-forest"];
  return { ...story, characterSheet: "" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Health-check endpoint: GET request tests OpenAI key validity
  if (req.method === "GET") {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ status: "error", message: "OPENAI_API_KEY is not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    try {
      const testResponse = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${openaiKey}` },
      });
      if (!testResponse.ok) {
        const errBody = await testResponse.text();
        return new Response(
          JSON.stringify({ status: "error", message: `OpenAI returned ${testResponse.status}`, detail: errBody.substring(0, 500) }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ status: "ok", message: "OpenAI API key is valid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (e) {
      return new Response(
        JSON.stringify({ status: "error", message: (e as Error).message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: StoryRequest = await req.json();
    const { story_id, theme, illustration_style, photo_urls } = body;

    await supabase
      .from("stories")
      .update({ status: "generating" })
      .eq("id", story_id);

    let storyContent: GeneratedStory;
    let aiError: string | null = null;

    try {
      storyContent = await generateWithAI(body);
      console.log("AI generation SUCCESS: title =", storyContent.title);
    } catch (err) {
      const errMsg = (err as Error).message;
      const errStack = (err as Error).stack || "";
      aiError = errMsg;
      console.error("AI generation FAILED:", errMsg);
      console.error("Stack:", errStack);
      console.log("Falling back to pre-written story...");
      storyContent = generateFallbackStory(body);
    }

    await supabase
      .from("stories")
      .update({ title: storyContent.title, status: "generating" })
      .eq("id", story_id);

    const referencePhotoUrl = photo_urls && photo_urls.length > 0 ? photo_urls[0] : null;
    const falKey = Deno.env.get("FAL_KEY");
    const useFal = !!falKey && !!referencePhotoUrl;

    const fallbackImages = fallbackIllustrationMap[theme] || fallbackIllustrationMap.dinosaurs;

    let illustrationUrls: string[] = [];

    const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
    const pageEmotions = ["wonder", "delight", "empathy", "excitement", "teamwork", "tension", "triumph", "warmth"];

    if (useFal) {
      console.log("Starting fal.ai illustration generation. Photo URL:", referencePhotoUrl);
      console.log("Illustration style:", illustration_style, "Theme:", theme);
      console.log("Number of pages:", storyContent.pages.length);

      // Process in batches of 2, inserting pages to DB as each batch completes.
      // This ensures partial results are saved even if the function times out.
      const batchSize = 2;
      for (let batchStart = 0; batchStart < storyContent.pages.length; batchStart += batchSize) {
        const batch = storyContent.pages.slice(batchStart, batchStart + batchSize);
        console.log(`Generating batch ${batchStart / batchSize + 1} (pages ${batchStart + 1}-${batchStart + batch.length})...`);

        const batchResults = await Promise.allSettled(
          batch.map((page, batchIdx) => {
            const i = batchStart + batchIdx;
            const prompt = page.illustration_prompt || page.text;
            return generateIllustrationWithFal(
              prompt,
              referencePhotoUrl!,
              illustration_style,
              theme
            ).catch((err) => {
              console.error(`FAL ERROR page ${i + 1}:`, (err as Error).message);
              return fallbackImages[i % fallbackImages.length];
            });
          })
        );

        const batchInserts = batch.map((page, batchIdx) => {
          const i = batchStart + batchIdx;
          const result = batchResults[batchIdx];
          let url: string;
          if (result.status === "fulfilled") {
            url = result.value;
            console.log(`Page ${i + 1}: ${url.startsWith("https://fal") ? "GENERATED" : "FALLBACK"}`);
          } else {
            url = fallbackImages[i % fallbackImages.length];
            console.error(`Page ${i + 1}: REJECTED -`, (result as PromiseRejectedResult).reason);
          }
          illustrationUrls.push(url);
          return {
            story_id,
            page_number: page.page_number,
            text_content: page.text,
            illustration_url: url,
          };
        });

        await supabase.from("story_pages").insert(batchInserts);
      }
    } else {
      console.log("Skipping fal.ai: useFal =", useFal, "falKey =", !!falKey, "photoUrl =", !!referencePhotoUrl);
      illustrationUrls = storyContent.pages.map((_, i) => fallbackImages[i % fallbackImages.length]);
      const pageInserts = storyContent.pages.map((page, i) => ({
        story_id,
        page_number: page.page_number,
        text_content: page.text,
        illustration_url: illustrationUrls[i],
      }));
      await supabase.from("story_pages").insert(pageInserts);
    }

    // Mark story complete immediately after pages are inserted
    const { error: updateError } = await supabase
      .from("stories")
      .update({ status: "complete", page_count: storyContent.pages.length })
      .eq("id", story_id);

    if (updateError) {
      console.error("Failed to update story status:", updateError.message);
    }

    return new Response(
      JSON.stringify({ success: true, story_id, title: storyContent.title, ai_error: aiError }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    // Safety net: try to mark story as complete if pages were already inserted
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.story_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: pages } = await supabase
          .from("story_pages")
          .select("id")
          .eq("story_id", body.story_id)
          .limit(1);
        if (pages && pages.length > 0) {
          await supabase
            .from("stories")
            .update({ status: "complete" })
            .eq("id", body.story_id);
        } else {
          await supabase
            .from("stories")
            .update({ status: "failed" })
            .eq("id", body.story_id);
        }
      }
    } catch (_) { /* best effort */ }

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
