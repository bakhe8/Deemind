import { Navigate, Route, Routes } from 'react-router-dom';
import SidebarNav from './layout/SidebarNav';
import TopBar from './layout/TopBar';
import BrandsIdentity from './pages/BrandsIdentity';
import BuildValidation from './pages/BuildValidation';
import ReportsAndLogs from './pages/ReportsLogs';
import PreviewDelivery from './pages/PreviewDelivery';
import BrandWizardView from './views/BrandWizard';

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <SidebarNav />
      <div className="flex-1 flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <Routes>
            <Route path="/brands" element={<BrandsIdentity />} />
            <Route path="/build" element={<BuildValidation />} />
            <Route path="/reports" element={<ReportsAndLogs />} />
            <Route path="/preview" element={<PreviewDelivery />} />
            <Route path="/creative/brand-wizard" element={<BrandWizardView />} />
            <Route path="*" element={<Navigate to="/brands" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
