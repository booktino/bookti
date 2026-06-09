import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import twilio from 'twilio'

export async function POST(request: NextRequest) {
  try {
    const { booking_id } = await request.json()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('id, salon_id, client_name, client_phone')
      .eq('id', booking_id)
      .single()

    if (error || !booking) {
      console.error('Booking error:', error)
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('booking_id', booking_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ success: true, already_sent: true })
    }

    const { data: review } = await supabase
      .from('reviews')
      .insert({
        booking_id,
        salon_id: booking.salon_id,
        rating: 0,
        client_name: booking.client_name,
      })
      .select()
      .single()

    if (!review) {
      return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
    }

    const { data: salon } = await supabase
      .from('salons')
      .select('name')
      .eq('id', booking.salon_id)
      .single()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bookti.no'
    const reviewUrl = `${appUrl}/ocena/${review.token}`
    const salonName = salon?.name || 'salonen'

    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )

    await twilioClient.messages.create({
      body: `Hei ${booking.client_name}! Takk for besøket hos ${salonName} 🙏 Hvor fornøyd var du? Gi oss tilbakemelding (10 sek): ${reviewUrl}`,
      from: process.env.TWILIO_PHONE_FROM!,
      to: booking.client_phone,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Review request error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
