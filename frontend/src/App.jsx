import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OAuthConsent from './pages/OAuthConsent';
import VerifyCode from './pages/VerifyCode';
import AuthCallback from './pages/AuthCallback';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/verify" element={<VerifyCode />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/oauth/consent" element={<OAuthConsent />} />
      </Routes>
    </BrowserRouter>
  );
}
