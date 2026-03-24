import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get('creator_id')
  if (!creatorId) {
    return NextResponse.json({ error: 'Missing creator_id' }, { status: 400 })
  }

  // Fetch ALL bids (no limit) for correct analytics
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
      seedBids: []
    })
  }

  // Compute analytics from ALL bids (raw cents, NO division by 100)
  const totalBids = allBids.length
  const totalCents = allBids.reduce((sum, b) => sum + b.amount_paid, 0)
  const king = allBids[0] // already sorted DESC
  const avgCents = Math.round(totalCents / totalBids)
  const hasSeedData = allBids.some(b =>
    b.stripe_payment_intent_id?.startsWith('seed_')
  )
  const seedBids = allBids.filter(b =>
    b.stripe_payment_intent_id?.startsWith('seed_')
  )
  const top10 = allBids.slice(0, 10)

  return NextResponse.json({
    bids: top10,          // for podium display
    totalBids,            // total count ALL bids
    totalCents,           // raw cents, NO division
    kingCents: king.amount_paid,   // raw cents
    kingHandle: king.fan_handle,
    avgCents,             // raw cents
    hasSeedData,
    seedBids              // all seed_ bids for editing
  })
}
