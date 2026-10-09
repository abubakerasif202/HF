import { Fraunces, JetBrains_Mono, Manrope } from "next/font/google";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/components.css";
import "./styles/pages.css";

// Self-hosted at build time by next/font (no runtime request to Google), and
// only loaded for /admin so the public site's bundle is unchanged.
const display = Fraunces({ subsets: ["latin"], display: "swap", axes: ["opsz"], style: ["normal", "italic"], variable: "--admin-font-display" });
const ui = Manrope({ subsets: ["latin"], display: "swap", variable: "--admin-font-ui" });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--admin-font-mono" });

/**
 * Applies the saved theme / sidebar state before first paint so there is no
 * light-to-dark flash. Only touches two attributes on <html>; everything is
 * wrapped in try/catch because storage can be blocked.
 */
const PRE_PAINT = `(function(){try{var d=document.documentElement;var t=localStorage.getItem('hf-admin-theme');d.setAttribute('data-admin-theme',t==='dark'?'dark':'light');if(localStorage.getItem('hf-admin-nav')==='collapsed')d.setAttribute('data-admin-nav','collapsed');}catch(e){}})();`;

/**
 * Pass-through layout for every /admin/* route (including /admin/login).
 * Loads the design system and fonts; auth guarding stays in (protected)/layout.tsx.
 */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT }} />
      {children}
    </div>
  );
}
