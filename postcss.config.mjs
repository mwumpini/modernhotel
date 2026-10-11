// Tailwind writes colours as oklch()/oklab()/lab(), which Chrome and Edge before 111 cannot read —
// and 109 is the last version on Windows 7/8/8.1, where those colours simply vanished.
// The two plugins after Tailwind rewrite them as plain rgb(), which every browser understands.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "@csstools/postcss-oklab-function": { preserve: false },
    "postcss-lab-function": { preserve: false },
  },
};

export default config;
