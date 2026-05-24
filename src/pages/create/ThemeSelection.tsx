import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Palette, Wand2 } from 'lucide-react';
import { useWizard } from '../../context/WizardContext';

const themes = [
  {
    id: 'superhero',
    label: 'Superhero Quest',
    emoji: '\uD83E\uDDB8',
    desc: 'Save the day with incredible super powers',
    color: 'bg-red-50 border-red-200 hover:border-red-400',
    activeColor: 'bg-red-100 border-red-500',
  },
  {
    id: 'fairy-tale',
    label: 'Fairy Tale Kingdom',
    emoji: '\uD83C\uDFF0',
    desc: 'Enter a kingdom of castles, dragons, and magic',
    color: 'bg-pink-50 border-pink-200 hover:border-pink-400',
    activeColor: 'bg-pink-100 border-pink-500',
  },
];


export function ThemeSelection() {
  const { data, updateData } = useWizard();
  const navigate = useNavigate();

  function handleNext() {
    if (data.theme) {
      navigate('/create/generating');
    }
  }

  return (
    <div className="animate-fade-in-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-ocean-100 mb-4">
          <Wand2 className="w-8 h-8 text-ocean-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-gray-900 mb-3">
          Choose {data.name ? `${data.name}'s` : 'the'} Adventure
        </h1>
        <p className="text-lg text-gray-600 max-w-lg mx-auto">
          Pick a story world and illustration style for the adventure.
        </p>
      </div>

      <div className="space-y-8 max-w-3xl mx-auto">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Story Theme</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {themes.map(theme => (
              <button
                key={theme.id}
                onClick={() => updateData({ theme: theme.id })}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  data.theme === theme.id
                    ? `${theme.activeColor} shadow-md scale-[1.02]`
                    : theme.color
                }`}
              >
                <span className="text-2xl">{theme.emoji}</span>
                <p className="font-semibold text-gray-900 mt-2">{theme.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{theme.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-brand-500" />
            Illustration Style - Cartoon
          </h2>
          <p className="text-sm text-gray-500 mt-1">Bright, fun, comic style</p>
        </div>
      </div>

      <div className="mt-8 flex justify-between max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/create/profile')}
          className="inline-flex items-center px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!data.theme}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          Create Story
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
}
