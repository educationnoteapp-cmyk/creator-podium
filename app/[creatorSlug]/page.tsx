import { supabase } from '@/lib/supabase';
import CreatorPodiumClient from './CreatorPodiumClient';

interface Props {
  params: { creatorSlug: string };
}

// Server Component: fetches initial data, passes to client for realtime updates.
export default async function CreatorPodiumPage({ params }: Props) {
  const { creatorSlug } = params;

  // Fetch creator by slug
  const { data: creator } = await supabase
    .from('creators')
    .select('*')
    .eq('slug', creatorSlug)
    .single();

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

  // Fetch the top 10 bids by amount (descending) — these determine the leaderboard positions.
  // Rank is derived from sort order: highest amount = position 1 (King).
  const { data: initialBids } = await supabase
    .from('bids')
    .select('*')
    .eq('creator_id', creator.id)
    .order('amount_paid', { ascending: false })
    .limit(10);

  return (
    <CreatorPodiumClient
      creator={creator}
      initialBids={initialBids ?? []}
    />
  );
}
