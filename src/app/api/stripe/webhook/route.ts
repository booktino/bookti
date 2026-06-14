import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const salonId = (event.data.object as any)?.metadata?.salon_id

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && salonId) {
        await supabase.from('salons').update({
          subscription_status: 'active',
          subscription_id: session.subscription as string,
          plan: 'pro',
        }).eq('id', salonId)
      }
      break
    }
    case 'invoice.payment_failed':
    case 'customer.subscription.deleted': {
      if (salonId) {
        await supabase.from('salons').update({
          subscription_status: 'inactive',
          plan: 'trial',
        }).eq('id', salonId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
