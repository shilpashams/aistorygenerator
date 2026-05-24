import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, User, Sparkles } from 'lucide-react';
import { useWizard } from '../../context/WizardContext';

const interestOptions = [
  'Space', 'Animals', 'Princesses', 'Superheroes',
  'Cars & Trucks', 'Fairies & Magic', 'Sports',
  'Music', 'Robots', 'Art & Drawing',
];


const storyMoodOptions = [
  { value: 'bedtime-calm', label: 'Bedtime Calm', desc: 'Gentle, soothing, wind-down' },
  { value: 'silly-adventure', label: 'Silly Adventure', desc: 'Giggly, goofy, surprising' },
  { value: 'bravery', label: 'Bravery', desc: 'Courageous, overcoming fears' },
  { value: 'friendship', label: 'Friendship', desc: 'Connection, sharing, teamwork' },
  { value: 'confidence', label: 'Confidence', desc: 'Self-belief, trying new things' },
  { value: 'curiosity', label: 'Curiosity', desc: 'Exploring, asking, discovering' },
];

export function ChildProfile() {
  const { data, updateData } = useWizard();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleInterest(interest: string) {
    const current = data.interests;
    if (current.includes(interest)) {
      updateData({ interests: current.filter(i => i !== interest) });
    } else if (current.length < 5) {
      updateData({ interests: [...current, interest] });
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!data.name.trim()) newErrors.name = 'Please enter a name';
    if (data.age < 3 || data.age > 7) newErrors.age = 'Age must be between 3 and 7';
    if (data.interests.length === 0) newErrors.interests = 'Pick at least one interest';
    if (!data.story_mood) newErrors.story_mood = 'Please choose a story mood';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (validate()) {
      navigate('/create/theme');
    }
  }

  return (
    <div className="animate-fade-in-up">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-forest-100 mb-4">
          <User className="w-8 h-8 text-forest-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-gray-900 mb-3">
          Tell Us About Your Child
        </h1>
        <p className="text-lg text-gray-600 max-w-lg mx-auto">
          The more we know, the more magical and personal the story becomes.
        </p>
      </div>

      <div className="space-y-8 max-w-2xl mx-auto">
        {/* Name & Age */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Child's First Name
            </label>
            <input
              type="text"
              value={data.name}
              onChange={e => updateData({ name: e.target.value })}
              placeholder="e.g., Emma"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-500 focus:ring-0 outline-none transition-colors text-gray-900"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Age
            </label>
            <input
              type="number"
              min={3}
              max={7}
              value={data.age}
              onChange={e => updateData({ age: parseInt(e.target.value) || 5 })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-500 focus:ring-0 outline-none transition-colors text-gray-900"
            />
            {errors.age && <p className="text-red-500 text-sm mt-1">{errors.age}</p>}
          </div>
        </div>

        {/* Nickname */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            What nickname do you use for your child?
          </label>
          <input
            type="text"
            value={data.nickname}
            onChange={e => updateData({ nickname: e.target.value })}
            placeholder="e.g., Bug, Little Bear, Sunny"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-500 focus:ring-0 outline-none transition-colors text-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">Optional -- may appear in the story as a term of endearment</p>
        </div>

        {/* Interests */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            <Sparkles className="w-4 h-4 inline mr-1 text-brand-500" />
            Interests (pick up to 5)
          </label>
          <div className="flex flex-wrap gap-2">
            {interestOptions.map(interest => (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  data.interests.includes(interest)
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
          {errors.interests && <p className="text-red-500 text-sm mt-1">{errors.interests}</p>}
        </div>

        {/* Favorite Things & Toy */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Favorite Things (color, animal, food)
            </label>
            <input
              type="text"
              value={data.favorite_things}
              onChange={e => updateData({ favorite_things: e.target.value })}
              placeholder="e.g., Blue, Cats, Strawberries"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-500 focus:ring-0 outline-none transition-colors text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Favorite toy or comfort object?
            </label>
            <input
              type="text"
              value={data.favorite_toy}
              onChange={e => updateData({ favorite_toy: e.target.value })}
              placeholder="e.g., Stuffed bunny named Flopsy"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-500 focus:ring-0 outline-none transition-colors text-gray-900"
            />
          </div>
        </div>

        {/* Story Mood */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            What kind of story do you want?
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {storyMoodOptions.map(mood => (
              <button
                key={mood.value}
                onClick={() => updateData({ story_mood: mood.value })}
                className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  data.story_mood === mood.value
                    ? 'border-brand-500 bg-brand-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-gray-900 text-sm">{mood.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{mood.desc}</p>
              </button>
            ))}
          </div>
          {errors.story_mood && <p className="text-red-500 text-sm mt-1">{errors.story_mood}</p>}
        </div>

        {/* Family Phrase */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Any phrase your family says often?
          </label>
          <input
            type="text"
            value={data.family_phrase}
            onChange={e => updateData({ family_phrase: e.target.value })}
            placeholder="e.g., 'You can do hard things!' or 'Adventure awaits!'"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-500 focus:ring-0 outline-none transition-colors text-gray-900"
          />
          <p className="text-xs text-gray-400 mt-1">Optional -- may inspire the story's repeating refrain</p>
        </div>

        {/* Themes to Avoid */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Themes to Avoid
          </label>
          <input
            type="text"
            value={data.themes_to_avoid}
            onChange={e => updateData({ themes_to_avoid: e.target.value })}
            placeholder="e.g., Scary monsters, dark places"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-500 focus:ring-0 outline-none transition-colors text-gray-900"
          />
        </div>

        {/* Reading Level */}
        <div>
          <p className="text-sm font-semibold text-gray-700">
            Reading Level - <span className="font-normal text-gray-600">Short Sentences</span>
          </p>
        </div>
      </div>

      <div className="mt-8 flex justify-between max-w-2xl mx-auto">
        <button
          onClick={() => navigate('/create/photos')}
          className="inline-flex items-center px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </button>
        <button onClick={handleNext} className="btn-primary">
          Next: Choose Theme
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
}
