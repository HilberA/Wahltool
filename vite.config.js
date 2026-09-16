import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Vite-Konfiguration. Die PWA-Einstellungen (Name, Farben, Icons) hier zentral anpassen.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Abstimmungstool',
        short_name: 'Abstimmung',
        description: 'Anonyme Abstimmungen für Gruppen – erstellen, teilnehmen, auswerten.',
        theme_color: '#1C2333',
        background_color: '#F6F4EE',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Ergebnis-/Admin-Seiten brauchen immer frische Daten -> nicht aggressiv cachen.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin.includes('firestore.googleapis.com'),
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ]
})
