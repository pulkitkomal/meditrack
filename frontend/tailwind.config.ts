import type { Config } from "tailwindcss";
import defaultColors from "tailwindcss/colors";
import plugin from "tailwindcss/plugin";

// Every palette below is emitted as CSS variables with a light and a dark value, so existing
// utility classes (bg-red-50, text-slate-800, ...) switch theme without per-component dark: variants.
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;
type Palette = Record<(typeof SHADES)[number], string>;

const TEAL: Palette = {
  50: "#eefcfd", 100: "#ccf7f9", 200: "#99f0f5", 300: "#5de4ed", 400: "#2dcfe0", 500: "#14b4c7",
  600: "#0d9ea8", 700: "#0f7f8a", 800: "#126572", 900: "#145460", 950: "#06333d"
};
const SLATE: Palette = {
  50: "#f2f2f7", 100: "#e5e5ea", 200: "#d1d1d6", 300: "#c7c7cc", 400: "#aeaeb2", 500: "#8e8e93",
  600: "#636366", 700: "#48484a", 800: "#3a3a3c", 900: "#2c2c2e", 950: "#1c1c1e"
};
const SLATE_DARK: Palette = {
  50: "#101012", 100: "#232326", 200: "#36363a", 300: "#48484c", 400: "#6e6e73", 500: "#98989d",
  600: "#aeaeb2", 700: "#c7c7cc", 800: "#e5e5ea", 900: "#f2f2f7", 950: "#ffffff"
};
const DARK_BG = "#1c1c1e";
const ACCENTS = ["red", "emerald", "amber", "blue", "purple", "cyan", "orange", "green", "yellow", "rose", "pink", "indigo", "violet", "sky", "lime", "fuchsia"] as const;

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const channels = (hex: string) => hexToRgb(hex).join(" ");
const mix = (hex: string, base: string, amount: number) => {
  const a = hexToRgb(hex);
  const b = hexToRgb(base);
  return a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount))).join(" ");
};

// Dark mode: pale tints become dim washes of the hue, dark text shades become light ones.
const darkAccent = (p: Palette): Record<string, string> => ({
  50: mix(p[500], DARK_BG, 0.14), 100: mix(p[500], DARK_BG, 0.22), 200: mix(p[500], DARK_BG, 0.34),
  300: mix(p[400], DARK_BG, 0.7), 400: channels(p[400]), 500: channels(p[500]), 600: channels(p[500]),
  700: channels(p[400]), 800: channels(p[300]), 900: channels(p[200]), 950: channels(p[100])
});

const palettes: Record<string, { light: Palette; dark: Record<string, string> }> = {
  slate: { light: SLATE, dark: Object.fromEntries(SHADES.map(s => [s, channels(SLATE_DARK[s])])) },
  teal: { light: TEAL, dark: darkAccent(TEAL) },
  ...Object.fromEntries(ACCENTS.map(name => {
    const p = (defaultColors as unknown as Record<string, Palette>)[name];
    return [name, { light: p, dark: darkAccent(p) }];
  }))
};

const themedColors = Object.fromEntries(Object.keys(palettes).map(name => [
  name,
  Object.fromEntries(SHADES.map(s => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]))
]));

const themeVariables = plugin(({ addBase }) => {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};
  for (const [name, { light: l, dark: d }] of Object.entries(palettes)) {
    for (const s of SHADES) {
      light[`--c-${name}-${s}`] = channels(l[s]);
      dark[`--c-${name}-${s}`] = d[s];
    }
  }
  addBase({
    ":root": { ...light, "--surface": "255 255 255", "--glass-rgb": "255 255 255", "--glass-border": "rgba(255,255,255,0.24)", "--glass-border-subtle": "rgba(255,255,255,0.12)", colorScheme: "light" },
    ".dark": { ...dark, "--surface": "36 36 39", "--glass-rgb": "40 40 43", "--glass-border": "rgba(255,255,255,0.08)", "--glass-border-subtle": "rgba(255,255,255,0.05)", colorScheme: "dark" }
  });
});

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
        ...themedColors,
        gray: themedColors.slate,
        surface: "rgb(var(--surface) / <alpha-value>)",
        glass: {
          light: "rgb(var(--glass-rgb) / 0.72)",
          "light-subtle": "rgb(var(--glass-rgb) / 0.56)",
          "light-heavy": "rgb(var(--glass-rgb) / 0.85)",
          dark: "rgba(28,28,30,0.72)",
          "dark-subtle": "rgba(28,28,30,0.56)",
          "dark-heavy": "rgba(28,28,30,0.85)",
          border: "var(--glass-border)",
          "border-subtle": "var(--glass-border-subtle)",
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
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography"), themeVariables]
};

export default config;
