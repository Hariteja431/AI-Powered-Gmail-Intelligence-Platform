import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Dashboard from '@/components/Dashboard';

export default async function Home() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('user_id')?.value;
  
  let user = null;
  if (userId) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase.from('users').select('email, created_at').eq('id', userId).single();
    user = data;
  }

  async function logout() {
    'use server';
    const cs = await cookies();
    cs.delete('user_id');
    redirect('/');
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-white text-gray-900 flex flex-col font-sans">
      {user ? (
        <>
          {/* Top Navbar */}
          <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 bg-white shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3">
              {/* Logo removed as requested */}
            </div>
            
            {/* Search Placeholder */}
            <div className="flex-1 max-w-3xl px-8 hidden md:block">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <input type="text" className="block w-full pl-11 pr-4 py-2.5 border-transparent rounded-full bg-gray-100 text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all" placeholder="Search emails (coming soon...)" readOnly />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-sm font-medium text-gray-600 hidden sm:block">{user.email}</div>
              <form action={logout}>
                <button type="submit" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-semibold">
                  Sign Out
                </button>
              </form>
            </div>
          </header>
          
          {/* Main App Area */}
          <main className="flex-1 flex overflow-hidden bg-gray-50">
            <Dashboard user={user} />
          </main>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full bg-gray-50 p-8">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 border border-gray-100">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center tracking-tight">Welcome</h1>
            <p className="text-gray-500 text-center mb-8">Connect your Gmail to enable AI-powered summaries, smart digests, and intelligent replies.</p>
            <Link 
              href="/api/auth/google" 
              className="inline-flex items-center justify-center w-full bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50 font-medium py-3 px-4 rounded-xl shadow-sm transition-all"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Connect with Google
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
