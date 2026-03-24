import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { bidId, fanHandle, message, fanAvatarUrl, amountDollars, isActive } =
    await req.json()

  // Get creator_id and bid limits for this user
  const { data: creator } = await supabaseAdmin
    .from('creators')
    .select('id, min_bid_dollars, max_bid_dollars')
    .eq('auth_user_id', user.id)
    .single()

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
  }

  // Verify bid belongs to this creator
  const { data: bid } = await supabaseAdmin
    .from('bids')
    .select('id, is_seed, stripe_payment_intent_id, amount_paid, fan_handle, fan_avatar_url, message')
    .eq('id', bidId)
    .eq('creator_id', creator.id)
    .single()

  if (!bid) {
    return NextResponse.json({ error: 'Bid not found' }, { status: 404 })
  }

  // Only allow editing seed bids
  if (!bid.is_seed) {
    return NextResponse.json(
      { error: 'Cannot edit real fan bids' },
      { status: 403 }
    )
  }

  // Bug 2 fix: handle deactivation BEFORE amount validation.
  // Toggling off a fan should always succeed even if the fan's amount is below the current
  // min_bid_dollars (which may have been raised after seeding).
  if (typeof isActive === 'boolean' && !isActive) {
    await supabaseAdmin.from('bids').update({ is_active: false }).eq('id', bidId)

    // Remove this fan from podium_spots, then rebuild from remaining active bids
    await supabaseAdmin
      .from('podium_spots')
      .delete()
      .eq('creator_id', creator.id)
      .eq('stripe_payment_intent_id', bid.stripe_payment_intent_id)

    const { data: activeBids } = await supabaseAdmin
      .from('bids')
      .select('*')
      .eq('creator_id', creator.id)
      .or('is_active.is.null,is_active.eq.true')
      .order('amount_paid', { ascending: false })
      .limit(10)

    await supabaseAdmin.from('podium_spots').delete().eq('creator_id', creator.id)
    if (activeBids && activeBids.length > 0) {
      await supabaseAdmin.from('podium_spots').insert(
        activeBids.map((b, idx) => ({
          creator_id: creator.id,
          position: idx + 1,
          fan_handle: b.fan_handle,
          fan_avatar_url: b.fan_avatar_url,
          message: b.message,
          amount_paid: b.amount_paid,
          stripe_payment_intent_id: b.stripe_payment_intent_id,
        }))
      )
    }
    return NextResponse.json({ success: true })
  }

  // Compute amountCents — multiply once only
  const amountCents = amountDollars
    ? Math.round(Number(amountDollars) * 100)
    : bid.amount_paid

  // Validate absolute bounds ($1–$500)
  if (amountCents < 100 || amountCents > 50000) {
    return NextResponse.json({ error: 'Amount must be $1–$500' }, { status: 400 })
  }

  // Validate against creator's configured min/max
  const minCents = (creator.min_bid_dollars ?? 1) * 100
  const maxCents = (creator.max_bid_dollars ?? 500) * 100

  if (amountCents < minCents) {
    return NextResponse.json(
      { error: `Amount must be at least $${creator.min_bid_dollars ?? 1}` },
      { status: 400 }
    )
  }
  if (amountCents > maxCents) {
    return NextResponse.json(
      { error: `Amount must be at most $${creator.max_bid_dollars ?? 500}` },
      { status: 400 }
    )
  }

  // Build update — include is_active=true if reactivating
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {
    fan_handle: fanHandle,
    message,
    fan_avatar_url: fanAvatarUrl,
    amount_paid: amountCents,
  }
  if (isActive === true) updateData.is_active = true

  // Bug 4: UPDATE bids BEFORE calling RPC (RPC reads from bids table)
  await supabaseAdmin.from('bids').update(updateData).eq('id', bidId)

  // Always call RPC to auto-reorder podium (handles field edits + reactivation)
  await supabaseAdmin.rpc('process_bid_and_update_podium', {
    p_creator_id: creator.id,
    p_fan_handle: fanHandle,
    p_avatar: fanAvatarUrl ?? '',
    p_message: message ?? '',
    p_amount: amountCents,
    p_stripe_intent: bid.stripe_payment_intent_id,
  })

  return NextResponse.json({ success: true })
}
