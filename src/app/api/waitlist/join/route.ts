import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { salon_id, service_id, staff_id, starts_at, ends_at, client_name, client_phone } = body

    if (!salon_id || !starts_at || !ends_at || !client_name || !client_phone) {
      return NextResponse.json({ error: 'Manglende felter' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('waitlist')
      .select('id')
      .eq('salon_id', salon_id)
      .eq('staff_id', staff_id)
      .eq('starts_at', starts_at)
      .eq('client_phone', client_phone)
      .eq('status', 'waiting')
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Du er allerede på ventelisten' }, { status: 409 })
    }

    const { data, error } = await supabase
      .from('waitlist')
      .insert({ salon_id, service_id, staff_id, starts_at, ends_at, client_name, client_phone })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
