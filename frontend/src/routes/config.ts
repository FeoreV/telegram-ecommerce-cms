import AssessmentIcon from '@mui/icons-material/Assessment'
import DashboardIcon from '@mui/icons-material/Dashboard'
import InventoryIcon from '@mui/icons-material/Inventory'
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart'
import PaymentIcon from '@mui/icons-material/Payment'
import PeopleIcon from '@mui/icons-material/People'
import ReceiptIcon from '@mui/icons-material/Receipt'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import StoreIcon from '@mui/icons-material/Store'
import { ComponentType, LazyExoticComponent, lazy } from 'react'

import { User } from '../types'

export type Role = User['role']

export type RoutePath =
  | '/dashboard'
  | '/stores'
  | '/products'
  | '/orders'
  | '/payments'
  | '/reports'
  | '/bots'
  | '/users'
  | '/monitoring'
  | '/profile'

export interface RouteDefinition<Path extends RoutePath = RoutePath> {
  path: Path
  pageName: string
  allowedRoles: ReadonlyArray<Role>
  component: LazyExoticComponent<ComponentType>
  showInSidebar?: boolean
  label?: string
  icon?: ComponentType
}

export const baseAppRoles: ReadonlyArray<Role> = ['OWNER', 'ADMIN', 'VENDOR'] as const

export const routeDefinitions = [
  {
    path: '/dashboard',
    pageName: 'dashboard',
    allowedRoles: baseAppRoles,
    component: lazy(() => import('../pages/DashboardPage')),
    showInSidebar: true,
    label: 'Панель управления',
    icon: DashboardIcon,
  },
  {
    path: '/stores',
    pageName: 'stores',
    allowedRoles: baseAppRoles,
    component: lazy(() => import('../pages/StoresPage')),
    showInSidebar: true,
    label: 'Магазины',
    icon: StoreIcon,
  },
  {
    path: '/products',
    pageName: 'products',
    allowedRoles: baseAppRoles,
    component: lazy(() => import('../pages/ProductsPage')),
    showInSidebar: true,
    label: 'Товары',
    icon: InventoryIcon,
  },
  {
    path: '/orders',
    pageName: 'orders',
    allowedRoles: baseAppRoles,
    component: lazy(() => import('../pages/OrdersPage')),
    showInSidebar: true,
    label: 'Заказы',
    icon: ReceiptIcon,
  },
  {
    path: '/payments',
    pageName: 'payments',
    allowedRoles: baseAppRoles,
    component: lazy(() => import('../pages/PaymentVerificationPage')),
    showInSidebar: true,
    label: 'Верификация оплат',
    icon: PaymentIcon,
  },
  {
    path: '/reports',
    pageName: 'reports',
    allowedRoles: baseAppRoles,
    component: lazy(() => import('../pages/ReportsPage')),
    showInSidebar: true,
    label: 'Отчеты',
    icon: AssessmentIcon,
  },
  {
    path: '/bots',
    pageName: 'bots',
    allowedRoles: ['OWNER', 'ADMIN'] as ReadonlyArray<Role>,
    component: lazy(() => import('../pages/BotsPage')),
    showInSidebar: true,
    label: 'Телеграм боты',
    icon: SmartToyIcon,
  },
  {
    path: '/users',
    pageName: 'users',
    allowedRoles: ['OWNER'] as ReadonlyArray<Role>,
    component: lazy(() => import('../pages/UsersPage')),
    showInSidebar: true,
    label: 'Пользователи',
    icon: PeopleIcon,
  },
  {
    path: '/monitoring',
    pageName: 'monitoring',
    allowedRoles: ['OWNER', 'ADMIN'] as ReadonlyArray<Role>,
    component: lazy(() => import('../pages/MonitoringPage')),
    showInSidebar: true,
    label: 'Мониторинг',
    icon: MonitorHeartIcon,
  },
  {
    path: '/profile',
    pageName: 'profile',
    allowedRoles: baseAppRoles,
    component: lazy(() => import('../pages/ProfilePage')),
    showInSidebar: false,
  },
] as const satisfies ReadonlyArray<RouteDefinition>

export const getRoutesForRole = (role?: Role | null) =>
  routeDefinitions.filter((route) => (role ? route.allowedRoles.includes(role) : false))

export const canRoleAccessPath = (role: Role | undefined, path: RoutePath) => {
  const route = routeDefinitions.find((item) => item.path === path)
  if (!route) {
    return false
  }
  return Boolean(role && route.allowedRoles.includes(role))
}

export const getPrimaryRedirect = (role?: Role | null): RoutePath => {
  const priority: RoutePath[] = ['/dashboard', '/stores', '/products', '/orders']
  for (const path of priority) {
    if (canRoleAccessPath(role ?? undefined, path)) {
      return path
    }
  }
  return '/dashboard'
}

