import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    const { data: entry } = await supabase
      .from('waitlist')
      .select('*')
      .eq('token', token)
      .single()

    if (!entry) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 404 })
    }

    if (entry.status === 'booked') {
      return NextResponse.json({ error: 'already_booked' }, { status: 409 })
    }

    if (entry.status === 'expired' || (entry.expires_at && new Date(entry.expires_at) < new Date())) {
      await supabase.from('waitlist').update({ status: 'expired' }).eq('id', entry.id)
      return NextResponse.json({ error: 'expired' }, { status: 410 })
    }

    const { data: conflicts } = await supabase
      .from('bookings')
      .select('id')
      .eq('staff_id', entry.staff_id)
      .eq('starts_at', entry.starts_at)
      .neq('status', 'cancelled')

    if (conflicts && conflicts.length > 0) {
      await supabase.from('waitlist').update({ status: 'expired' }).eq('id', entry.id)
      return NextResponse.json({ error: 'slot_taken' }, { status: 409 })
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        salon_id: entry.salon_id,
        service_id: entry.service_id,
        staff_id: entry.staff_id,
        starts_at: entry.starts_at,
        ends_at: entry.ends_at,
        client_name: entry.client_name,
        client_phone: entry.client_phone,
        status: 'confirmed',
        sms_confirmation_sent: false,
      })
      .select()
      .single()

    if (bookingError) {
      return NextResponse.json({ error: 'booking_failed' }, { status: 500 })
    }

    await Promise.all([
      supabase.from('waitlist').update({ status: 'booked' }).eq('id', entry.id),
      supabase.from('waitlist').update({ status: 'expired' })
        .eq('salon_id', entry.salon_id)
        .eq('staff_id', entry.staff_id)
        .eq('starts_at', entry.starts_at)
        .eq('status', 'waiting'),
    ])

    return NextResponse.json({ success: true, booking_id: booking.id })
  } catch (err) {
    console.error('Confirm error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
