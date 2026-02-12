-- Migration 018: Create Supabase Storage buckets for chat audio and images
-- These buckets store audio recordings and images sent through the chat widget.
-- Public read access; writes are done via the service role key from the backend.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('chat-audio', 'chat-audio', true, 5242880, ARRAY['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav']),
  ('chat-images', 'chat-images', true, 2097152, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Public read policies
CREATE POLICY "Public read chat-audio" ON storage.objects FOR SELECT USING (bucket_id = 'chat-audio');
CREATE POLICY "Public read chat-images" ON storage.objects FOR SELECT USING (bucket_id = 'chat-images');

-- Service role write policies (backend uploads)
CREATE POLICY "Service insert chat-audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-audio');
CREATE POLICY "Service insert chat-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-images');
