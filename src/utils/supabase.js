import { createBrowserClient } from '@supabase/ssr'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createBrowserClient(url ?? '', key ?? '')
