import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { bidId, fanHandle, message, fanAvatarUrl, amountDollars } =
    await req.json()

  // Get creator_id for this user
  const { data: creator } = await supabaseAdmin
    .from('creators')
    .select('id')
    .eq('auth_user_id', user.id)
    .single()

  if (!creator) {
    return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
  }

  // Verify bid belongs to this creator
  const { data: bid } = await supabaseAdmin
    .from('bids')
    .select('id, stripe_payment_intent_id, amount_paid')
    .eq('id', bidId)
    .eq('creator_id', creator.id)
    .single()

  if (!bid) {
    return NextResponse.json({ error: 'Bid not found' }, { status: 404 })
  }

  // Only allow editing seed bids
  if (!bid.stripe_payment_intent_id?.startsWith('seed_')) {
    return NextResponse.json(
      { error: 'Cannot edit real fan bids' },
      { status: 403 }
    )
  }

  const amountCents = amountDollars
    ? Math.round(Number(amountDollars) * 100)
    : bid.amount_paid

  // Update bids table
  await supabaseAdmin
    .from('bids')
    .update({
      fan_handle: fanHandle,
      message,
      fan_avatar_url: fanAvatarUrl,
      amount_paid: amountCents,
    })
    .eq('id', bidId)

  // Update podium_spots table
  await supabaseAdmin
    .from('podium_spots')
    .update({
      fan_handle: fanHandle,
      message,
      fan_avatar_url: fanAvatarUrl,
      amount_paid: amountCents,
    })
    .eq('stripe_payment_intent_id', bid.stripe_payment_intent_id)
    .eq('creator_id', creator.id)

  // If amount changed, rebuild podium order
  if (amountDollars && amountCents !== bid.amount_paid) {
    await supabaseAdmin.rpc('process_bid_and_update_podium', {
      p_creator_id: creator.id,
      p_fan_handle: fanHandle,
      p_avatar: fanAvatarUrl ?? '',
      p_message: message ?? '',
      p_amount: amountCents,
      p_stripe_intent: bid.stripe_payment_intent_id,
    })
  }

  return NextResponse.json({ success: true })
}
