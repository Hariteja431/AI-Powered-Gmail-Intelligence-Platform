import { getTokensFromCode, getUserInfo } from '@/lib/gmail/oauth';
import { encrypt } from '@/lib/encryption';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=NoCode', request.url));
  }

  try {
    const tokens = await getTokensFromCode(code);
    if (!tokens.access_token) throw new Error('No access token received');

    const userInfo = await getUserInfo(tokens.access_token);
    if (!userInfo.email) throw new Error('No email found in user info');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
    const expiryDate = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', userInfo.email)
      .single();

    if (existingUser) {
      await supabase
        .from('users')
        .update({
          google_access_token: encryptedAccessToken,
          ...(encryptedRefreshToken && { google_refresh_token: encryptedRefreshToken }),
          token_expiry: expiryDate,
        })
        .eq('id', existingUser.id);
        
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.set('user_id', existingUser.id, { path: '/' });
      return response;
    } else {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: userInfo.email,
          google_access_token: encryptedAccessToken,
          google_refresh_token: encryptedRefreshToken,
          token_expiry: expiryDate,
        })
        .select()
        .single();
        
      if (error) throw error;
      
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.set('user_id', newUser.id, { path: '/' });
      return response;
    }
  } catch (error: any) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.redirect(new URL('/?error=OAuthFailed', request.url));
  }
}
