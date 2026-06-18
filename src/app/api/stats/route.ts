import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { count: categorizedCount } = await supabase
      .from('threads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('category', 'is', null);

    const { count: totalThreads } = await supabase
      .from('threads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return NextResponse.json({ 
      categorized: categorizedCount || 0,
      total: totalThreads || 0
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
