import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        chalk: {
          DEFAULT: "#F5F4F0",
          2: "#EAE8E3",
          3: "#D4D1CA"
        },
        ink: {
          DEFAULT: "#1A1A1A",
          2: "#3A3A3A",
          3: "#6B6B6B"
        },
        cobalt: {
          DEFAULT: "#1D4ED8",
          2: "#1E40AF",
          light: "#3B82F6"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans:    ["var(--font-sans)", "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)", "Courier New", "monospace"]
      },
      boxShadow: {
        "brutal":    "4px 4px 0 #1A1A1A",
        "brutal-sm": "2px 2px 0 #1A1A1A",
        "brutal-lg": "6px 6px 0 #1A1A1A",
        "cobalt":    "4px 4px 0 #1D4ED8",
        "cobalt-sm": "2px 2px 0 #1D4ED8"
      }
    }
  },
  plugins: []
};

export default config;
