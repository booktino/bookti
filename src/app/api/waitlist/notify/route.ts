import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function POST(request: NextRequest) {
  try {
    const { booking_id } = await request.json()

    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const { data: entry } = await supabase
      .from('waitlist')
      .select('*')
      .eq('salon_id', booking.salon_id)
      .eq('staff_id', booking.staff_id)
      .eq('starts_at', booking.starts_at)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!entry) {
      return NextResponse.json({ success: true, notified: false })
    }

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bookti.no'

    await supabase
      .from('waitlist')
      .update({ status: 'notified', notified_at: new Date().toISOString(), expires_at: expiresAt })
      .eq('id', entry.id)

    const { data: salon } = await supabase
      .from('salons')
      .select('name')
      .eq('id', booking.salon_id)
      .single()

    const date = new Date(entry.starts_at)
    const dateStr = date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
    const timeStr = date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
    const confirmUrl = `${appUrl}/waitlist/confirm/${entry.token}`

    await twilioClient.messages.create({
      body: `Hei ${entry.client_name}! En time hos ${salon?.name || 'salonen'} ${dateStr} kl. ${timeStr} er ledig. Bekreft innen 2 timer: ${confirmUrl}`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: entry.client_phone,
    })

    return NextResponse.json({ success: true, notified: true })
  } catch (err) {
    console.error('Notify error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
