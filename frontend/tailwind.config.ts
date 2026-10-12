import type { Config } from "tailwindcss";

/**
 * Design tokens for Deep Dive's warm editorial system.
 * Tailwind v4 also mirrors these in app/globals.css via @theme.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F5F3EE",
        surface: "#FDFCF9",
        border: "#E0DDD6",
        "border-strong": "#C8C5BC",
        "text-primary": "#1A1A1A",
        "text-secondary": "#6B6B6B",
        "text-muted": "#B0A898",
        success: "#2D7A5E",
        "chip-bg": "#EDE9E2",
        connector: "#DDD9D0",
        offer: "#F0EDE6",
        summary: "#F7F4EE",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.8)" },
        },
        "chat-scan": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        "chat-scan": "chat-scan 1.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
