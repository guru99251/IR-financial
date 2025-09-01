// src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anon) {
  console.warn('[Supabase] 환경변수(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)가 없습니다. 저장/공유 기능이 비활성화됩니다.');
}

export const supabase = createClient(url || 'https://irqvbemferrqxzbzhjwh.supabase.co', anon || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlycXZiZW1mZXJycXh6YnpoandoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2MzQzNjksImV4cCI6MjA3MjIxMDM2OX0.nZX_EGJ_6dFbmX7sO5Yp98_d4-HSfjLBUcd7H9b4xzo');
