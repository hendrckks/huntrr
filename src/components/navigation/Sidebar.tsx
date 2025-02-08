import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CreditCard,
  Receipt,
  PieChart,
  Users,
  FileText,
  Link as LinkIcon,
  Wallet,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";

const Sidebar = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  const navItems = [{ icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Wallet, label: "Accounts", path: "/accounts" },
    { icon: CreditCard, label: "Cards", path: "/cards" },
    { icon: Receipt, label: "Transaction", path: "/transactions" },
    { icon: PieChart, label: "Spend Groups", path: "/spend-groups" },
    { icon: FileText, label: "Insights", path: "/insights" },
    { icon: Users, label: "Payees", path: "/payees" },
    { icon: FileText, label: "Invoices", path: "/invoices" },
    { icon: LinkIcon, label: "Connections", path: "/connections" }];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  return (
    <div className="w-64 bg-background text-foreground h-screen p1-20 fixed left-0 top-0 p-4 flex flex-col">
      {/* Navigation Items */}
      <nav className="flex-1 space-y-2 mt-10">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile Section with Theme Toggle */}
      <div className="border-t border-white/10 pt-4 mt-4 text-sm">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.photoURL || ''} />
              <AvatarFallback>{user?.displayName ? getInitials(user.displayName) : '?'}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-sm">{user?.displayName || 'User Name'}</h3>
              <p className="text-xs text-muted-foreground">{user?.email || 'user@email.com'}</p>
            </div>
          </div>
          <button
            className="flex items-center justify-between px-4 py-2 rounded-lg hover:bg-accent transition-colors"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <span className="text-sm">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;