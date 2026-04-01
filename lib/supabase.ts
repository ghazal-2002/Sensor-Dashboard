import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://sikbcbchttynfeaudnbp.supabase.co"
const supabaseKey = "sb_publishable_q4Hs2yyg8udZKifoqd3m4w_sWPz0vTM"

export const supabase = createClient(supabaseUrl, supabaseKey)

