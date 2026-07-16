import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuthStore } from "@/stores/auth"

export default function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <Outlet />
}
