import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
export async function GET(req: NextRequest) {
  const creatorId = req.nextUrl.searchParams.get('creator_id')
  if (!creatorId) return NextResponse.json({ error: 'Missing creator_id' }, { status: 400 })
  const { data: allBids } = await supabaseAdmin
    .from('bids')
    .select('*')
    .eq('creator_id', creatorId)
    .order('amount_paid', { ascending: false })
  if (!allBids || allBids.length === 0) {
    return NextResponse.json({
      bids: [], totalBids: 0, totalCents: 0,
      kingCents: 0, kingHandle: '', avgCents: 0, hasSeedData: false, seedBids: []
    })
  }
  const totalBids = allBids.length
  const totalCents = allBids.reduce((s, b) => s + b.amount_paid, 0)
  const king = allBids[0]
  const avgCents = Math.round(totalCents / totalBids)
  const hasSeedData = allBids.some(b => b.stripe_payment_intent_id?.startsWith('seed_'))
  const seedBids = allBids.filter(b => b.stripe_payment_intent_id?.startsWith('seed_'))
  const top10 = allBids.slice(0, 10)
  return NextResponse.json({
    bids: top10,
    totalBids,
    totalCents,
    kingCents: king.amount_paid,
    kingHandle: king.fan_handle,
    avgCents,
    hasSeedData,
    seedBids
  })
}
