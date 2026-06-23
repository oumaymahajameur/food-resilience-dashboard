import { getSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('dim_state')
    .select(`
      state_id,
      state_code,
      state_name,
      region,
      division,
      population_2020,
      area_sq_miles,
      fact_resilience_scores (
        cpi_score,
        access_score,
        transit_score,
        econ_score,
        resilience_score
      )
    `);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}