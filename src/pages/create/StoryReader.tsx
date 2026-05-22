import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, BookOpen, Home, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useWizard } from '../../context/WizardContext';
import type { Story, StoryPage } from '../../lib/types';

export function StoryReader() {
  const { storyId } = useParams<{ storyId: string }>();
  const { reset } = useWizard();
  const [story, setStory] = useState<Story | null>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStory() {
      if (!storyId) return;

      const { data: storyData } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .maybeSingle();

      if (storyData) {
        setStory(storyData);

        const { data: pagesData } = await supabase
          .from('story_pages')
          .select('*')
          .eq('story_id', storyId)
          .order('page_number', { ascending: true });

        if (pagesData && pagesData.length > 0) {
          setPages(pagesData);
        } else {
          setPages(generateDemoPages(storyData));
        }
      } else {
        setPages(generateDemoPages(null));
      }

      setLoading(false);
    }

    fetchStory();
  }, [storyId]);

  function generateDemoPages(story: Story | null): StoryPage[] {
    const name = 'your child';
    const theme = story?.theme || 'adventure';
    const themeContent = getThemeContent(theme, name);

    return themeContent.map((page, i) => ({
      story_id: storyId || '',
      page_number: i + 1,
      text_content: page.text,
      illustration_url: page.illustration,
    }));
  }

  function nextPage() {
    if (currentPage < pages.length - 1) setCurrentPage(prev => prev + 1);
  }

  function prevPage() {
    if (currentPage > 0) setCurrentPage(prev => prev - 1);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-center">
          <BookOpen className="w-12 h-12 text-brand-400 mx-auto mb-4" />
          <p className="text-gray-500">Loading your story...</p>
        </div>
      </div>
    );
  }

  const page = pages[currentPage];

  return (
    <div className="animate-fade-in-up">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-gray-900">
          {story?.title || 'A Magical Adventure'}
        </h1>
      </div>

      <div className="relative max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-sand-200">
          {page?.illustration_url && (
            <div className="aspect-[16/10] bg-gradient-to-br from-sand-100 to-ocean-50 relative overflow-hidden">
              <img
                src={page.illustration_url}
                alt={`Page ${currentPage + 1} illustration`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
          )}

          <div className="p-6 sm:p-8">
            <p className="text-lg sm:text-xl text-gray-800 leading-relaxed font-body">
              {page?.text_content}
            </p>
          </div>

          <div className="px-6 sm:px-8 pb-6 flex items-center justify-between">
            <button
              onClick={prevPage}
              disabled={currentPage === 0}
              className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center disabled:opacity-30 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>

            <span className="text-sm text-gray-500 font-medium">
              Page {currentPage + 1} of {pages.length}
            </span>

            <button
              onClick={nextPage}
              disabled={currentPage === pages.length - 1}
              className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center disabled:opacity-30 hover:bg-brand-600 transition-colors text-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-2 mt-4">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                i === currentPage ? 'bg-brand-500 w-6' : 'bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link to="/create/photos" onClick={reset} className="btn-secondary">
          <RotateCcw className="w-4 h-4 mr-2" />
          Create Another Story
        </Link>
        <Link to="/" className="inline-flex items-center px-6 py-3 text-gray-600 font-medium hover:text-gray-900 transition-colors">
          <Home className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}

function getThemeContent(theme: string, name: string): { text: string; illustration: string }[] {
  const themes: Record<string, { text: string; illustration: string }[]> = {
    dinosaurs: [
      { text: `${name} dug in the garden and found a golden egg, warm as sunshine. It cracked -- POP! -- and two big amber eyes blinked up.`, illustration: 'https://images.pexels.com/photos/3571551/pexels-photo-3571551.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Out tumbled a tiny green triceratops with clumsy feet. THUMP, CRASH -- it knocked over a flowerpot and sneezed. "I'll call you Bramblesnout," ${name} laughed.`, illustration: 'https://images.pexels.com/photos/33535/praying-mantis-702-702-702.jpg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Bramblesnout tugged ${name}'s hand toward the old stone wall. Behind the ivy was a glowing archway -- and through it, a sad WHOOO echoed. Someone needed help. Brave and kind, that's what we are.`, illustration: 'https://images.pexels.com/photos/2832034/pexels-photo-2832034.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `They stepped through into a jungle of giant ferns! STOMP, STOMP -- the ground shook. A pterodactyl named Fizzbeak swooped down. "Granny Fern is stuck in the mud! Follow me -- quick, quick, quick!"`, illustration: 'https://images.pexels.com/photos/1374295/pexels-photo-1374295.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `At the mud flats, a big gentle brachiosaurus was sinking. "Don't worry!" ${name} called. Bramblesnout dragged logs, Fizzbeak carried sticks, and together they built a bridge. Brave and kind, that's what we are.`, illustration: 'https://images.pexels.com/photos/36717/amazing-animal-beautiful-beauty.jpg?auto=compress&cs=tinysrgb&w=800' },
      { text: `The mud was thick and gloopy. SQUELCH! The bridge wobbled. ${name} took a deep breath. It was scary -- but friends were counting on them.`, illustration: 'https://images.pexels.com/photos/3571551/pexels-photo-3571551.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `${name} pushed with all their might. Bramblesnout pulled. Fizzbeak heaved. GLORP! -- out came Granny Fern with a great big splash! "Thank you, little ones," she rumbled. Brave and kind, that's what we are.`, illustration: 'https://images.pexels.com/photos/2832034/pexels-photo-2832034.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Granny Fern hummed a deep warm song. Bramblesnout fell asleep in ${name}'s lap, snoring softly. "Come back tomorrow?" she asked. "Tomorrow," ${name} promised. And the golden archway glowed, waiting for the next adventure. The End.`, illustration: 'https://images.pexels.com/photos/1374295/pexels-photo-1374295.jpeg?auto=compress&cs=tinysrgb&w=800' },
    ],
    space: [
      { text: `${name} counted stars from the rooftop when -- WHOOSH! -- a tiny silver ship landed on the railing. A hatch popped open and a sparkly crystal creature tumbled out, jingling like bells.`, illustration: 'https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `"I'm Prism!" it chimed. "I'm lost -- three galaxies off course. Will you help me find my way home?" Its little crystal face looked so hopeful. One more step, one more star.`, illustration: 'https://images.pexels.com/photos/1341279/pexels-photo-1341279.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Inside the ship, Prism showed ${name} a broken star-map with scattered dots. "Without this, I'll never find Station Wanderlost." A tear like a diamond rolled down its cheek.`, illustration: 'https://images.pexels.com/photos/956981/pexels-photo-956981.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `"Let's fix it together!" ${name} said. The ship shot upward -- ZOOM! Stars streaked past the windows. They whooshed through a pink-and-gold nebula that smelled like cotton candy. One more step, one more star.`, illustration: 'https://images.pexels.com/photos/1274260/pexels-photo-1274260.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `A big bouncy blob named Bloop floated alongside. "Need help? I know shortcuts!" Bloop bounced the ship around asteroids -- BOING, BOING, BOING -- while ${name} read the stars and Prism lit the way.`, illustration: 'https://images.pexels.com/photos/1229042/pexels-photo-1229042.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `But the station was dark and cold when they arrived. Its lights had gone out. "Oh no," Prism whispered, crystals dimming. "Everyone's lost in the dark." ${name}'s tummy fluttered, but they squeezed Prism's hand.`, illustration: 'https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `"Everyone glow a little!" ${name} called. Prism sparkled. Bloop bounced the light. Tiny creatures flickered on, one by one, brighter and brighter until -- FLASH! -- the whole station blazed with color! One more step, one more star.`, illustration: 'https://images.pexels.com/photos/956981/pexels-photo-956981.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Prism gave ${name} a tiny glowing orb. "A piece of starlight -- so you always find your way." Back on the rooftop, the stars felt closer than ever. ${name} held the orb tight and smiled. One more step, one more star. The End.`, illustration: 'https://images.pexels.com/photos/1341279/pexels-photo-1341279.jpeg?auto=compress&cs=tinysrgb&w=800' },
    ],
    'enchanted-forest': [
      { text: `Behind the garden wall, ${name} found a crack that breathed out warm air smelling of pine and honey. Through the gap, green light danced between ancient trees. CREAK -- the crack opened wider.`, illustration: 'https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `On the other side sat a badger in a berry-stained apron, stirring a bubbling pot. "I'm Nettlewick!" she said in a gravelly voice. "Haven't had a visitor in forty acorn-seasons. Come, come -- bramble tea?" Together we listen, together we sing.`, illustration: 'https://images.pexels.com/photos/2295744/pexels-photo-2295744.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Nettlewick's whiskers drooped. "The forest has gone quiet," she said. "The Song Tree is tangled up, and without its music, nothing will bloom. Spring can't come." Her eyes looked to ${name}. "Will you help?"`, illustration: 'https://images.pexels.com/photos/1423600/pexels-photo-1423600.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `They padded down the mossy path -- CRUNCH, CRUNCH -- past glowing mushrooms and sleeping hedgehogs. A copper owl named Quillsworth glided down. "Following you two! Together we'll figure it out." Together we listen, together we sing.`, illustration: 'https://images.pexels.com/photos/1366630/pexels-photo-1366630.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Inside the great hollow tree, silver threads crisscrossed like a giant harp -- but all knotted up. Nettlewick's nimble paws untied the low ones. Quillsworth flew to the high ones. ${name} listened for which notes matched. PLUCK -- a sweet sound rang out!`, illustration: 'https://images.pexels.com/photos/1486974/pexels-photo-1486974.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `But the biggest knot was in the middle -- too high for Nettlewick, too tight for Quillsworth's beak. ${name} looked up at it and felt small. The forest was counting on them.`, illustration: 'https://images.pexels.com/photos/1179229/pexels-photo-1179229.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `${name} climbed onto Nettlewick's shoulders, reached up, and gently -- gently -- pulled the knot loose. TWANG! The whole tree sang! Music poured out like water. Flowers popped open on every branch. Together we listen, together we sing.`, illustration: 'https://images.pexels.com/photos/1423600/pexels-photo-1423600.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Nettlewick pressed a tiny jar into ${name}'s hand -- inside, a thread hummed softly. "So you'll find your way back." Outside the wall, the first flowers of spring were already blooming. Together we listen, together we sing. The End.`, illustration: 'https://images.pexels.com/photos/2295744/pexels-photo-2295744.jpeg?auto=compress&cs=tinysrgb&w=800' },
    ],
    superhero: [
      { text: `CLINK! A shiny badge bounced off the mailbox and landed at ${name}'s feet. It was warm to the touch, with a little compass that pointed straight at ${name}'s heart. Something amazing was about to happen.`, illustration: 'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `${name} pinned it on and -- WHOOSH -- the world got brighter. Golden lines connected all the neighbors like a big web of kindness. A flour-dusted woman on the rooftop waved down. "I'm Captain Crumble! Welcome to the Kindness Corps!" Small acts, big hearts, that's our start.`, illustration: 'https://images.pexels.com/photos/1089842/pexels-photo-1089842.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `"Mrs. Chen's party decorations blew away in the storm," Captain Crumble said, her voice soft. "The whole street is sad. Nobody knows what to do." ${name} felt a tug at their heart. They wanted to fix it.`, illustration: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `"I have an idea!" ${name} said. "What if everyone helps -- just a little bit each?" Captain Crumble grinned and handed ${name} a courage-cinnamon-roll. CRUNCH! Warmth flooded through them. Small acts, big hearts, that's our start.`, illustration: 'https://images.pexels.com/photos/1118873/pexels-photo-1118873.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Speedy Dash knocked on doors. Mr. Dimitri folded paper cranes. Kids painted banners. Captain Crumble baked. ${name} helped everyone, running from group to group with a big smile. The street buzzed with busy hands.`, illustration: 'https://images.pexels.com/photos/1252890/pexels-photo-1252890.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Then dark clouds rolled in. RUMBLE! Wind tugged at the paper lanterns. "Not again!" Mrs. Chen whispered. Everything they made was about to blow away. ${name}'s tummy clenched -- but the badge glowed warm.`, illustration: 'https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `"Follow me -- quick!" ${name} called. Everyone grabbed their decorations and ducked under the big awning just as rain PATTERED down. Safe! Dry! Together! They laughed and cheered. Small acts, big hearts, that's our start.`, illustration: 'https://images.pexels.com/photos/1108099/pexels-photo-1108099.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `When the sun came back, Elm Street sparkled with lanterns and banners. Mrs. Chen smiled so big. "Better than before -- because we made it together." ${name} walked home, badge warm against their chest, ready for tomorrow. Small acts, big hearts, that's our start. The End.`, illustration: 'https://images.pexels.com/photos/1089842/pexels-photo-1089842.jpeg?auto=compress&cs=tinysrgb&w=800' },
    ],
    'fairy-tale': [
      { text: `${name} opened the old attic book and -- WHOOSH! -- tumbled onto a cobblestone path. Everything was tilted! The castle leaned left. Flags flew upside down. On the steps sat a tiny mint-green dragon in a singed bow tie. A crown to find, a world to mend.`, illustration: 'https://images.pexels.com/photos/2832040/pexels-photo-2832040.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `"I'm Cinders!" the dragon squeaked. "I'm scared of fire -- embarrassing, I know. ACHOO!" A tiny spark popped from his nose and he jumped behind ${name}. His big eyes looked worried but friendly.`, illustration: 'https://images.pexels.com/photos/1485894/pexels-photo-1485894.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `"The crown rolled into the Giggling Gorge," Cinders said, his voice wobbly. "Without it, everything stays crooked forever." His little chin trembled. "I tried to get it back, but the jokes are too funny. I laughed so hard I fell over."`, illustration: 'https://images.pexels.com/photos/3617500/pexels-photo-3617500.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `"We'll go together!" ${name} said. They marched down the tilted path -- WOBBLE, WOBBLE -- with Cinders flapping beside them. A crown to find, a world to mend. Past leaning cottages and sliding sheep they went.`, illustration: 'https://images.pexels.com/photos/1028600/pexels-photo-1028600.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `At the gorge, rocks with silly faces told jokes. "What's green and wobbly? CINDERS!" They all laughed. ${name} covered their ears. Cinders hummed a loud tune. Together they tiptoed past, step by step.`, illustration: 'https://images.pexels.com/photos/1252869/pexels-photo-1252869.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `But the crown sat behind the FUNNIEST rock of all. It told joke after joke. ${name}'s giggles bubbled up no matter what. Their legs went wobbly. So close -- but so hard to stop laughing!`, illustration: 'https://images.pexels.com/photos/2832040/pexels-photo-2832040.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `${name} closed their eyes tight and sang as loud as they could -- LA LA LA! They reached out, felt the cold metal, and grabbed the crown! The gorge went quiet, then CLAP CLAP CLAP from every rock. A crown to find, a world to mend!`, illustration: 'https://images.pexels.com/photos/3617500/pexels-photo-3617500.jpeg?auto=compress&cs=tinysrgb&w=800' },
      { text: `Back at the castle, everything straightened up. Cinders flew a perfect loop -- "I did it! I flew straight!" The king gave ${name} a gold clasp. "So you can open the story again." ${name} smiled. A crown to find, a world to mend. The End.`, illustration: 'https://images.pexels.com/photos/1485894/pexels-photo-1485894.jpeg?auto=compress&cs=tinysrgb&w=800' },
    ],
  };

  return themes[theme] || themes['enchanted-forest'];
}
