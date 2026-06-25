import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        desk: "900px",
      },
      colors: {
        bg: "#16110d",
        surface: "#241c14",
        "surface-raised": "#2e251b",
        border: "#3f3429",
        "border-bubble": "#362c20",
        divider: "#2e251b",
        text: "#f1eadf",
        "text-bright": "#f4ecdf",
        "text-body": "#e9e2d6",
        muted: "#a89784",
        faint: "#6f6253",
        accent: "#d57b48",
        "accent-bright": "#e08a50",
        "on-accent": "#1c1208",
        correct: "#9bb265",
        wrong: "#d96a52",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        grotesk: ["Hanken Grotesk", "sans-serif"],
      },
      borderRadius: {
        card: "26px",
        bubble: "22px",
        input: "18px",
        pill: "999px",
      },
      keyframes: {
        pop: {
          "0%": { transform: "scale(0.7)", opacity: "0" },
          "60%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        dotpulse: {
          "0%, 80%, 100%": { opacity: "0.28", transform: "translateY(0)" },
          "40%": { opacity: "1", transform: "translateY(-3px)" },
        },
      },
      animation: {
        pop: "pop 0.3s ease-out",
        dotpulse: "dotpulse 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}

export default config
