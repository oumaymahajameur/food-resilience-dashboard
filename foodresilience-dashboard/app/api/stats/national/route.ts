import { getSupabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('fact_resilience_scores')
    .select('resilience_score, dim_state(state_code, state_name)');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const scores = data.map((r: any) => r.resilience_score).filter(Boolean);
  const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
  const max = Math.max(...scores);
  const min = Math.min(...scores);

  return NextResponse.json({
    avg_score: Math.round(avg * 10) / 10,
    max_score: Math.round(max * 10) / 10,
    min_score: Math.round(min * 10) / 10,
    dispersion: Math.round((max - min) * 10) / 10,
    critical_count: scores.filter((s: number) => s < 50).length,
  });
}