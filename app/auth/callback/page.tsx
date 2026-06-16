// app/auth/callback/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function AuthCallback() {
  const router = useRouter();
  const [message, setMessage] = useState('Processing your authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        setMessage(`Error: ${error.message}`);
        setTimeout(() => router.push('/'), 3000);
        return;
      }
      
      if (session) {
        setMessage('Email confirmed successfully! Redirecting to dashboard...');
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setMessage('Please verify your email. You can now sign in.');
        setTimeout(() => router.push('/'), 3000);
      }
    };
    
    handleCallback();
  }, [router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0A0E17',
      color: '#E6EDF3',
      fontFamily: "'Rajdhani', sans-serif",
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        background: 'rgba(0,255,200,0.05)',
        border: '1px solid rgba(0,255,200,0.2)',
        borderRadius: '16px',
      }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>📧</div>
        <h2 style={{ marginBottom: 10 }}>Email Verification</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}