import { getSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('prediction_scores')
    .select('*, dim_state(state_code)')
    .order('prediction_year', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}