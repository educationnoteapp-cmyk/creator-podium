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
      minBidDollars: creator?.min_bid_dollars ?? 5,
      maxBidDollars: creator?.max_bid_dollars ?? 50,
    })
  }

  // Seeds are identified by the is_seed column
  // Also filter out any bids with empty fan_handle (guard against bad data)
  const isSeed = (b: { is_seed: boolean | null; fan_handle: string }) =>
    b.is_seed === true

  const validBids = allBids.filter(b => b.fan_handle && b.fan_handle.trim() !== '')
  const realBids = validBids.filter(b => !isSeed(b))
  const seedBids = validBids.filter(b => isSeed(b))

  const totalBids = realBids.length
  const totalCents = realBids.reduce((s, b) => s + b.amount_paid, 0)
  const king = realBids.length > 0 ? realBids[0] : null
  const avgCents = totalBids > 0 ? Math.round(totalCents / totalBids) : 0

  return NextResponse.json({
    bids: validBids.slice(0, 10),
    totalBids,
    totalCents,
    kingCents: king?.amount_paid ?? 0,
    kingHandle: king?.fan_handle ?? '',
    avgCents,
    hasSeedData: seedBids.length > 0,
    seedBids,
    minBidDollars: creator?.min_bid_dollars ?? 5,
    maxBidDollars: creator?.max_bid_dollars ?? 50,
  })
}
