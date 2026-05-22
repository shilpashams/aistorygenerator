export interface ChildProfile {
  id?: string;
  name: string;
  age: number;
  interests: string[];
  favorite_things: string;
  themes_to_avoid: string;
  reading_level: string;
  photo_urls: string[];
  session_id: string;
}

export interface Story {
  id?: string;
  child_profile_id: string;
  title: string;
  theme: string;
  illustration_style: string;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  page_count: number;
  created_at?: string;
}

export interface StoryPage {
  id?: string;
  story_id: string;
  page_number: number;
  text_content: string;
  illustration_url: string;
}

export interface WizardData {
  photos: File[];
  photoPreviewUrls: string[];
  name: string;
  age: number;
  interests: string[];
  favorite_things: string;
  themes_to_avoid: string;
  reading_level: string;
  theme: string;
  illustration_style: string;
  favorite_toy: string;
  nickname: string;
  proud_of: string;
  currently_learning: string;
  story_mood: string;
  family_phrase: string;
}
