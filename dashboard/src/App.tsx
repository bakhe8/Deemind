import { Navigate, Route, Routes } from 'react-router-dom';
import SidebarNav from './layout/SidebarNav';
import TopBar from './layout/TopBar';
import UploadTheme from './pages/UploadTheme';
import ParserMapper from './pages/ParserMapper';
import AdapterBaseline from './pages/AdapterBaseline';
import ValidationQA from './pages/ValidationQA';
import ReportsMetrics from './pages/ReportsMetrics';
import Settings from './pages/Settings';

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <SidebarNav />
      <div className="flex-1 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <Routes>
            <Route path="/upload" element={<UploadTheme />} />
            <Route path="/parser" element={<ParserMapper />} />
            <Route path="/adapter" element={<AdapterBaseline />} />
            <Route path="/validation" element={<ValidationQA />} />
            <Route path="/reports" element={<ReportsMetrics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/upload" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
