import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get('creator_id')
  if (!creatorId) {
    return NextResponse.json({ error: 'Missing creator_id' }, { status: 400 })
  }

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

  const realBids = allBids.filter(b => !b.is_seed)
  const seedBids = allBids.filter(b => b.is_seed)
  const totalBids = realBids.length
  const totalCents = realBids.reduce((s, b) => s + b.amount_paid, 0)
  const king = realBids.length > 0 ? realBids[0] : null
  const avgCents = totalBids > 0 ? Math.round(totalCents / totalBids) : 0

  return NextResponse.json({
    bids: allBids.slice(0, 10),
    totalBids,
    totalCents,
    kingCents: king?.amount_paid ?? 0,
    kingHandle: king?.fan_handle ?? '',
    avgCents,
    hasSeedData: seedBids.length > 0,
    seedBids
  })
}
