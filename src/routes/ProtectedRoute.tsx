import React, { useMemo } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import type { UserRole } from "../lib/types/auth"

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAuth?: boolean
  requireUnauth?: boolean
  allowedRoles?: UserRole[]
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireUnauth = false,
  allowedRoles = [],
}) => {
  const { user, loading, isAuthenticated, isRefreshing, isInitialized } = useAuth()
  const location = useLocation()

  const memoizedAuthState = useMemo(() => {
    return { isAuthenticated: isAuthenticated(), userRole: user?.role }
  }, [isAuthenticated, user])

  // Show loading state while checking authentication and role
  if (loading || isRefreshing || !isInitialized) {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center h-screen">
        <span>Loading...</span>
      </div>
    )
  }

  // Handle unauthenticated routes requiring authentication
  if (requireAuth && !memoizedAuthState.isAuthenticated) {
    const redirectPath = location.pathname.startsWith("/admin-dashboard") 
      ? "/admin" 
      : "/role-dialog"
    return <Navigate to={redirectPath} state={{ from: location }} replace />
  }

  // Redirect authenticated users from authentication routes to their dashboards
  if (requireUnauth && memoizedAuthState.isAuthenticated && user) {
    let redirectPath = "/"
    switch (user.role) {
      case "admin":
        redirectPath = "/admin-dashboard"
        break
      case "user":
        redirectPath = "/profile"
        break
      case "landlord_verified":
      case "landlord_unverified":
        redirectPath = "/dashboard"
        break
    }
    return <Navigate to={redirectPath} replace />
  }

  // Check role-based access for authenticated routes
  if (memoizedAuthState.isAuthenticated && user) {
    const hasAllowedRole = allowedRoles.length === 0 || 
      (user.role && allowedRoles.includes(user.role as UserRole))
    
    if (!hasAllowedRole) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  // If all checks pass, render the children
  return <>{children}</>
}

export default ProtectedRoute