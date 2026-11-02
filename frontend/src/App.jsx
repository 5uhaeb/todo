import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VerifyCode from './pages/VerifyCode';
import AuthCallback from './pages/AuthCallback';
import Mfa from './pages/Mfa';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/verify" element={<VerifyCode />} />
        <Route path="/mfa" element={<Mfa />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/oauth/consent" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
