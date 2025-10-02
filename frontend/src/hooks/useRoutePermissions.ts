import { useMemo } from 'react'

import { useAuth } from '../contexts/AuthContext'
import {
  routeDefinitions,
  RoutePath,
  getPrimaryRedirect,
  canRoleAccessPath,
} from '../routes/config'

type RouteKey = RoutePath
type RouteAccess = {
  allowed: boolean
  roles: ReadonlyArray<string>
}

export const useRoutePermissions = () => {
  const { user } = useAuth()
  const role = user?.role

  const routeAccess = useMemo<Record<RouteKey, RouteAccess>>(() => {
    return routeDefinitions.reduce<Record<RouteKey, RouteAccess>>((acc, route) => {
      acc[route.path] = {
        allowed: Boolean(role && route.allowedRoles.includes(role)),
        roles: route.allowedRoles,
      }
      return acc
    }, {} as Record<RouteKey, RouteAccess>)
  }, [role])

  const canAccess = (path: RouteKey) => routeAccess[path]?.allowed ?? false

  const getAvailableRoutes = () =>
    Object.entries(routeAccess)
      .filter(([, config]) => config.allowed)
      .map(([path, config]) => ({ path: path as RouteKey, roles: config.roles }))

  const getRedirectPath = (requestedPath: RouteKey): RouteKey => {
    if (canAccess(requestedPath)) {
      return requestedPath
    }

    return getPrimaryRedirect(role) as RouteKey
  }

  return {
    canAccess,
    getAvailableRoutes,
    getRedirectPath,
    routeAccess,
    userRole: role,
  }
}

