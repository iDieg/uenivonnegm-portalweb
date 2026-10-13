// js/config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// URL base del proyecto y clave anónima pública
const SUPABASE_URL = 'https://hxkcenmcxlzlurstmybg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6_KQbXWCwg2d7VwyHrAjmg_bjyCjP5B';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const BUCKET_NAME = 'galeria-escolar';