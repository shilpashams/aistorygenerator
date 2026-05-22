import { useEffect } from 'react';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ heading: level, spacing: { before: 400, after: 200 }, children: [new TextRun({ text, bold: true })] });
}

function body(text: string) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 22 })] });
}

function bold(text: string) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, bold: true, size: 22 })] });
}

function bullet(text: string, level = 0) {
  return new Paragraph({ bullet: { level }, spacing: { after: 80 }, children: [new TextRun({ text, size: 22 })] });
}

function mono(text: string) {
  return new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text, font: 'Courier New', size: 20 })] });
}

function tableRow(cells: string[], isHeader = false) {
  return new TableRow({
    children: cells.map(
      (cell) =>
        new TableCell({
          width: { size: Math.floor(9000 / cells.length), type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: cell, bold: isHeader, size: 20 })] })],
        })
    ),
  });
}

function createTable(headers: string[], rows: string[][]) {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
    rows: [tableRow(headers, true), ...rows.map((r) => tableRow(r))],
  });
}

function generateDocument() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: 'Technical Architecture & Data Flow', bold: true, size: 48 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [new TextRun({ text: 'Personalized Children\'s Storybook App', size: 28, italics: true })],
          }),
          body('Date: May 2026'),
          body(''),

          // System Overview
          heading('1. System Overview', HeadingLevel.HEADING_1),
          body('The application is a personalized children\'s storybook generator that creates unique stories featuring the child as the protagonist. It combines AI text generation with planned LoRA-based image personalization to create fully customized illustrated stories.'),
          body(''),
          bold('Technology Stack:'),
          bullet('Frontend: React + Vite + TypeScript + Tailwind CSS'),
          bullet('Backend: Supabase (PostgreSQL, Edge Functions, Storage)'),
          bullet('AI Text: OpenAI GPT-4o-mini'),
          bullet('AI Images (planned): fal.ai Flux LoRA fast training'),
          bullet('Current Images: Pexels curated stock photos'),
          body(''),

          // Architecture Diagram (text form)
          heading('2. Architecture Diagram', HeadingLevel.HEADING_1),
          body(''),
          mono('FRONTEND (React + Vite + Tailwind)'),
          mono('  Landing Page  -->  Wizard Flow  -->  Story Reader'),
          mono('       /              /create/*         /create/story/:id'),
          mono('                         |'),
          mono('                         | REST / Supabase JS Client'),
          mono('                         v'),
          mono('SUPABASE PLATFORM'),
          mono('  PostgreSQL DB            Edge Function: generate-story'),
          mono('  - child_profiles         - OpenAI GPT-4o-mini (text)'),
          mono('  - stories                - fal.ai LoRA (planned images)'),
          mono('  - story_pages            - Fallback templates'),
          mono('                         |'),
          mono('  Storage (planned)      | External APIs'),
          mono('  - Photo uploads          v'),
          mono('                     THIRD-PARTY SERVICES'),
          mono('                       OpenAI API --> Story text'),
          mono('                       fal.ai API --> LoRA training + inference'),
          mono('                       Pexels     --> Stock illustration fallback'),
          body(''),

          // Database Schema
          heading('3. Database Schema', HeadingLevel.HEADING_1),
          body(''),
          bold('child_profiles'),
          createTable(
            ['Column', 'Type', 'Description'],
            [
              ['id', 'uuid (PK)', 'Primary key, auto-generated'],
              ['name', 'text', 'Child\'s first name'],
              ['age', 'integer', 'Child\'s age (2-12)'],
              ['interests', 'text[]', 'Array of selected interests (max 5)'],
              ['favorite_things', 'text', 'Favorite color, animal, food'],
              ['themes_to_avoid', 'text', 'Topics to exclude from stories'],
              ['reading_level', 'text', 'beginner | intermediate | advanced'],
              ['photo_urls', 'text[]', 'Array of uploaded photo URLs'],
              ['session_id', 'text', 'Anonymous session tracking UUID'],
              ['user_id', 'uuid (FK, nullable)', 'Optional authenticated user'],
              ['created_at', 'timestamptz', 'Record creation timestamp'],
            ]
          ),
          body(''),
          bold('stories'),
          createTable(
            ['Column', 'Type', 'Description'],
            [
              ['id', 'uuid (PK)', 'Primary key, auto-generated'],
              ['child_profile_id', 'uuid (FK)', 'References child_profiles.id'],
              ['title', 'text', 'AI-generated story title'],
              ['theme', 'text', 'dinosaurs | space | ocean | enchanted-forest | superhero | fairy-tale'],
              ['illustration_style', 'text', 'watercolor | cartoon | storybook | digital-art'],
              ['status', 'text', 'pending | generating | complete | failed'],
              ['page_count', 'integer', 'Number of pages in the story'],
              ['created_at', 'timestamptz', 'Record creation timestamp'],
            ]
          ),
          body(''),
          bold('story_pages'),
          createTable(
            ['Column', 'Type', 'Description'],
            [
              ['id', 'uuid (PK)', 'Primary key, auto-generated'],
              ['story_id', 'uuid (FK)', 'References stories.id'],
              ['page_number', 'integer', 'Page order within story'],
              ['text_content', 'text', 'Story narrative for this page'],
              ['illustration_url', 'text', 'URL to page illustration'],
              ['created_at', 'timestamptz', 'Record creation timestamp'],
            ]
          ),
          body(''),
          body('Row Level Security (RLS) is enabled on all tables. Access is controlled via session_id (anonymous) or auth.uid() (authenticated) with ownership checks through the child_profiles relationship chain.'),
          body(''),

          // User Flow
          heading('4. User Flow (Data Flow)', HeadingLevel.HEADING_1),
          body(''),
          bold('Step 1: Photo Upload (/create/photos)'),
          bullet('Input: 1-3 photos of the child (drag-drop or file picker)'),
          bullet('Validation: Image MIME types only, max 3 files'),
          bullet('Storage: In-memory (WizardContext) as File objects'),
          bullet('Future: Upload to Supabase Storage for LoRA training'),
          body(''),
          bold('Step 2: Child Profile (/create/profile)'),
          bullet('Input: name, age (2-12), interests (1-5 selections from 14 options)'),
          bullet('Optional: favorite_things, themes_to_avoid'),
          bullet('Required: reading_level (beginner/intermediate/advanced)'),
          bullet('Storage: WizardContext state'),
          body(''),
          bold('Step 3: Theme Selection (/create/theme)'),
          bullet('Theme options: Dinosaur Adventure, Space Explorer, Ocean Discovery, Enchanted Forest, Superhero Quest, Fairy Tale Kingdom'),
          bullet('Style options: Watercolor, Cartoon, Classic Storybook, Digital Art'),
          bullet('Storage: WizardContext state'),
          body(''),
          bold('Step 4: Story Generation (/create/generating)'),
          bullet('INSERT child_profiles row with all collected data + session_id'),
          bullet('INSERT stories row with status=\'pending\''),
          bullet('POST to /functions/v1/generate-story with full payload'),
          bullet('Edge function updates status to \'generating\''),
          bullet('OpenAI generates 5-page story (or fallback templates used)'),
          bullet('INSERT 5 story_pages with text + illustration URLs'),
          bullet('Update story status to \'complete\' with title and page_count'),
          bullet('Frontend polls every 2 seconds until complete'),
          body(''),
          bold('Step 5: Story Reader (/create/story/:storyId)'),
          bullet('Fetch story metadata + all pages ordered by page_number'),
          bullet('Display page-by-page with illustration, text, and navigation'),
          bullet('Actions: Previous/Next page, Create Another Story, Back to Home'),
          body(''),

          // AI Pipeline
          heading('5. AI Story Generation Pipeline', HeadingLevel.HEADING_1),
          body(''),
          bold('Prompt Construction:'),
          bullet('System prompt defines role as children\'s book author'),
          bullet('Reading level guide adjusts vocabulary complexity'),
          bullet('Child\'s name used as protagonist throughout'),
          bullet('Interests woven into narrative elements'),
          bullet('Themes to avoid explicitly excluded'),
          bullet('Output: JSON with title + 5 page objects'),
          body(''),
          bold('Model Configuration:'),
          bullet('Model: OpenAI GPT-4o-mini'),
          bullet('Output format: Structured JSON (title + pages array)'),
          bullet('Pages: Exactly 5 per story'),
          bullet('Fallback: Theme-specific hardcoded templates with name interpolation'),
          body(''),
          bold('Reading Level Adaptation:'),
          createTable(
            ['Level', 'Age Range', 'Characteristics'],
            [
              ['Beginner', '3-4 years', 'Simple words, very short sentences, repetitive patterns'],
              ['Intermediate', '5-6 years', 'Short sentences, basic vocabulary, clear narrative'],
              ['Advanced', '7-9 years', 'Full paragraphs, richer vocabulary, complex plot'],
            ]
          ),
          body(''),

          // LoRA Integration
          heading('6. Planned fal.ai LoRA Integration', HeadingLevel.HEADING_1),
          body(''),
          bold('Training Phase (~2 minutes):'),
          bullet('Upload 3 child photos to Supabase Storage'),
          bullet('POST to fal.ai flux-lora-fast-training endpoint'),
          bullet('Payload: image URLs + trigger_word (e.g., "ohwx child")'),
          bullet('Poll fal.ai queue until training completes'),
          bullet('Store trained model weights URL in child_profiles'),
          body(''),
          bold('Image Generation Phase (~10 seconds per image):'),
          bullet('For each of 5 story pages, call fal.ai flux-lora inference'),
          bullet('Prompt combines: trigger word + illustration style + scene description'),
          bullet('Example: "ohwx child in watercolor style riding a friendly dinosaur through a lush jungle"'),
          bullet('Store generated image URLs in story_pages.illustration_url'),
          body(''),
          bold('Cost & Performance:'),
          createTable(
            ['Operation', 'Cost', 'Time', 'Provider'],
            [
              ['LoRA Training', '~$2.00', '~2 minutes', 'fal.ai flux-lora-fast-training'],
              ['Image Generation (x5)', '~$0.05', '~50 seconds total', 'fal.ai flux-lora inference'],
              ['Text Generation', '~$0.01', '~5 seconds', 'OpenAI GPT-4o-mini'],
              ['Total per Story', '~$2.06', '~3-4 minutes', 'Combined'],
            ]
          ),
          body(''),
          bold('Fallback Strategy:'),
          bullet('If fal.ai unavailable: Use curated Pexels stock images per theme'),
          bullet('If OpenAI unavailable: Use hardcoded template stories with name interpolation'),
          bullet('Graceful degradation ensures stories are always delivered'),
          body(''),

          // Environment & Secrets
          heading('7. Environment & Secrets', HeadingLevel.HEADING_1),
          body(''),
          createTable(
            ['Variable', 'Location', 'Purpose'],
            [
              ['VITE_SUPABASE_URL', 'Frontend .env', 'Supabase project URL'],
              ['VITE_SUPABASE_ANON_KEY', 'Frontend .env', 'Public API key for client'],
              ['SUPABASE_URL', 'Edge Function (auto)', 'Supabase URL in function runtime'],
              ['SUPABASE_SERVICE_ROLE_KEY', 'Edge Function (auto)', 'Admin database access'],
              ['OPENAI_API_KEY', 'Edge Function secret', 'GPT-4o-mini story generation'],
              ['FAL_KEY (planned)', 'Edge Function secret', 'LoRA training + image inference'],
            ]
          ),
          body(''),

          // Security
          heading('8. Security Architecture', HeadingLevel.HEADING_1),
          body(''),
          bold('Row Level Security (RLS):'),
          bullet('All tables have RLS enabled -- no public access by default'),
          bullet('child_profiles: Users can only access rows matching their session_id or auth.uid()'),
          bullet('stories: Access controlled through FK relationship to child_profiles'),
          bullet('story_pages: Access controlled through stories -> child_profiles chain'),
          body(''),
          bold('API Security:'),
          bullet('Edge functions require Authorization header with valid anon key'),
          bullet('Service role key used only server-side for DB writes in edge functions'),
          bullet('CORS headers configured for cross-origin access'),
          bullet('No sensitive keys exposed in frontend code'),
          body(''),
          bold('Session Management:'),
          bullet('Anonymous sessions tracked via localStorage UUID'),
          bullet('Session ID generated once, persisted in browser'),
          bullet('Optional user_id FK for future authenticated accounts'),
          body(''),

          // Key Design Decisions
          heading('9. Key Design Decisions', HeadingLevel.HEADING_1),
          body(''),
          bullet('Anonymous-first: No auth barrier to create first story. Session-based tracking allows returning to stories.'),
          bullet('Async generation: Edge function writes to DB; frontend polls. Resilient to HTTP timeouts on slow AI calls.'),
          bullet('Graceful degradation: AI unavailable = template stories. LoRA unavailable = stock images. Stories always delivered.'),
          bullet('Reading-level adaptation: Prompt engineering adjusts vocabulary, sentence length, and narrative complexity.'),
          bullet('Personalization layers: Name as protagonist + interests in narrative + excluded themes = unique stories.'),
          bullet('5-page format: Short enough for attention spans, long enough for a complete story arc.'),
          bullet('Multi-step wizard: Progressive disclosure reduces cognitive load vs. a single long form.'),
        ],
      },
    ],
  });

  return doc;
}

export function ArchitectureDoc() {
  useEffect(() => {
    const doc = generateDocument();
    Packer.toBlob(doc).then((blob) => {
      saveAs(blob, 'Technical_Architecture_Storybook_App.docx');
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-4"></div>
        <p className="text-gray-700 text-lg">Generating document...</p>
        <p className="text-gray-500 text-sm mt-2">Your download will begin automatically.</p>
      </div>
    </div>
  );
}
