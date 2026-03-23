// /api/moderate — checks a fan's message against OpenAI's Moderation API.
//
// Called by the BidButton client before proceeding to /api/checkout.
// If the message is flagged (hate, violence, sexual, etc.), the bid is
// blocked and the fan sees "Message not allowed" with a reason.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import OpenAI from 'openai';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import type { ModerationResult } from '@/types';

// Validate env at import time — throws clearly if anything is missing
void env;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? 'placeholder-openai-key' });

// Human-readable labels for OpenAI moderation categories
const CATEGORY_LABELS: Record<string, string> = {
  hate:                        'hate speech',
  'hate/threatening':          'threatening hate speech',
  harassment:                  'harassment',
  'harassment/threatening':    'threatening harassment',
  'self-harm':                 'self-harm content',
  'self-harm/intent':          'self-harm intent',
  'self-harm/instructions':    'self-harm instructions',
  sexual:                      'sexual content',
  'sexual/minors':             'sexual content involving minors',
  violence:                    'violent content',
  'violence/graphic':          'graphic violence',
};

// ── Zod schema ───────────────────────────────────────────────────────────────
const ModerateSchema = z.object({
  message: z.string().min(1).max(500),
});

export async function POST(req: NextRequest) {
  // ── Rate limit: 10 requests per IP per minute ────────────────────────────
  const ip = getClientIp(req.headers);
  const rl = await rateLimit(`moderate:${ip}`, 10, 10_000);
  if (!rl.success) {
    return NextResponse.json(
      { allowed: false, reason: 'Too many requests. Please slow down.' } satisfies ModerationResult,
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    );
  }

  try {
    // ── Zod validation ──────────────────────────────────────────────────────
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ allowed: true } satisfies ModerationResult);
    }

    const parsed = ModerateSchema.safeParse(rawBody);
    if (!parsed.success) {
      // Empty or missing message — nothing to moderate, allow through
      return NextResponse.json({ allowed: true } satisfies ModerationResult);
    }

    const { message } = parsed.data;

    const moderation = await openai.moderations.create({ input: message });
    const result = moderation.results[0];

    if (result.flagged) {
      // Find the first flagged category to give the fan a reason
      const flaggedCategory = Object.entries(result.categories).find(([, flagged]) => flagged);
      const reason = flaggedCategory
        ? `Message contains ${CATEGORY_LABELS[flaggedCategory[0]] ?? flaggedCategory[0]}`
        : 'Message was flagged by our content filter';

      return NextResponse.json({ allowed: false, reason } satisfies ModerationResult);
    }

    return NextResponse.json({ allowed: true } satisfies ModerationResult);

  } catch (error) {
    console.error('Moderation API error:', error);
    // Fail open — if the moderation API is down, allow the message through
    // rather than blocking all bids.
    return NextResponse.json({ allowed: true } satisfies ModerationResult);
  }
}
