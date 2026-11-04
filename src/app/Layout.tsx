import { Link, NavLink, Outlet } from 'react-router';
import { buttonClass } from '../components/ui';

const NAV = [
  { to: '/', label: 'Today', icon: TodayIcon, end: true },
  { to: '/overview', label: 'Overview', icon: GridIcon, end: false },
  { to: '/settings', label: 'Settings', icon: GearIcon, end: false },
];

export function Layout() {
  return (
    <div className="min-h-dvh md:flex">
      {/* Tablet / desktop: side rail */}
      <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-line bg-surface p-3 md:flex lg:w-56">
        <Link to="/" className="mb-6 flex items-center gap-2 px-2 pt-2 font-semibold">
          <img src="./favicon.svg" alt="" className="h-7 w-7" />
          <span className="hidden lg:inline">Habit Tracker</span>
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs lg:flex-row lg:gap-3 lg:text-sm ${
                  isActive ? 'bg-surface-2 font-semibold text-fg' : 'text-muted hover:bg-surface-2'
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/habits/new"
          className={`${buttonClass('primary')} mt-6 px-2 lg:px-4`}
          title="New habit (n)"
        >
          <span aria-hidden className="text-lg leading-none">
            +
          </span>
          <span className="hidden lg:inline">New habit</span>
          <span className="sr-only lg:hidden">New habit</span>
        </Link>
      </aside>

      <main className="mx-auto w-full min-w-0 max-w-5xl md:flex-1 px-4 pt-4 pb-28 sm:px-6 md:pt-8 md:pb-10">
        <Outlet />
      </main>

      {/* Phone: bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                isActive ? 'font-semibold text-fg' : 'text-muted'
              }`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function TodayIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {[3, 10, 17].flatMap((x) =>
        [3, 10, 17].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="5" height="5" rx="1" />),
      )}
    </svg>
  );
}
function GearIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}
