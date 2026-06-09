'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function WaitlistConfirmPage() {
  const params = useParams()
  const token = params.token as string
  const [entry, setEntry] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'expired' | 'error'>('idle')

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('waitlist')
        .select('*, salons(name), services(name), staff(name)')
        .eq('token', token)
        .single()
      setEntry(data)
      setLoading(false)
      if (data?.status === 'booked') setStatus('success')
      if (data?.status === 'expired') setStatus('expired')
      if (data?.expires_at && new Date(data.expires_at) < new Date()) setStatus('expired')
    }
    load()
  }, [token])

  async function handleConfirm() {
    setConfirming(true)
    const res = await fetch('/api/waitlist/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (data.success) setStatus('success')
    else if (data.error === 'expired' || data.error === 'slot_taken') setStatus('expired')
    else setStatus('error')
    setConfirming(false)
  }

  if (loading) return <Screen icon="⏳" title="Laster..." subtitle="" />
  if (!entry) return <Screen icon="❌" title="Ugyldig lenke" subtitle="Denne lenken finnes ikke." />
  if (status === 'success') return <Screen icon="✅" title="Time bekreftet!" subtitle={`Timen din hos ${entry.salons?.name} er booket.`} />
  if (status === 'expired') return <Screen icon="⏰" title="Tilbudet er utløpt" subtitle="Beklager, timen ble tatt av noen andre." />

  const date = new Date(entry.starts_at)
  const dateStr = date.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })
  const timeStr = date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
  const expiresStr = entry.expires_at
    ? new Date(entry.expires_at).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#04342C] p-4">
      <div className="bg-[#0a4a38] rounded-2xl p-8 max-w-md w-full text-white shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold">En time er ledig!</h1>
          <p className="text-[#5DCAA5] mt-2">Hei {entry.client_name}!</p>
        </div>
        <div className="bg-[#04342C]/60 rounded-xl p-4 mb-6 space-y-3 text-sm">
          {[['Salong', entry.salons?.name], ['Tjeneste', entry.services?.name], ['Dato', dateStr], ['Tid', timeStr]]
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-white/50">{label}</span>
                <span className="font-medium capitalize">{value}</span>
              </div>
            ))}
        </div>
        {expiresStr && <p className="text-center text-amber-400 text-sm mb-4">⚠️ Tilbudet utløper kl. {expiresStr}</p>}
        {status === 'error' && <p className="text-red-400 text-sm text-center mb-4">Noe gikk galt. Prøv igjen.</p>}
        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="w-full bg-[#0F6E56] hover:bg-[#5DCAA5] text-white font-bold py-4 rounded-xl transition-all text-lg disabled:opacity-50"
        >
          {confirming ? 'Bekrefter...' : 'Bekreft time ✓'}
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
