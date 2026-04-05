/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0c0c1d',
          dim: '#0c0c1d',
          bright: '#2a2a43',
          container: '#18182b',
          'container-high': '#1d1d33',
          'container-highest': '#24233b',
          'container-low': '#121223',
          variant: '#24233b'
        },
        primary: {
          DEFAULT: '#8b5cf6',
          dim: '#7e51ff',
          container: '#a98fff',
          light: '#b6a0ff'
        },
        secondary: {
          DEFAULT: '#06b6d4',
          dim: '#00d4ec',
          container: '#006875'
        },
        accent: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ff6e84',
        'on-surface': '#e6e3fb',
        'on-surface-variant': '#aba9bf'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #7e51ff, #00d4ec)',
        'gradient-hero': 'linear-gradient(135deg, #0c0c1d 0%, #1a1040 50%, #0c0c1d 100%)'
      }
    }
  },
  plugins: []
};
