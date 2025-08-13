import { useLocation, useNavigate } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { useEffect, useState } from "react";

interface BreadcrumbItem {
  label: string;
  path: string;
}

const formatPathLabel = (path: string): string => {
  return path
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getIconForPath = (path: string): string | null => {
  const iconMap: Record<string, string> = {
    "/": "/icons/house.svg",
    "/home": "/icons/house.svg",
    "/dashboard": "/icons/user.svg",
    "/admin-dashboard": "/icons/user.svg",
    "/admin": "/icons/user.svg",
    "/chats": "/icons/msgs.svg",
    "/add-listing": "/icons/duplicate-plus.svg",
    "/bookmarks": "/icons/book-open.svg",
    "/notifications": "/icons/bell.svg",
    "/account-settings": "/icons/nut.svg",
    "/help": "/icons/circle-question.svg",
    "/cookie-policy": "/icons/book-open.svg",
    "/login": "/icons/user.svg",
    "/signup": "/icons/user.svg",
    "/signup-dialog": "/icons/user.svg",
    "/reset-password": "/icons/triangle-warning.svg",
    "/unauthorized": "/icons/triangle-warning.svg",
    "/verify-documents": "/icons/thumbs-up.svg",
    "/profile": "/icons/user.svg",
    "/listings": "/icons/eye.svg",
    "/edit-listing": "/icons/pen.svg",
  };

  if (iconMap[path]) return iconMap[path];

  // Fallback: match by known prefixes for dynamic routes
  const knownPrefixes = [
    "/listings",
    "/edit-listing",
    "/admin-dashboard",
    "/account-settings",
  ];
  for (const prefix of knownPrefixes) {
    if (path.startsWith(prefix)) return iconMap[prefix];
  }

  return null;
};

const getBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const paths = pathname.split("/").filter(Boolean);
  if (paths.length === 0) return [{ label: "Home", path: "/" }];

  // Start with home
  const breadcrumbs: BreadcrumbItem[] = [{ label: "Home", path: "/" }];

  // Build breadcrumbs from the current pathname
  let currentPath = "";
  paths.forEach((path) => {
    currentPath += `/${path}`;
    breadcrumbs.push({
      label: formatPathLabel(path),
      path: currentPath,
    });
  });

  return breadcrumbs;
};

export default function BreadcrumbNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [history, setHistory] = useState<BreadcrumbItem[]>([]);
  const isChatsRoute = location.pathname === '/chats';

  useEffect(() => {
    const storedHistory = localStorage.getItem("breadcrumbHistory");
    if (storedHistory) {
      setHistory(JSON.parse(storedHistory));
    }
  }, []);

  useEffect(() => {
    const newBreadcrumbs = getBreadcrumbs(location.pathname);
    if (JSON.stringify(newBreadcrumbs) !== JSON.stringify(history)) {
      setHistory(newBreadcrumbs);
      localStorage.setItem("breadcrumbHistory", JSON.stringify(newBreadcrumbs));
    }
  }, [location.pathname]);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <>
      {/* Mobile Logo */}
      {!isChatsRoute && (
        <div className="md:hidden flex items-center h-10 w-10 gap-1">
          <img
            src="/hlogo.png"
            alt="Huntrr Logo"
            className="w-fit h-full -p-8 rounded-lg  md:shadow-lg backdrop-blur-6xl border bg-black/2 border-black/30 dark:border-white/20 backdrop-blur-3xl shadow-md"
          />
          <span className="font-medium tracking-tight">
            Huntrr
            <span className="text-[10px] hidden px-2 py-0.5 ml-2 rounded-sm bg-[#8752f3]/20 font-medium">
              beta
            </span>
          </span>
        </div>
      )}

      {/* Desktop Breadcrumb */}
      <div className="hidden md:block">
        <Breadcrumb className="dark:bg-white/5 bg-background/50 dark:hover:bg-white/10 hover:bg-black/5 transition-colors dark:border-white/10 p-4 rounded-lg md:shadow-lg shadow-md backdrop-blur-6xl w-fit px-4 py-2 dark:shadow-lg border border-black/10 font-medium text-sm">
          <BreadcrumbList>
            {history.map((breadcrumb, index) => (
              <BreadcrumbItem key={breadcrumb.path} className="text-sm font-medium">
                {index === history.length - 1 ? (
                  <BreadcrumbPage className="font-medium">
                    <span className="inline-flex items-center">
                      {getIconForPath(breadcrumb.path) && (
                        <img
                          src={getIconForPath(breadcrumb.path) as string}
                          alt=""
                          className="w-4 h-4 mr-2"
                        />
                      )}
                      {breadcrumb.label}
                    </span>
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    onClick={() => handleNavigation(breadcrumb.path)}
                    className="cursor-pointer font-medium text-sm"
                  >
                    <span className="inline-flex items-center">
                      {getIconForPath(breadcrumb.path) && (
                        <img
                          src={getIconForPath(breadcrumb.path) as string}
                          alt=""
                          className="w-4 h-4 mr-2"
                        />
                      )}
                      {breadcrumb.label}
                    </span>
                  </BreadcrumbLink>
                )}
                {index < history.length - 1 && <BreadcrumbSeparator />}
              </BreadcrumbItem>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </>
  );
}