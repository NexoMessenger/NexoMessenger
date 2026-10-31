import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { LanguageProvider, useI18n } from './i18n'
import Layout from './components/Layout'
import AccountGreeting from './components/AccountGreeting'
import { CallsProvider } from './components/Calls'
import WelcomePage from './pages/WelcomePage'
import { LoginPage, RegisterPage, ForgotPage } from './pages/AuthPages'
import ChatsPage from './pages/ChatsPage'
import AiPage from './pages/AiPage'
import ZeronBotPage from './pages/ZeronBotPage'
import ChatRoomPage from './pages/ChatRoomPage'
import GroupsPage from './pages/GroupsPage'
import GroupRoomPage from './pages/GroupRoomPage'
import ChannelsPage from './pages/ChannelsPage'
import ChannelRoomPage from './pages/ChannelRoomPage'
import SearchPage from './pages/SearchPage'
import ProfilePage from './pages/ProfilePage'
import UserPage from './pages/UserPage'
import SettingsPage from './pages/SettingsPage'
import GiftsPage from './pages/GiftsPage'
import PremiumPage from './pages/PremiumPage'
import { NexoMark } from './components/icons'
import type { ReactNode } from 'react'

function SessionSplash() {
  const { t } = useI18n()
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', position: 'relative', zIndex: 1 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="logo-badge" style={{ margin: '0 auto 16px', width: 54, height: 54 }}><NexoMark size={30} /></div>
        <div className="spinner" />
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 14 }}>{t('session.restoring')}</p>
      </div>
    </div>
  )
}

/** Entry gate: signed-in users go straight to the messenger (session preserved),
 *  everyone else lands on the multilingual welcome screen first. */
function Gate() {
  const { profile, loading } = useAuth()
  if (loading) return <SessionSplash />
  if (profile) return <Navigate to="/chats" replace />
  return <WelcomePage />
}

function Protected({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return <SessionSplash />
  if (!profile) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()
  if (!loading && profile) return <Navigate to="/chats" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <HashRouter>
          <CallsProvider><Routes>
            <Route path="/" element={<Gate />} />
            <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
            <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
            <Route path="/forgot" element={<ForgotPage />} />
            <Route path="/chats" element={<Protected><ChatsPage /></Protected>} />
            <Route path="/ai" element={<Protected><AiPage /></Protected>} />
            <Route path="/zeron" element={<Protected><ZeronBotPage /></Protected>} />
            <Route path="/chat/:id" element={<Protected><ChatRoomPage /></Protected>} />
            <Route path="/groups" element={<Protected><GroupsPage /></Protected>} />
            <Route path="/group/:id" element={<Protected><GroupRoomPage /></Protected>} />
            <Route path="/channels" element={<Protected><ChannelsPage /></Protected>} />
            <Route path="/channel/:id" element={<Protected><ChannelRoomPage /></Protected>} />
            <Route path="/search" element={<Protected><SearchPage /></Protected>} />
            <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
            <Route path="/user/:id" element={<Protected><UserPage /></Protected>} />
            <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
            <Route path="/gifts" element={<Protected><GiftsPage /></Protected>} />
            <Route path="/premium" element={<Protected><PremiumPage /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes><AccountGreeting /></CallsProvider>
        </HashRouter>
      </LanguageProvider>
    </AuthProvider>
  )
}
