'use client';

// AvatarPicker.tsx — Avatar selector for bid forms.
//
// Two options:
//   A) Upload a photo  → uploads to Supabase Storage bucket "avatars"
//   B) Choose a preset → 8 DiceBear avataaars presets
//
// Default avatar auto-generated from fan handle via DiceBear.
// Shows a circular 48px preview with a camera button to open the modal.

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabaseBrowser } from '@/lib/supabase-browser';

const STORAGE_URL =
  'https://fzeupxiivncgifbyxqjy.supabase.co/storage/v1/object/public/avatars/';

const PRESET_SEEDS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

function dicebearUrl(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

interface AvatarPickerProps {
  /** Current fan handle — used to auto-generate the default avatar. */
  fanHandle: string;
  /** Currently selected avatar URL (null = use auto-generated default). */
  value: string | null;
  onChange: (url: string) => void;
}

export default function AvatarPicker({ fanHandle, value, onChange }: AvatarPickerProps) {
  const [isOpen, setIsOpen]         = useState(false);
  const [activeTab, setActiveTab]   = useState<'preset' | 'upload'>('preset');
  const [uploading, setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const defaultAvatar = dicebearUrl(fanHandle || 'fan');
  const displayAvatar = value || defaultAvatar;

  // ── File upload ──────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (file.size > MAX_FILE_BYTES) {
      setUploadError('File too large — max 2 MB');
      e.target.value = '';
      return;
    }

    // Show circular preview immediately while uploading
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    setUploading(true);

    try {
      const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename  = `${crypto.randomUUID()}-${safeName}`;

      const { data, error } = await supabaseBrowser.storage
        .from('avatars')
        .upload(filename, file, { contentType: file.type });

      if (error) {
        setUploadError(`Upload failed: ${error.message}`);
        setLocalPreview(null);
        return;
      }

      const publicUrl = `${STORAGE_URL}${data.path}`;
      onChange(publicUrl);
      setIsOpen(false);
      setLocalPreview(null);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(objectUrl);
      e.target.value = '';
    }
  };

  // ── Preset select ────────────────────────────────────────────────────────
  const handlePreset = (seed: string) => {
    onChange(dicebearUrl(seed));
    setIsOpen(false);
  };

  return (
    <>
      {/* ── Circular preview + camera badge ─────────────────────────────── */}
      <div className="relative flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayAvatar}
          alt="Your avatar"
          className="w-12 h-12 rounded-full object-cover border-2 border-slate-700 bg-slate-800"
        />
        <button
          type="button"
          onClick={() => { setIsOpen(true); setUploadError(null); }}
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full
                     bg-indigo-600 hover:bg-indigo-500 border border-slate-900
                     flex items-center justify-center transition-colors"
          title="Change avatar"
        >
          <span className="text-[10px] leading-none">📷</span>
        </button>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              className="relative bg-slate-900 border border-slate-700 rounded-2xl p-5
                         w-full max-w-sm z-10 shadow-2xl"
              initial={{ y: 48, scale: 0.96, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 48, scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">Choose Your Avatar</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center
                             text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4 bg-slate-950/60 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('preset')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors
                    ${activeTab === 'preset'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'}`}
                >
                  Choose Avatar
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors
                    ${activeTab === 'upload'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'}`}
                >
                  Upload Photo
                </button>
              </div>

              {/* ── Preset grid ───────────────────────────────────────── */}
              {activeTab === 'preset' && (
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_SEEDS.map((seed) => {
                    const url = dicebearUrl(seed);
                    const selected = value === url;
                    return (
                      <button
                        key={seed}
                        type="button"
                        onClick={() => handlePreset(seed)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition-all
                          ${selected
                            ? 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)] scale-105'
                            : 'border-slate-700 hover:border-indigo-500 hover:scale-105'}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Avatar option ${seed}`}
                          className="w-full h-full bg-slate-800"
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Upload tab ────────────────────────────────────────── */}
              {activeTab === 'upload' && (
                <div className="space-y-3">
                  {/* Preview */}
                  {localPreview && (
                    <div className="flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={localPreview}
                        alt="Preview"
                        className="w-20 h-20 rounded-full object-cover border-2 border-indigo-500"
                      />
                    </div>
                  )}

                  {/* Error */}
                  {uploadError && (
                    <p className="text-xs text-red-400 text-center bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2">
                      {uploadError}
                    </p>
                  )}

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {/* Upload button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full py-4 rounded-xl border-2 border-dashed border-slate-700
                               hover:border-indigo-500/70 text-slate-400 hover:text-indigo-400
                               text-sm font-medium transition-all disabled:opacity-50
                               flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-slate-600 border-t-white rounded-full animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      '📷  Choose Photo'
                    )}
                  </button>

                  <p className="text-[10px] text-slate-600 text-center">
                    JPEG · PNG · WebP &nbsp;·&nbsp; Max 2 MB
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
