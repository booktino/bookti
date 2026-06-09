'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ReviewPage() {
  const params = useParams()
  const token = params.token as string
  const [review, setReview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'already' | 'error'>('idle')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('reviews')
        .select('*, salons(name)')
        .eq('token', token)
        .single()
      setReview(data)
      setLoading(false)
      if (data?.submitted_at) setStatus('already')
    }
    load()
  }, [token])

  async function handleSubmit() {
    if (rating === 0) return
    setSubmitting(true)
    const res = await fetch('/api/reviews/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, rating, comment }),
    })
    const data = await res.json()
    if (data.success) setStatus('success')
    else if (data.error === 'already_submitted') setStatus('already')
    else setStatus('error')
    setSubmitting(false)
  }

  if (loading) return <Screen icon="⏳" title="Laster..." subtitle="" />
  if (!review) return <Screen icon="❌" title="Ugyldig lenke" subtitle="Denne lenken finnes ikke." />
  if (status === 'already') return <Screen icon="✅" title="Allerede vurdert" subtitle="Du har allerede gitt tilbakemelding. Tusen takk!" />
  if (status === 'success') return (
    <div className="min-h-screen flex items-center justify-center bg-[#04342C] p-4">
      <div className="text-center text-white max-w-sm">
        <div className="text-7xl mb-6">
          {rating >= 5 ? '🤩' : rating >= 4 ? '😊' : rating >= 3 ? '😐' : '😕'}
        </div>
        <h1 className="text-3xl font-bold mb-3">Takk for tilbakemeldingen!</h1>
        <p className="text-[#5DCAA5] text-lg">
          {rating >= 4
            ? 'Vi er glade for at du hadde en god opplevelse!'
            : 'Vi setter pris på din ærlighet og vil forbedre oss.'}
        </p>
        <div className="mt-6 flex justify-center gap-1">
          {[1,2,3,4,5].map(s => (
            <span key={s} className={`text-3xl ${s <= rating ? 'opacity-100' : 'opacity-20'}`}>⭐</span>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#04342C] p-4">
      <div className="bg-[#0a4a38] rounded-2xl p-8 max-w-sm w-full text-white shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Hvordan var opplevelsen?</h1>
          <p className="text-[#5DCAA5] mt-2">
            {review.salons?.name} · {review.client_name}
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-8">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="text-5xl transition-transform hover:scale-110 active:scale-95"
            >
              <span className={star <= (hovered || rating) ? 'opacity-100' : 'opacity-20'}>
                ⭐
              </span>
            </button>
          ))}
        </div>

        {rating > 0 && (
          <div className="text-center mb-4 text-lg font-semibold text-[#5DCAA5]">
            {rating === 5 ? 'Fantastisk! 🤩' :
             rating === 4 ? 'Veldig bra! 😊' :
             rating === 3 ? 'Det var OK 😐' :
             rating === 2 ? 'Ikke så bra 😕' :
             'Dårlig opplevelse 😞'}
          </div>
        )}

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Legg til en kommentar (valgfritt)..."
          rows={3}
          className="w-full bg-[#04342C] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#5DCAA5] resize-none mb-4"
        />

        {status === 'error' && (
          <p className="text-red-400 text-sm text-center mb-3">Noe gikk galt. Prøv igjen.</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="w-full bg-[#0F6E56] hover:bg-[#5DCAA5] text-white font-bold py-4 rounded-xl transition-all text-lg disabled:opacity-30"
        >
          {submitting ? 'Sender...' : 'Send tilbakemelding ✓'}
        </button>
      </div>
    </div>
  )
}

function Screen({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#04342C]">
      <div className="text-center text-white p-8 max-w-md">
        <div className="text-6xl mb-6">{icon}</div>
        <h1 className="text-3xl font-bold mb-3">{title}</h1>
        <p className="text-[#5DCAA5] text-lg">{subtitle}</p>
      </div>
    </div>
  )
}
