import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// التحقق من وجود القيم قبل الاتصال لتجنب الخطأ
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Key is missing in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)