import { supabaseAdmin } from '@/lib/supabase';
import CreatorPodiumClient from './CreatorPodiumClient';

export const dynamic = 'force-dynamic';

interface Props {
  params: { creatorSlug: string };
}

// Server Component: fetches initial data, passes to client for realtime updates.
// Uses supabaseAdmin (service role) so that public podium pages bypass RLS —
// the bids table has no anonymous SELECT policy by design.
export default async function CreatorPodiumPage({ params }: Props) {
  const { creatorSlug } = params;
  console.log('[podium] Fetching creator for slug:', creatorSlug);

  // Fetch creator by slug (admin client bypasses RLS)
  const { data: creator, error: creatorError } = await supabaseAdmin
    .from('creators')
    .select('*')
    .eq('slug', creatorSlug)
    .single();

  if (creatorError) {
    console.error('[podium] Creator fetch error:', creatorError.message);
  }

  console.log('[podium] Creator result:', creator?.id ?? 'NOT FOUND');

  if (!creator) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Creator not found</h1>
          <p className="text-slate-400">No podium exists for &ldquo;{creatorSlug}&rdquo;</p>
        </div>
      </div>
    );
  }

  // Fetch the top 10 bids by amount (descending) — determines leaderboard positions.
  // supabaseAdmin bypasses RLS so this works for anonymous visitors.
  const { data: initialBids, error: bidsError } = await supabaseAdmin
    .from('bids')
    .select('*')
    .eq('creator_id', creator.id)
    .order('amount_paid', { ascending: false })
    .limit(10);

  if (bidsError) {
    console.error('[podium] Bids fetch error:', bidsError.message);
  }

  console.log('[podium] Fetched', initialBids?.length ?? 0, 'bids for creator:', creator.id);

  return (
    <CreatorPodiumClient
      creator={creator}
      initialBids={initialBids ?? []}
    />
  );
}
