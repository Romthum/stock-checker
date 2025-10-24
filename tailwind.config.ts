
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // ✅ คุมโหมดมืดด้วย class="dark"
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
}
export default config
