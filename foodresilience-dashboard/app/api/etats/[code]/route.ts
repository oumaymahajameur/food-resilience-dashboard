import { getSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('dim_state')
    .select('*, fact_resilience_scores(cpi_score, access_score, transit_score, econ_score, resilience_score)')
    .ilike('state_code', params.code)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}