import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTwilioSms } from '@/lib/notifications/twilio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { booking_id } = await request.json()

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, salon_id, client_phone, client_name, starts_at, salons(name)')
      .eq('id', booking_id)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Oznacz booking jako no-show
    await supabase
      .from('bookings')
      .update({ no_show: true, status: 'cancelled' })
      .eq('id', booking_id)

    // Policz no-show dla tego klienta w tym salonie
    const { count } = await supabase
      .from('bookings')
      .select('id', { count: 'exact' })
      .eq('salon_id', booking.salon_id)
      .eq('client_phone', booking.client_phone)
      .eq('no_show', true)

    const noShowCount = count ?? 0

    if (noShowCount === 1 && booking.client_phone) {
      const date = new Date(booking.starts_at)
      const dateStr = date.toLocaleDateString('nb-NO')
      const timeStr = date.toLocaleTimeString('nb-NO')
      const salonName = (booking.salons as { name?: string } | null)?.name ?? 'salongen'

      const message = `Hei ${booking.client_name}! Det er synd at du ikke kunne møte opp til timen din hos ${salonName} ${dateStr} kl. ${timeStr}. Vi håper alt er bra med deg! Husk å avbestille i god tid neste gang, så andre kunder kan få timen. Vi sees snart 😊 - ${salonName}`

      await sendTwilioSms({
        to: booking.client_phone,
        message,
        bookingId: booking.id,
        salonId: booking.salon_id,
        type: 'custom',
      })
    }

    // Zablokuj po 2 no-show
    if (noShowCount >= 2) {
      await supabase
        .from('blocked_clients')
        .upsert({
          salon_id: booking.salon_id,
          client_phone: booking.client_phone,
          client_name: booking.client_name,
          no_show_count: noShowCount,
        }, { onConflict: 'salon_id,client_phone' })

      return NextResponse.json({ success: true, blocked: true, no_show_count: noShowCount })
    }

    return NextResponse.json({ success: true, blocked: false, no_show_count: noShowCount })
  } catch (err) {
    console.error('No-show error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
