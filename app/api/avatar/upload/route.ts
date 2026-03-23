// POST /api/avatar/upload
//
// Accepts multipart form-data with a single "file" field.
// Uploads to Supabase Storage bucket "avatars" using supabaseAdmin (service role)
// so the anon key's storage RLS doesn't block the upload.
// Returns { url: string } — the public URL of the uploaded avatar.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES  = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  console.log('[avatar/upload] POST called');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('[avatar/upload] file:', file.name, file.type, file.size, 'bytes');

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, and WebP images are allowed' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 2 MB limit' }, { status: 400 });
    }

    const buffer   = Buffer.from(await file.arrayBuffer());
    const filename = `${crypto.randomUUID()}-${file.name}`;

    console.log('[avatar/upload] Uploading to Supabase Storage:', filename);

    const { data, error } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filename, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error('[avatar/upload] Storage error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const url = `https://fzeupxiivncgifbyxqjy.supabase.co/storage/v1/object/public/avatars/${data.path}`;
    console.log('[avatar/upload] Success:', url);
    return NextResponse.json({ url });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    console.error('[avatar/upload] Unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
