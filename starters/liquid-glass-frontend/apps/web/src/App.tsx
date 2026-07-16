import { lazy, Suspense, useEffect, useRef, useState } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { Toaster } from "sonner"

import RouteErrorBoundary from "@/components/layout/RouteErrorBoundary"
import FullPageLoader from "@/components/shared/FullPageLoader"
import PageSkeleton from "@/components/shared/PageSkeleton"
import SidebarLayout from "@/layouts/SidebarLayout"
import { refreshAccessToken } from "@/lib/api"
import LoginPage from "@/pages/LoginPage"
import ProtectedRoute from "@/router/ProtectedRoute"
import { useAuthStore } from "@/stores/auth"

const DashboardPage = lazy(() => import("@/pages/DashboardPage"))
const ComponentsOverviewPage = lazy(
  () => import("@/pages/ComponentsOverviewPage")
)
const FoundationsPage = lazy(() => import("@/pages/FoundationsPage"))
const FormsPage = lazy(() => import("@/pages/FormsPage"))
const DataPage = lazy(() => import("@/pages/DataPage"))
const OverlaysPage = lazy(() => import("@/pages/OverlaysPage"))
const ProfileSettingsPage = lazy(() => import("@/pages/ProfileSettingsPage"))
const SystemSettingsPage = lazy(() => import("@/pages/SystemSettingsPage"))
const VirtualTableDemoPage = lazy(() => import("@/pages/VirtualTableDemoPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))
const ForbiddenPage = lazy(() => import("@/pages/ForbiddenPage"))
const ServerErrorPage = lazy(() => import("@/pages/ServerErrorPage"))
const ResultPage = lazy(() => import("@/pages/ResultPage"))

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false)
  const attemptedRef = useRef(false)

  useEffect(() => {
    const init = async () => {
      const { accessToken, refreshToken } = useAuthStore.getState()

      if (accessToken || !refreshToken) {
        // 已有 token 或无 refreshToken，无需刷新
        setIsAuthReady(true)
        return
      }

      if (attemptedRef.current) return
      attemptedRef.current = true

      try {
        await refreshAccessToken()
      } catch {
        // 刷新失败，清空状态（refreshAccessToken 内部已处理）
      } finally {
        setIsAuthReady(true)
      }
    }
    init()
  }, [])

  if (!isAuthReady) {
    return <FullPageLoader message="正在恢复登录状态..." />
  }

  return (
    <>
      <RouteErrorBoundary>
        <Routes>
          {/* 登录页：无侧边栏，全屏 */}
          <Route path="/login" element={<LoginPage />} />

          {/* 根路径重定向到仪表盘 */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 认证守卫 → 有侧边栏的页面 */}
          <Route element={<ProtectedRoute />}>
            <Route element={<SidebarLayout />}>
              <Route
                path="/dashboard"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <DashboardPage />
                  </Suspense>
                }
              />
              <Route
                path="/components"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <ComponentsOverviewPage />
                  </Suspense>
                }
              />
              <Route
                path="/components/foundations"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <FoundationsPage />
                  </Suspense>
                }
              />
              <Route
                path="/components/forms"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <FormsPage />
                  </Suspense>
                }
              />
              <Route
                path="/components/data"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <DataPage />
                  </Suspense>
                }
              />
              <Route
                path="/components/overlays"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <OverlaysPage />
                  </Suspense>
                }
              />
              <Route
                path="/virtual-table"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <VirtualTableDemoPage />
                  </Suspense>
                }
              />
              <Route
                path="/404-demo"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <NotFoundPage />
                  </Suspense>
                }
              />
              <Route
                path="/403-demo"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <ForbiddenPage />
                  </Suspense>
                }
              />
              <Route
                path="/500-demo"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <ServerErrorPage />
                  </Suspense>
                }
              />
              <Route
                path="/result-demo"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <ResultPage />
                  </Suspense>
                }
              />
              <Route
                path="/settings"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <ProfileSettingsPage />
                  </Suspense>
                }
              />
              <Route
                path="/system-settings"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <SystemSettingsPage />
                  </Suspense>
                }
              />
            </Route>
          </Route>

          <Route
            path="/403"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <ForbiddenPage />
              </Suspense>
            }
          />
          <Route
            path="/500"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <ServerErrorPage />
              </Suspense>
            }
          />
          <Route
            path="*"
            element={
              <Suspense fallback={<PageSkeleton />}>
                <NotFoundPage />
              </Suspense>
            }
          />
        </Routes>
      </RouteErrorBoundary>
      <Toaster richColors position="top-right" />
    </>
  )
}
