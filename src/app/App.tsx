import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { useSettings } from '../hooks/settings';
import { Layout } from './Layout';
import { TodayPage } from '../pages/TodayPage';
import { OverviewPage } from '../pages/OverviewPage';
import { HabitDetailPage } from '../pages/HabitDetailPage';
import { HabitEditorPage } from '../pages/HabitEditorPage';
import { SettingsPage } from '../pages/SettingsPage';

function useThemeClass() {
  const { theme } = useSettings();
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', dark ? '#0d1117' : '#f6f8fa');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

export function App() {
  useThemeClass();
  return (
    // Hash routing works on any static host (GitHub Pages included) with no server rewrites.
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TodayPage />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="habits/new" element={<HabitEditorPage />} />
          <Route path="habits/:id" element={<HabitDetailPage />} />
          <Route path="habits/:id/edit" element={<HabitEditorPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<TodayPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
