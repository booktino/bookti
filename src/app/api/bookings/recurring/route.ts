import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTwilioSms } from '@/lib/notifications/twilio'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function getFrequencyDays(frequency: string): number {
  if (frequency === 'weekly') return 7
  if (frequency === 'biweekly') return 14
  return 30
}

function setTimeOnDate(date: Date, startTime: string): Date {
  const [hours, minutes] = startTime.split(':').map(Number)
  const d = new Date(date)
  d.setHours(hours, minutes, 0, 0)
  return d
}

function formatDisplayDate(date: Date): string {
  const dateStr = date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })
  const timeStr = date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} kl. ${timeStr}`
}

function hasConflict(
  plannedStart: Date,
  plannedEnd: Date,
  existing: { starts_at: string; ends_at: string }[],
): boolean {
  const newStart = plannedStart.getTime()
  const newEnd = plannedEnd.getTime()
  return existing.some((b) => {
    const bStart = new Date(b.starts_at).getTime()
    const bEnd = new Date(b.ends_at).getTime()
    return newStart < bEnd && newEnd > bStart
  })
}

function findAlternativeSlot(
  originalStart: Date,
  durationMs: number,
  startTime: string,
  existing: { starts_at: string; ends_at: string }[],
): Date | null {
  for (const offsetMin of [30, 60, 90, -30, -60, -90]) {
    const candidateStart = new Date(originalStart.getTime() + offsetMin * 60 * 1000)
    const candidateEnd = new Date(candidateStart.getTime() + durationMs)
    if (!hasConflict(candidateStart, candidateEnd, existing)) {
      return candidateStart
    }
  }

  const nextDayStart = setTimeOnDate(addDays(originalStart, 1), startTime)
  const nextDayEnd = new Date(nextDayStart.getTime() + durationMs)
  if (!hasConflict(nextDayStart, nextDayEnd, existing)) {
    return nextDayStart
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      booking_id,
      frequency,
      occurrences = 8,
      start_time,
    } = body

    if (!start_time || !/^\d{2}:\d{2}$/.test(start_time)) {
      return NextResponse.json({ error: 'Ugyldig tidspunkt' }, { status: 400 })
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('*, salons(name), services(name)')
      .eq('id', booking_id)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const days = getFrequencyDays(frequency)
    const durationMs =
      new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime()
    const bookingsToCreate = []
    let currentDate = new Date(booking.starts_at)

    for (let i = 1; i <= occurrences; i++) {
      currentDate = addDays(currentDate, days)
      const currentStart = setTimeOnDate(currentDate, start_time)
      const currentEnd = new Date(currentStart.getTime() + durationMs)

      bookingsToCreate.push({
        salon_id: booking.salon_id,
        staff_id: booking.staff_id,
        service_id: booking.service_id,
        client_name: booking.client_name,
        client_phone: booking.client_phone,
        client_email: booking.client_email,
        starts_at: currentStart.toISOString(),
        ends_at: currentEnd.toISOString(),
        price_nok: booking.price_nok,
        status: 'confirmed',
        sms_confirmation_sent: false,
        sms_reminder_sent: false,
      })
    }

    const minStart = bookingsToCreate[0].starts_at
    const maxEnd = bookingsToCreate[bookingsToCreate.length - 1].ends_at
    const queryMinStart = addDays(new Date(minStart), -1).toISOString()
    const queryMaxEnd = addDays(new Date(maxEnd), 1).toISOString()

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('starts_at, ends_at')
      .eq('staff_id', booking.staff_id)
      .neq('status', 'cancelled')
      .lt('starts_at', queryMaxEnd)
      .gt('ends_at', queryMinStart)

    const occupied = [...(existingBookings ?? [])]
    const toCreate: typeof bookingsToCreate = []
    const rescheduled: { original: string; new: string }[] = []

    for (const planned of bookingsToCreate) {
      const plannedStart = new Date(planned.starts_at)
      const plannedEnd = new Date(planned.ends_at)

      if (hasConflict(plannedStart, plannedEnd, occupied)) {
        const alternativeStart = findAlternativeSlot(
          plannedStart,
          durationMs,
          start_time,
          occupied,
        )
        if (!alternativeStart) continue

        const alternativeEnd = new Date(alternativeStart.getTime() + durationMs)
        const rescheduledBooking = {
          ...planned,
          starts_at: alternativeStart.toISOString(),
          ends_at: alternativeEnd.toISOString(),
        }
        toCreate.push(rescheduledBooking)
        occupied.push({
          starts_at: rescheduledBooking.starts_at,
          ends_at: rescheduledBooking.ends_at,
        })
        rescheduled.push({
          original: formatDisplayDate(plannedStart),
          new: formatDisplayDate(alternativeStart),
        })
      } else {
        toCreate.push(planned)
        occupied.push({ starts_at: planned.starts_at, ends_at: planned.ends_at })
      }
    }

    let createdCount = 0
    if (toCreate.length > 0) {
      const { data: created, error } = await supabase
        .from('bookings')
        .insert(toCreate)
        .select('id')

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      createdCount = created?.length ?? 0

      const salonName = (booking.salons as any)?.name || 'salonen'
      const serviceName = (booking.services as any)?.name || 'tjeneste'
      const freqText = frequency === 'weekly' ? 'hver uke' : frequency === 'biweekly' ? 'annenhver uke' : 'hver måned'
      const firstDate = new Date(toCreate[0].starts_at)
      const dateStr = firstDate.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
      const timeStr = firstDate.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })

      await sendTwilioSms({
        to: booking.client_phone,
        message: `Hei ${booking.client_name}! Vi har satt opp ${createdCount} faste timer for ${serviceName} hos ${salonName} ${freqText}, starter ${dateStr} kl. ${timeStr}. Vi gleder oss til å se deg! - ${salonName}`,
        bookingId: booking.id,
        salonId: booking.salon_id,
        type: 'confirmation',
      })
    }

    return NextResponse.json({ success: true, created: createdCount, rescheduled })
  } catch (err) {
    console.error('Recurring error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
