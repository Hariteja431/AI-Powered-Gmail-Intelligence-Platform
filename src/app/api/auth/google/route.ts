import { getAuthUrl } from '@/lib/gmail/oauth';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
