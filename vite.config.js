import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/Workout-tracker/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('@supabase'))   return 'supabase'
          if (id.includes('date-fns'))    return 'datefns'
          if (id.includes('node_modules')) return 'vendor'
        },
      },
    },
  },
})
