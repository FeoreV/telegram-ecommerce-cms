import React, { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/layout/Layout'
import LoadingSpinner from './components/core/LoadingSpinner'
import ErrorBoundary from './components/error/ErrorBoundary'
import PageDebugger from './components/core/PageDebugger'
import { useAuth } from './contexts/AuthContext'
import AccessDeniedPage from './pages/AccessDeniedPage'
import { User } from './types'
import LoginPage from './pages/LoginPage'
import { baseAppRoles, routeDefinitions } from './routes/config'
import PublicHealthPage from './pages/PublicHealthPage'

const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'))

const renderLazyPage = (
  Component: React.LazyExoticComponent<React.ComponentType>,
  pageName: string
) => (
  <ErrorBoundary>
    <PageDebugger pageName={pageName}>
      <Suspense fallback={<LoadingSpinner />}>
        <Component />
      </Suspense>
    </PageDebugger>
  </ErrorBoundary>
)

function ProtectedApp({ user }: { user: User }) {
  if (!baseAppRoles.includes(user.role)) {
    return <AccessDeniedPage userRole={user.role} />
  }

  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {routeDefinitions
            .filter((route) => route.allowedRoles.includes(user.role))
            .map(({ path, pageName, component }) => (
              <Route key={path} path={path} element={renderLazyPage(component, pageName)} />
            ))}
          <Route
            path="*"
            element={
              <ErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                  <NotFoundPage />
                </Suspense>
              </ErrorBoundary>
            }
          />
        </Routes>
      </ErrorBoundary>
    </Layout>
  )
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <Routes>
      <Route path="/health" element={<PublicHealthPage />} />
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/*"
        element={user ? <ProtectedApp user={user} /> : <Navigate to="/login" replace />}
      />
    </Routes>
  )
}

export default App
