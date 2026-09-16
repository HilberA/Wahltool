import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

// Rendert clientseitig einen QR-Code (kein externer Dienst, funktioniert offline).
export default function QrCode({ value, size = 220 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#1c2333', light: '#fffefb' }
    }).catch((err) => console.error('QR-Code konnte nicht gerendert werden', err))
  }, [value, size])

  return <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: '3px' }} />
}
