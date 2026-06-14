import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { salon_id, client_phone } = await request.json()

    const phone = client_phone.replace(/\D/g, '')

    const { data: blocked } = await supabase
      .from('blocked_clients')
      .select('id')
      .eq('salon_id', salon_id)
      .ilike('client_phone', `%${phone}%`)
      .maybeSingle()

    return NextResponse.json({ blocked: !!blocked })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
