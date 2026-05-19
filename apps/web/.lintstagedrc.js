export default {
  "*.{js,jsx,ts,tsx,mjs,cjs,md,mdx,html}": (files) => [
    `oxlint --fix --no-error-on-unmatched-pattern ${files.join(" ")}`,
    `oxfmt --no-error-on-unmatched-pattern ${files.join(" ")}`,
  ],
  "*.{ts,tsx}": "bun run doctor",
};
