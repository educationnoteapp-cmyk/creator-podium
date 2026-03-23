// POST /api/avatar/upload
//
// Accepts multipart form-data with a single "file" field.
// Uploads to Supabase Storage bucket "avatars" using the service-role key
// so the anon key's storage RLS doesn't block the upload.
// Returns { url: string } — the public URL of the uploaded avatar.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const STORAGE_URL =
  'https://fzeupxiivncgifbyxqjy.supabase.co/storage/v1/object/public/avatars/';

const MAX_FILE_BYTES    = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES     = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, and WebP images are allowed' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'File exceeds 2 MB limit' }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = `${crypto.randomUUID()}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer      = Buffer.from(arrayBuffer);

  const { data, error } = await supabaseAdmin.storage
    .from('avatars')
    .upload(filename, buffer, { contentType: file.type });

  if (error) {
    console.error('[avatar/upload] Storage error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const url = `${STORAGE_URL}${data.path}`;
  console.log('[avatar/upload] Uploaded:', url);
  return NextResponse.json({ url });
}
