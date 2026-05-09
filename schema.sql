-- Run this in your Supabase SQL Editor

-- Create the shares table
CREATE TABLE public.shares (
    id UUID PRIMARY KEY,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    size INT8 NOT NULL,
    content_type TEXT,
    password_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) if you plan on accessing it directly from the client.
-- Since we are mostly using the Service Role Key via our backend proxy, no policies are strictly necessary here, 
-- but disabling it completely is not recommended in public.
-- ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- Create the private_files bucket if it doesn't exist yet
INSERT INTO storage.buckets (id, name, public) 
VALUES ('private_files', 'private_files', false)
ON CONFLICT (id) DO NOTHING;

-- Set up basic storage policy for the private_files bucket to allow TUS uploads
-- Adjust policies to your security needs, these allow anonymous uploads for the app to work:
CREATE POLICY "Allow anonymous uploads to private_files" 
ON storage.objects FOR INSERT 
TO public
WITH CHECK ( bucket_id = 'private_files' );

CREATE POLICY "Allow anonymous selects from private_files" 
ON storage.objects FOR SELECT 
TO public
USING ( bucket_id = 'private_files' );

CREATE POLICY "Allow anonymous updates to private_files" 
ON storage.objects FOR UPDATE 
TO public
USING ( bucket_id = 'private_files' );
