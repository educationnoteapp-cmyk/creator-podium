import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get('creator_id')
  if (!creatorId) {
    return NextResponse.json({ error: 'Missing creator_id' }, { status: 400 })
  }

  // Fetch creator for min/max bid settings
  const { data: creator } = await supabaseAdmin
    .from('creators')
    .select('min_bid_dollars, max_bid_dollars')
    .eq('id', creatorId)
    .single()

  const { data: allBids, error } = await supabaseAdmin
    .from('bids')
    .select('*')
    .eq('creator_id', creatorId)
    .order('amount_paid', { ascending: false })

  if (error || !allBids || allBids.length === 0) {
    return NextResponse.json({
      bids: [],
      totalBids: 0,
      totalCents: 0,
      kingCents: 0,
      kingHandle: '',
      avgCents: 0,
      hasSeedData: false,
      seedBids: [],
      realFansOnPodium: 0,
      minBidDollars: creator?.min_bid_dollars ?? 5,
      maxBidDollars: creator?.max_bid_dollars ?? 50,
    })
  }

  // Filter out bids with empty fan_handle (guard against bad data)
  const validBids = allBids.filter(b => b.fan_handle && b.fan_handle.trim() !== '')
  const realBids = validBids.filter(b => b.is_seed !== true)

  // Bug 2 fix: all seed bids visible to dashboard (simple is_seed check)
  const seedBids = validBids.filter(b => b.is_seed === true)

  // Bug 1 fix: use allBids (not validBids) so seed bids with empty handles still count
  const activeBids = allBids.filter(b => !b.is_seed || b.is_active !== false)

  const realFansOnPodium = Math.min(realBids.length, 10)

  const totalBids = realBids.length
  const totalCents = realBids.reduce((s, b) => s + b.amount_paid, 0)
  const king = realBids.length > 0 ? realBids[0] : null
  const avgCents = totalBids > 0 ? Math.round(totalCents / totalBids) : 0

  return NextResponse.json({
    bids: activeBids.slice(0, 10),
    totalBids,
    totalCents,
    kingCents: king?.amount_paid ?? 0,
    kingHandle: king?.fan_handle ?? '',
    avgCents,
    hasSeedData: seedBids.length > 0,
    seedBids,
    realFansOnPodium,
    minBidDollars: creator?.min_bid_dollars ?? 5,
    maxBidDollars: creator?.max_bid_dollars ?? 50,
  })
}
