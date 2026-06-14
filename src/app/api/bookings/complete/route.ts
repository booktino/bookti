import { NextResponse } from 'next/server'
import {
  ensureInvoicesForBookings,
  getServiceSupabase,
} from '@/lib/invoicing/ensure-invoice'

const supabase = getServiceSupabase()

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('status', 'confirmed')
    .lt('ends_at', new Date().toISOString())
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const completedIds = (data ?? []).map((row) => row.id)
  let invoicesEnsured = 0
  let invoicesFailed = 0

  if (completedIds.length > 0) {
    const invoiceResult = await ensureInvoicesForBookings(supabase, completedIds)
    invoicesEnsured = invoiceResult.ensured
    invoicesFailed = invoiceResult.failed
  }

  return NextResponse.json({
    success: true,
    completed: completedIds.length,
    invoices_ensured: invoicesEnsured,
    invoices_failed: invoicesFailed,
  })
}
