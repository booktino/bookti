'use client'
import { useState } from 'react'

interface Props {
  isOpen: boolean
  onClose: () => void
  salonId: string
  serviceId: string
  staffId: string
  startsAt: string
  endsAt: string
  salonName: string
  dateStr: string
  timeStr: string
}

export default function WaitlistModal({ isOpen, onClose, salonId, serviceId, staffId, startsAt, endsAt, salonName, dateStr, timeStr }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  async function handleSubmit() {
    if (!name.trim() || !phone.trim()) { setError('Fyll inn navn og telefonnummer'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/waitlist/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salon_id: salonId, service_id: serviceId, staff_id: staffId, starts_at: startsAt, ends_at: endsAt, client_name: name, client_phone: phone }),
      })
      const data = await res.json()
      if (data.success) setSuccess(true)
      else setError(data.error || 'Noe gikk galt')
    } catch { setError('Noe gikk galt. Prøv igjen.') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#0a4a38] rounded-2xl p-6 max-w-sm w-full text-white shadow-2xl">
        {success ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-4">🔔</div>
            <h2 className="text-xl font-bold mb-2">Du er på ventelisten!</h2>
            <p className="text-[#5DCAA5] text-sm">Du får en SMS så snart {dateStr} kl. {timeStr} blir ledig.</p>
            <button onClick={onClose} className="mt-6 w-full bg-[#0F6E56] hover:bg-[#5DCAA5] font-bold py-3 rounded-xl transition-colors">Lukk</button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-bold mb-1">Bli varslet når timen er ledig</h2>
            <p className="text-white/50 text-sm mb-5">{dateStr} kl. {timeStr} · {salonName}</p>
            <div className="space-y-3 mb-4">
              <input type="text" placeholder="Ditt navn" value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-[#04342C] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#5DCAA5]" />
              <input type="tel" placeholder="Telefon (+47 xxx xx xxx)" value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full bg-[#04342C] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#5DCAA5]" />
            </div>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-white/20 text-white/50 hover:text-white py-3 rounded-xl transition-colors text-sm">Avbryt</button>
              <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-[#0F6E56] hover:bg-[#5DCAA5] font-bold py-3 rounded-xl transition-colors disabled:opacity-50">
                {loading ? '...' : 'Meld meg på 🔔'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
