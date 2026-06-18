import { NextResponse } from 'next/server';
import { sendNewEmail } from '@/lib/gmail/send';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get('user_id')?.value;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body } = await req.json();

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const result = await sendNewEmail(userId, to, subject, body);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error sending new email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
