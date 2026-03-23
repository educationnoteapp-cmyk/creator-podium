// POST /api/admin/set-plan — sets a creator's plan_type from the admin panel.
//
// The creators table has "own-row update only" RLS, so the admin browser client
// cannot update other creators' rows. This route uses supabaseAdmin to bypass RLS.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_PLANS = ['founding', 'pro', 'starter', 'trial'] as const;
type PlanType = typeof VALID_PLANS[number];

function isAdmin(email: string): boolean {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';
  return Boolean(adminEmail) && email === adminEmail;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !isAdmin(session.user.email ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { creatorId?: unknown; planType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { creatorId, planType } = body;

  if (typeof creatorId !== 'string' || !creatorId) {
    return NextResponse.json({ error: 'creatorId is required' }, { status: 400 });
  }
  if (!VALID_PLANS.includes(planType as PlanType)) {
    return NextResponse.json({ error: `planType must be one of: ${VALID_PLANS.join(', ')}` }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('creators')
    .update({ plan_type: planType })
    .eq('id', creatorId);

  if (error) {
    console.error('Failed to update plan_type:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, creatorId, planType });
}
