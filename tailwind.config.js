/** Workout Tracker design tokens as a Tailwind theme. Generated from tokens.py. */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      "colors": {
        "bg": "#0B0C0E",
        "surface": "#15171A",
        "raised": "#1E2125",
        "border": {
          "DEFAULT": "#2A2E33",
          "strong": "#6E747B"
        },
        "ink": {
          "DEFAULT": "#F5F6F7",
          "2": "#A4A9B0",
          "3": "#6B7077"
        },
        "accent": {
          "DEFAULT": "#C6F432",
          "pressed": "#AED61E",
          "subtle": "rgba(198,244,50,0.14)",
          "on": "#0B0C0E"
        },
        "success": {
          "DEFAULT": "#34D399",
          "subtle": "rgba(52,211,153,0.14)"
        },
        "warning": {
          "DEFAULT": "#FFB224",
          "subtle": "rgba(255,178,36,0.14)"
        },
        "danger": {
          "DEFAULT": "#FF6B5E",
          "subtle": "rgba(255,107,94,0.14)"
        },
        "info": {
          "DEFAULT": "#6CB6FF",
          "subtle": "rgba(108,182,255,0.14)"
        },
        "scrim": "rgba(0,0,0,0.6)"
      },
      "fontFamily": {
        "display": [
          "Archivo",
          "Arial Narrow",
          "system-ui",
          "sans-serif"
        ],
        "body": [
          "Figtree",
          "-apple-system",
          "Helvetica Neue",
          "system-ui",
          "sans-serif"
        ]
      },
      "fontSize": {
        "display": [
          "2.5rem",
          {
            "lineHeight": "2.75rem",
            "fontWeight": "800"
          }
        ],
        "title": [
          "1.75rem",
          {
            "lineHeight": "2rem",
            "fontWeight": "800"
          }
        ],
        "heading": [
          "1.25rem",
          {
            "lineHeight": "1.625rem",
            "fontWeight": "700"
          }
        ],
        "body": [
          "1rem",
          {
            "lineHeight": "1.5rem",
            "fontWeight": "500"
          }
        ],
        "body-small": [
          "0.875rem",
          {
            "lineHeight": "1.25rem",
            "fontWeight": "500"
          }
        ],
        "caption": [
          "0.8125rem",
          {
            "lineHeight": "1rem",
            "fontWeight": "700",
            "letterSpacing": "0.08em"
          }
        ],
        "number-xl": [
          "4rem",
          {
            "lineHeight": "4rem",
            "fontWeight": "800"
          }
        ],
        "number-l": [
          "3rem",
          {
            "lineHeight": "3.25rem",
            "fontWeight": "800"
          }
        ],
        "number-m": [
          "2rem",
          {
            "lineHeight": "2.25rem",
            "fontWeight": "800"
          }
        ]
      },
      "spacing": {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "12": "48px",
        "tap": "48px",
        "control": "56px",
        "cta": "60px"
      },
      "borderRadius": {
        "sm": "12px",
        "md": "20px",
        "lg": "28px",
        "full": "999px"
      },
      "boxShadow": {
        "pop": "0 8px 24px rgba(0, 0, 0, 0.45)"
      },
      "transitionDuration": {
        "press": "120ms",
        "base": "200ms",
        "celebrate": "400ms"
      },
      "transitionTimingFunction": {
        "out": "cubic-bezier(0.2, 0.8, 0.2, 1)",
        "in": "cubic-bezier(0.4, 0, 1, 1)"
      }
    }
  },
  plugins: [],
};
