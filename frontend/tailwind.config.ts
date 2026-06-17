import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        teal: {
          50: "#eefcfd",
          100: "#ccf7f9",
          200: "#99f0f5",
          300: "#5de4ed",
          400: "#2dcfe0",
          500: "#14b4c7",
          600: "#0d9ea8",
          700: "#0f7f8a",
          800: "#126572",
          900: "#145460",
          950: "#06333d"
        },
        slate: {
          50: "#f2f2f7",
          100: "#e5e5ea",
          200: "#d1d1d6",
          300: "#c7c7cc",
          400: "#aeaeb2",
          500: "#8e8e93",
          600: "#636366",
          700: "#48484a",
          800: "#3a3a3c",
          900: "#2c2c2e"
        },
        glass: {
          light: "rgba(255,255,255,0.72)",
          "light-subtle": "rgba(255,255,255,0.56)",
          "light-heavy": "rgba(255,255,255,0.85)",
          dark: "rgba(28,28,30,0.72)",
          "dark-subtle": "rgba(28,28,30,0.56)",
          "dark-heavy": "rgba(28,28,30,0.85)",
          border: "rgba(255,255,255,0.24)",
          "border-subtle": "rgba(255,255,255,0.12)",
          tint: "rgba(13,158,168,0.08)",
          "tint-hover": "rgba(13,158,168,0.15)"
        },
        coral: {
          500: "#f97316",
          600: "#ea580c"
        }
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "San Francisco", "Segoe UI", "Roboto", "Inter", "sans-serif"]
      },
      borderRadius: {
        glass: "14px",
        "glass-sm": "10px",
        "glass-lg": "20px",
        "glass-xl": "28px",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        xl: "1rem",
        "2xl": "1.5rem"
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(0, 0, 0, 0.08), 0 4px 16px -4px rgba(0, 0, 0, 0.04)",
        glass: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        "glass-hover": "0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)",
        "glass-elevated": "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
        "glass-inset": "inset 0 1px 0 rgba(255,255,255,0.18)",
        card: "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)"
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        "glass-shimmer": "glassShimmer 3s ease-in-out infinite",
        "tab-morph": "tabMorph 0.45s cubic-bezier(0.34, 1.56, 0.64, 1.0)",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s infinite linear"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        glassShimmer: {
          "0%": { opacity: "0.4" },
          "50%": { opacity: "0.7" },
          "100%": { opacity: "0.4" }
        },
        tabMorph: {
          "0%": { transform: "scaleX(1)" },
          "50%": { transform: "scaleX(1.4)" },
          "100%": { transform: "scaleX(1)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      }
    }
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")]
};

export default config;
