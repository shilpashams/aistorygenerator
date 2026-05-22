import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles, Pencil, Image } from 'lucide-react';
import { useWizard } from '../../context/WizardContext';
import { supabase, getSessionId } from '../../lib/supabase';

const loadingMessages = [
  { icon: Sparkles, text: 'Understanding your child\'s personality...', duration: 3000 },
  { icon: Pencil, text: 'Crafting a unique storyline...', duration: 4000 },
  { icon: Image, text: 'Generating custom illustrations with AI...', duration: 5000 },
  { icon: BookOpen, text: 'Putting the finishing touches...', duration: 3000 },
];

async function uploadPhotos(photos: File[], sessionId: string): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos) {
    const ext = photo.name.split('.').pop() || 'jpg';
    const path = `${sessionId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('child-photos')
      .upload(path, photo, { contentType: photo.type });
    if (error) {
      console.error('Photo upload error:', error);
      continue;
    }
    const { data: urlData } = supabase.storage
      .from('child-photos')
      .getPublicUrl(path);
    urls.push(urlData.publicUrl);
  }
  return urls;
}

export function StoryGenerating() {
  const { data } = useWizard();
  const navigate = useNavigate();
  const [messageIndex, setMessageIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const hasStarted = useRef(false);
  const storyIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    async function generateStory() {
      try {
        const sessionId = getSessionId();

        const photoUrls = await uploadPhotos(data.photos, sessionId);

        const { data: profile, error: profileError } = await supabase
          .from('child_profiles')
          .insert({
            name: data.name,
            age: data.age,
            interests: data.interests,
            favorite_things: data.favorite_things,
            themes_to_avoid: data.themes_to_avoid,
            reading_level: data.reading_level,
            photo_urls: photoUrls,
            session_id: sessionId,
          })
          .select('id')
          .single();

        if (profileError) throw profileError;

        const { data: story, error: storyError } = await supabase
          .from('stories')
          .insert({
            child_profile_id: profile.id,
            theme: data.theme,
            illustration_style: data.illustration_style,
            status: 'pending',
          })
          .select('id')
          .single();

        if (storyError) throw storyError;
        storyIdRef.current = story.id;

        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-story`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            story_id: story.id,
            child_profile_id: profile.id,
            name: data.name,
            age: data.age,
            interests: data.interests,
            favorite_things: data.favorite_things,
            themes_to_avoid: data.themes_to_avoid,
            reading_level: data.reading_level,
            theme: data.theme,
            illustration_style: data.illustration_style,
            photo_urls: photoUrls,
            favorite_toy: data.favorite_toy,
            nickname: data.nickname,
            story_mood: data.story_mood,
            family_phrase: data.family_phrase,
          }),
        });

        if (!response.ok) {
          console.error('Edge function error:', response.status, await response.text().catch(() => ''));
        }

        pollForCompletion(story.id);
      } catch (err) {
        console.error('Story generation error:', err);
        if (storyIdRef.current) {
          pollForCompletion(storyIdRef.current);
        } else {
          navigate('/create/theme');
        }
      }
    }

    generateStory();
  }, []);

  function pollForCompletion(storyId: string) {
    const interval = setInterval(async () => {
      const { data: storyData } = await supabase
        .from('stories')
        .select('status')
        .eq('id', storyId)
        .maybeSingle();

      if (storyData?.status === 'complete') {
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => navigate(`/create/story/${storyId}`), 600);
      } else if (storyData?.status === 'failed') {
        clearInterval(interval);
        navigate(`/create/story/${storyId}`);
      }
    }, 2000);
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + 0.6;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, loadingMessages[messageIndex].duration);
    return () => clearTimeout(timeout);
  }, [messageIndex]);

  const CurrentIcon = loadingMessages[messageIndex].icon;

  return (
    <div className="animate-fade-in-up flex flex-col items-center justify-center min-h-[60vh]">
      <div className="relative mb-8">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-brand-100 to-ocean-100 flex items-center justify-center animate-pulse">
          <CurrentIcon className="w-16 h-16 text-brand-500 transition-all duration-500" />
        </div>
        <div className="absolute inset-0 w-32 h-32 rounded-full border-4 border-brand-200 border-t-brand-500 animate-spin" style={{ animationDuration: '3s' }} />
      </div>

      <h2 className="text-2xl sm:text-3xl font-display font-bold text-gray-900 mb-2 text-center">
        Creating {data.name ? `${data.name}'s` : 'Your'} Story
      </h2>

      <p className="text-lg text-gray-600 mb-8 transition-all duration-500 text-center">
        {loadingMessages[messageIndex].text}
      </p>

      <div className="w-full max-w-md">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-500 mt-2 text-center">
          {Math.round(progress)}% complete
        </p>
      </div>

      <div className="mt-12 grid grid-cols-3 gap-6 opacity-60">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="w-16 h-20 bg-sand-200 rounded-lg animate-pulse"
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}
      </div>
    </div>
  );
}
