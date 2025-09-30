 
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { cn } from '@/lib/utils';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import square_logo from '../../assets/square_logo.svg'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Menu,
  Home,
  Calendar,
  FileText,
  History,
  Award,
  MessageCircle,
  MessageSquare,
  BarChart3,
  Target,
  UserPlus,
  Settings,
  Users,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  UserCheck,
  GraduationCap,
  LogOut,
  Building2,
  ChevronUp,
  ChevronLeft,
  Package,
  List,
  Code,
  Upload,
  Receipt,
  HelpCircle,
  BookOpen,
  AlertCircle,
  ClipboardCheck,
  CheckSquare,
  Banknote,
  Clock,
  Building,
  SquareChartGantt,
  BanknoteArrowUp
} from 'lucide-react';

const iconMap = {
  Home,
  Calendar,
  FileText,
  List,
  Receipt,
  History,
  MessageSquare,
  Target,
  UserPlus,
  Settings,
  Users,
  Package,
  LogOut,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  DollarSign,
  UserCheck,
  GraduationCap,
  BarChart3,
  ClipboardCheck,
  Award,
  MessageCircle,
  Code,
  HelpCircle,
  BookOpen,
  Upload,
  CheckSquare,
  Banknote,
  Clock,
  Building,
  SquareChartGantt,
  BanknoteArrowUp
};

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  currentDashboard?: any;
}

export function AppSidebar({ isCollapsed, onToggle, currentDashboard }: AppSidebarProps) {
  const { user, logout } = useAuth();
  

  return (
    <div className={cn(
      "bg-white/90 backdrop-blur-xl border-r border-orange-200/50 transition-all duration-300 ease-in-out flex flex-col fixed left-4 top-4 h-[calc(100vh-2rem)] z-50 rounded-2xl shadow-2xl shadow-orange-200/20",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-orange-200/30">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {/* <div className="p-1.5 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg">
                <Building2 className="h-5 w-5 text-white" />
              </div> */}
              <div className="h-10 w-10">
                <img src={square_logo} alt="square logo"></img>
              </div>
              <span className="font-bold text-lg bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Mechlin HRMS</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-8 w-8 hover:bg-orange-100/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Navigation Content */}
      <div className="flex-1 overflow-y-auto py-4 px-2">
        {/* Current Dashboard Navigation */}
        {currentDashboard && (
          <div>
            {!isCollapsed && (
              <h3 className="px-3 py-2 text-xs font-semibold text-orange-600/70 uppercase tracking-wider">
                {currentDashboard.name}
              </h3>
            )}
            <nav className="space-y-2">
              {currentDashboard.pages.map((page: any) => {
                const IconComponent = iconMap[page.icon as keyof typeof iconMap] || Home;
                
                return (
                  <NavLink
                    key={page.id}
                    to={page.path}
                    end={page.path === currentDashboard?.pages[0]?.path}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 backdrop-blur-sm',
                        isActive && isCollapsed
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-200/50'
                          : isActive && !isCollapsed
                          ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 shadow-md shadow-orange-200/30'
                          : 'text-gray-700 hover:bg-orange-50/50 hover:text-orange-800 hover:shadow-sm',
                        isCollapsed && 'justify-center px-2'
                      )
                    }
                    title={isCollapsed ? page.name : undefined}
                  >
                    <IconComponent className={cn("h-5 w-5 flex-shrink-0", !isCollapsed && "mr-3")} />
                    {!isCollapsed && <span>{page.name}</span>}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Notification Bell - positioned at bottom above footer */}
      <div className={cn(
        "px-3 pb-3 font-bold",
        isCollapsed ? "flex justify-center" : ""
      )}>
        <NotificationBell variant="sidebar" isCollapsed={isCollapsed} />
      </div>

      {/* Footer */}
      <div className="border-t border-orange-200/30 p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start h-auto p-3 hover:bg-orange-50/50 rounded-xl transition-all duration-200",
                isCollapsed && "justify-center"
              )}
            >
              <Avatar className="h-10 w-10 ring-2 ring-orange-200/50 shadow-md">
                <AvatarImage src={user?.avatar_url} alt={user?.full_name} />
                <AvatarFallback>
                  {user?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="ml-3 text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-orange-600/70 truncate">
                    {user?.position || user?.role?.name?.replace('_', ' ') || user?.role_id?.replace('_', ' ') || 'Employee'}
                  </p>
                </div>
              )}
              {!isCollapsed && <ChevronUp className="ml-auto h-4 w-4 text-orange-400" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56"
            side={isCollapsed ? "right" : "top"}
            align={isCollapsed ? "start" : "end"}
            sideOffset={8}
          >
            <DropdownMenuItem asChild>
              <NavLink to="/dashboard/settings">
                <Settings className="mr-2 h-4 w-4" />
                Account Settings
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}