import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import BottomNav from '../components/BottomNav';

export default function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div
        className={`drawer-overlay ${drawerOpen ? 'show' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div className="app-main">
        <Header onMenuClick={() => setDrawerOpen(true)} />
        <main className="app-content">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
