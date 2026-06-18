'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function logout() {
  const cs = await cookies();
  cs.delete('user_id');
  redirect('/');
}
