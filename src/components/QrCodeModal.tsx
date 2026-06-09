'use client'
import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

interface Props {
  isOpen: boolean
  onClose: () => void
  salonName: string
  slug: string
}

export default function QrCodeModal({ isOpen, onClose, salonName, slug }: Props) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  
  const url = `https://bookti.no/${slug}`

  if (!isOpen) return null

  function handleDownload() {
    const canvas = canvasRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `bookti-qr-${slug}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[#0D3B2E]">QR-kode for booking</h2>
          <button onClick={onClose} className="text-[#7A9A8E] hover:text-[#0D3B2E] text-xl">✕</button>
        </div>

        <div ref={canvasRef} className="flex justify-center mb-4 p-4 bg-white rounded-xl border border-[#C8E6D8]">
          <QRCodeCanvas
            value={url}
            size={200}
            bgColor="#ffffff"
            fgColor="#0F6E56"
            level="H"
            imageSettings={{
              src: "/favicon.ico",
              x: undefined,
              y: undefined,
              height: 30,
              width: 30,
              excavate: true,
            }}
          />
        </div>

        <p className="text-center text-xs text-[#7A9A8E] mb-6">{salonName}</p>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className="flex-1 border border-[#C8E6D8] text-[#0F6E56] font-semibold py-3 rounded-xl hover:bg-[#EFF8F4] transition-colors text-sm"
          >
            {copied ? '✓ Kopiert!' : '🔗 Kopier lenke'}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 bg-[#0F6E56] hover:bg-[#5DCAA5] text-white font-bold py-3 rounded-xl transition-colors text-sm"
          >
            ⬇ Last ned PNG
          </button>
        </div>

        <p className="text-center text-xs text-[#7A9A8E] mt-4">
          Skriv ut og heng opp i salongen
        </p>
      </div>
    </div>
  )
}
