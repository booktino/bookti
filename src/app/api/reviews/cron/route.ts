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
    const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000)
    const ninetyMinAgo = new Date(now.getTime() - 90 * 60 * 1000)

    // Wizyty zakończone 30-90 minut temu bez oceny
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, salon_id, client_name, client_phone, salons(name)')
      .eq('status', 'confirmed')
      .gte('ends_at', ninetyMinAgo.toISOString())
      .lte('ends_at', thirtyMinAgo.toISOString())

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ success: true, sent: 0 })
    }

    // Wyklucz te które już mają ocenę
    const bookingIds = bookings.map(b => b.id)
    const { data: existingReviews } = await supabase
      .from('reviews')
      .select('booking_id')
      .in('booking_id', bookingIds)

    const reviewedIds = new Set(existingReviews?.map(r => r.booking_id) ?? [])
    const toReview = bookings.filter(b => !reviewedIds.has(b.id))

    let sent = 0
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bookti.no'

    for (const booking of toReview) {
      // Utwórz rekord oceny z tokenem
      const { data: review } = await supabase
        .from('reviews')
        .insert({
          booking_id: booking.id,
          salon_id: booking.salon_id,
          rating: 0,
          client_name: booking.client_name,
        })
        .select()
        .single()

      if (!review) continue

      const salonName = (booking.salons as any)?.name || 'salonen'
      const reviewUrl = `${appUrl}/ocena/${review.token}`

      const result = await sendTwilioSms({
        to: booking.client_phone,
        message: `Hei ${booking.client_name}! Takk for besøket hos ${salonName} 🙏 Hvor fornøyd var du? Gi oss tilbakemelding (10 sek): ${reviewUrl}`,
        bookingId: booking.id,
        salonId: booking.salon_id,
        type: 'reminder',
      })

      if (result.success) sent++
    }

    return NextResponse.json({ success: true, sent })
  } catch (err) {
    console.error('Review cron error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
