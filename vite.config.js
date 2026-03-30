import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        academy: resolve(__dirname, 'academy/index.html'),
        homeacademy: resolve(__dirname, 'homeacademy/index.html'),
        uda: resolve(__dirname, 'uda/index.html'),
        whiteboard: resolve(__dirname, 'whiteboard/index.html'),
        'math-panel': resolve(__dirname, 'math-panel/index.html'),
        conceptmap: resolve(__dirname, 'concept-map/index.html'),
        ped: resolve(__dirname, 'ped/index.html'),
		pde: resolve(__dirname, 'pde/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
        streamath: resolve(__dirname, 'streamath/index.html'),
      }
    }
  },
  server: {
    proxy: {},
    historyApiFallback: {
      rewrites: [
        { from: /^\/streamath\/.*/, to: '/streamath/index.html' },
        { from: /^\/board\/.*/, to: '/whiteboard/index.html' },
      ]
    }
  }
})