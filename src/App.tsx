import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { MigrationDialog } from './components/MigrationDialog'
import { db } from './db'
import {
  LEGACY_MIGRATION_META_KEY,
  hasLegacyData,
  readLegacyFromLocalStorage,
} from './migration'
import { ArchivePage } from './pages/ArchivePage'
import { CapturePage } from './pages/CapturePage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { PlanPage } from './pages/PlanPage'
import { SettingsPage } from './pages/SettingsPage'
import { SourceDetailPage } from './pages/SourceDetailPage'
import { SourceFormPage } from './pages/SourceFormPage'
import type { LegacyData } from './types'

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/sources/new" element={<SourceFormPage />} />
        <Route path="/sources/:sourceId" element={<SourceDetailPage />} />
        <Route path="/sources/:sourceId/edit" element={<SourceFormPage />} />
        <Route path="/capture/:sourceId" element={<CapturePage />} />
        <Route path="/notes/:noteId/edit" element={<CapturePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/plan" element={<PlanPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  const [legacy, setLegacy] = useState<LegacyData | null>(null)

  useEffect(() => {
    let active = true
    const check = async () => {
      const marker = await db.appMeta.get(LEGACY_MIGRATION_META_KEY)
      const found = readLegacyFromLocalStorage()
      if (active && !marker && hasLegacyData(found)) setLegacy(found)
    }
    void check()
    return () => { active = false }
  }, [])

  return (
    <HashRouter>
      <AppRoutes />
      {legacy && (
        <MigrationDialog
          legacy={legacy}
          onLater={() => setLegacy(null)}
          onComplete={() => setLegacy(null)}
        />
      )}
    </HashRouter>
  )
}
