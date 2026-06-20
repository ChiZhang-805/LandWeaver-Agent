import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}", "./store/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        field: "#f7f8fa",
        line: "#d8dee6",
        teal: "#0f766e",
        amber: "#b7791f",
        rose: "#be123c"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(23, 32, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

