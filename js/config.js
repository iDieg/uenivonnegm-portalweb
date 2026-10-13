// js/config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
  as5
const SUPABASE_URL = 'https://hxkcenmcxlzlurstmybg.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_6_KQbXWCwg2d7VwyHrAjmg_bjyCjP5B';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);