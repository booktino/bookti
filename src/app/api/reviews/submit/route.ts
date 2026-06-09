import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { token, rating, comment } = await request.json()

    if (!token || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    const { data: review } = await supabase
      .from('reviews')
      .select('*')
      .eq('token', token)
      .single()

    if (!review) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 404 })
    }

    if (review.submitted_at) {
      return NextResponse.json({ error: 'already_submitted' }, { status: 409 })
    }

    await supabase
      .from('reviews')
      .update({
        rating,
        comment: comment?.trim() || null,
        submitted_at: new Date().toISOString(),
      })
      .eq('token', token)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Review submit error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
