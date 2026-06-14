import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTwilioSms } from '@/lib/notifications/twilio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000)

    // Znajdź wizyty za 24-25h które nie dostały jeszcze przypomnienia
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*, salons(name, cancellation_allowed)')
      .eq('status', 'confirmed')
      .eq('sms_reminder_sent', false)
      .gte('starts_at', in24h.toISOString())
      .lte('starts_at', in25h.toISOString())

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ success: true, sent: 0 })
    }

    let sent = 0

    for (const booking of bookings) {
      const date = new Date(booking.starts_at)
      const dateStr = date.toLocaleDateString('nb-NO', {
        weekday: 'long', day: 'numeric', month: 'long'
      })
      const timeStr = date.toLocaleTimeString('nb-NO', {
        hour: '2-digit', minute: '2-digit'
      })

      const salonName = (booking.salons as any)?.name || 'salongen'
      const cancelAllowed = (booking.salons as any)?.cancellation_allowed

      let message = `Hei ${booking.client_name}! Påminnelse: Du har time hos ${salonName} ${dateStr} kl. ${timeStr}.`

      if (cancelAllowed) {
        const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cancel/${booking.id}`
        message += ` Avbestill her: ${cancelUrl}`
      }

      message += ` - Bookti`

      const result = await sendTwilioSms({
        to: booking.client_phone,
        message,
        bookingId: booking.id,
        salonId: booking.salon_id,
        type: 'reminder',
      })

      if (result.success) {
        await supabase
          .from('bookings')
          .update({ sms_reminder_sent: true })
          .eq('id', booking.id)
        sent++
      }
    }

    return NextResponse.json({ success: true, sent })
  } catch (err) {
    console.error('Reminder error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
