import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { BookOpen, ArrowLeft, Zap } from 'lucide-react';
import { useWizard } from '../../context/WizardContext';

const steps = [
  { path: '/create/photos', label: 'Photos' },
  { path: '/create/profile', label: 'Profile' },
  { path: '/create/theme', label: 'Theme' },
  { path: '/create/generating', label: 'Story' },
];

const TEST_PHOTO_URL = 'https://images.pexels.com/photos/1619697/pexels-photo-1619697.jpeg?auto=compress&cs=tinysrgb&w=600';

async function fetchTestPhoto(): Promise<File> {
  const response = await fetch(TEST_PHOTO_URL);
  const blob = await response.blob();
  return new File([blob], 'test-child.jpg', { type: 'image/jpeg' });
}

export function WizardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { updateData } = useWizard();

  async function handleAutofill() {
    const testPhoto = await fetchTestPhoto();
    const previewUrl = URL.createObjectURL(testPhoto);
    updateData({
      photos: [testPhoto],
      photoPreviewUrls: [previewUrl],
      name: 'Emma',
      age: 5,
      nickname: 'Emmy',
      interests: ['Dinosaurs', 'Space', 'Art & Drawing'],
      favorite_things: 'Purple, cats, pasta',
      favorite_toy: 'Stuffed elephant named Peanut',
      proud_of: 'Learning to ride a bike',
      currently_learning: 'How to tie shoes',
      story_mood: 'Silly Adventure',
      family_phrase: 'You can do hard things!',
      themes_to_avoid: '',
      reading_level: 'beginner',
      theme: 'dinosaurs',
      illustration_style: 'cartoon',
    });
    navigate('/create/generating');
  }
  const currentStepIndex = steps.findIndex(s => location.pathname.startsWith(s.path));
  const isGenerating = location.pathname.includes('generating') || location.pathname.includes('story/');

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-50 via-white to-ocean-50">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-sand-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-brand-600 hover:text-brand-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </Link>

          <Link to="/" className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-brand-500" />
            <span className="font-display font-bold text-lg text-gray-900">Adventures Of</span>
          </Link>

          <button
            onClick={handleAutofill}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
            title="Autofill wizard with test data"
          >
            <Zap className="w-3 h-3" />
            <span className="hidden sm:inline">Test</span>
          </button>
        </div>

        {!isGenerating && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-4">
            <div className="flex items-center gap-2">
              {steps.slice(0, 3).map((step, i) => (
                <div key={step.path} className="flex items-center flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                        i < currentStepIndex
                          ? 'bg-forest-500 text-white'
                          : i === currentStepIndex
                          ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {i < currentStepIndex ? '✓' : i + 1}
                    </div>
                    <span
                      className={`text-sm font-medium hidden sm:block ${
                        i <= currentStepIndex ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 rounded transition-colors duration-300 ${
                        i < currentStepIndex ? 'bg-forest-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <Outlet />
      </main>
    </div>
  );
}
