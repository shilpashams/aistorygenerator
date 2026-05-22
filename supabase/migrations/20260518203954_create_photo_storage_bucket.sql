/*
  # Create photo storage bucket

  1. Storage
    - Create `child-photos` bucket for storing uploaded child photos
    - Bucket is public so the edge function can access photo URLs
  2. Security
    - Allow anonymous uploads (session-based app without auth)
    - Allow public read access for the edge function to fetch images
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('child-photos', 'child-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'child-photos');

CREATE POLICY "Anyone can read photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'child-photos');
