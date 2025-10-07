import type { Config } from "tailwindcss";
import mainConfig from "../tailwind.config";

export default {
  ...mainConfig,
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
} satisfies Config;
