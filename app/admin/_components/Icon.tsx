/**
 * Small inline-SVG icon set for the admin area. One consistent style
 * (24px grid, 1.8 stroke, round caps) so nothing looks mixed-and-matched,
 * and no icon-library dependency. Icons are decorative by default
 * (aria-hidden) — every usage sits next to a visible text label.
 */
const PATHS = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z",
  bookings: "M8 4h8M9 2.5v3M15 2.5v3M5 6.5h14a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1ZM8 11h8M8 15h5",
  calendar: "M5 5.5h14a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1ZM4 10h16M8 3v4M16 3v4",
  truck: "M3 6.5h11V16H3zM14 9.5h3.5L21 13v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  crew: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.8c1.9.7 3.2 2.5 3.5 5.2",
  availability: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2M5.6 5.6l12.8 12.8",
  pricing: "M3.5 12.5 11.5 4.5H19.5V12.5L11.5 20.5 3.5 12.5ZM15.5 9.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.6 7.6 0 0 1-1.7 1l-.3 2h-4l-.3-2a7.6 7.6 0 0 1-1.7-1l-1.9.7-2-3.4 1.6-1.2a7.7 7.7 0 0 1 0-3L3 9.3l2-3.4 1.9.7a7.6 7.6 0 0 1 1.7-1l.3-2h4l.3 2a7.6 7.6 0 0 1 1.7 1l1.9-.7 2 3.4-1.6 1.2a7.7 7.7 0 0 1 0 3Z",
  signOut: "M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l-4-4 4-4M6 12h10",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  plus: "M12 5v14M5 12h14",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  alert: "M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  x: "M8 8l8 8M16 8l-8 8",
  dollar: "M12 3v18M16.5 7.5c-.7-1.3-2.3-2-4.5-2-2.6 0-4.3 1.2-4.3 3.1 0 4.6 9 2.3 9 6.8 0 1.9-1.8 3.1-4.7 3.1-2.3 0-4-.8-4.8-2.3",
  user: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c.8-4 3.9-6.5 8-6.5s7.2 2.5 8 6.5",
  mapPin: "M12 21s-7-6.1-7-11.5a7 7 0 1 1 14 0C19 14.9 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0",
  note: "M5 3.5h10l4 4V20a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 20V3.5ZM15 3.5V8h4M8.5 12.5h7M8.5 16h5",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  sync: "M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4",
  inbox: "M4 13.5 6.5 5h11L20 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.5ZM4 13.5h5a3 3 0 0 0 6 0h5",
  ban: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8",
  lock: "M6 10.5h12a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1ZM8 10.5V7a4 4 0 1 1 8 0v3.5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className, label }: { name: IconName; size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
