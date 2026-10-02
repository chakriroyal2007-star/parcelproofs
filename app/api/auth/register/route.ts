import { NextResponse } from 'next/server';
import { registerUser, encodeSession } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { email, password, name, role } = await request.json();
    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const user = registerUser(email, password, name, role);
    if (!user) {
      return NextResponse.json({ error: 'Failed to register or user already exists' }, { status: 401 });
    }

    const token = encodeSession(user);
    const cookieStore = await cookies();
    cookieStore.set('parcelproof_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
