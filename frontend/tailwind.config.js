/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        blue: {
          900: '#042C53',
          800: '#0C447C',
          600: '#185FA5',
          400: '#378ADD',
          100: '#B5D4F4',
          50: '#E6F1FB',
        },
        teal: {
          600: '#0F6E56',
          100: '#9FE1CB',
          50: '#E1F5EE',
        },
        purple: {
          600: '#534AB7',
          100: '#CECBF6',
          50: '#EEEDFE',
        },
        amber: {
          600: '#854F0B',
          100: '#FAC775',
          50: '#FAEEDA',
        },
        green: {
          600: '#3B6D11',
          50: '#EAF3DE',
        },
        coral: {
          600: '#993C1D',
          50: '#FAECE7',
        },
        red: {
          600: '#A32D2D',
          50: '#FCEBEB',
        },
        gray: {
          900: '#2C2C2A',
          700: '#444441',
          500: '#5F5E5A',
          300: '#B4B2A9',
          100: '#D3D1C7',
          50: '#F1EFE8',
        },
        page: '#F8F8F6',
      },
      fontFamily: {
        sans: ['Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
      },
      spacing: {
        sidebar: '220px',
      },
    },
  },
  plugins: [],
}
