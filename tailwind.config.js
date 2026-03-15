/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Command center palette
        void: '#0a0a0f',
        carbon: '#12121a',
        slate: '#1a1a24',
        steel: '#2a2a38',
        silver: '#8888a0',
        ghost: '#b8b8c8',
        ice: '#e8e8f0',
        // Status colors - distinctive, not cliched
        active: '#00e5a0',      // Mint green - active/running
        waiting: '#e879f9',     // Fuchsia - needs human input
        pending: '#ffc857',     // Amber - waiting/pending
        complete: '#7c8aff',    // Periwinkle - completed
        error: '#ff6b8a',       // Coral pink - error
        idle: '#4a4a5a',        // Dim - idle
        // Provider brand colors
        claude: '#d4a574',      // Warm terracotta/tan - Anthropic
        gemini: '#4285f4',      // Google blue
      },
      fontFamily: {
        display: ['JetBrains Mono', 'Fira Code', 'monospace'],
        body: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 4s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { opacity: '0.5' },
          '100%': { opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
}
