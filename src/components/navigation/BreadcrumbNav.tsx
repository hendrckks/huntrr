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

const getBreadcrumbs = (
  pathname: string,
  history: BreadcrumbItem[]
): BreadcrumbItem[] => {
  const paths = pathname.split("/").filter(Boolean);
  if (paths.length === 0) return [{ label: "Home", path: "/" }];

  // Start with home
  let breadcrumbs: BreadcrumbItem[] = [{ label: "Home", path: "/" }];

  // Find the index where the current path diverges from history
  let divergeIndex = -1;
  for (let i = 0; i < history.length; i++) {
    if (history[i].path === pathname) {
      return history.slice(0, i + 1);
    }
    if (pathname.startsWith(history[i].path)) {
      divergeIndex = i;
    }
  }

  // If we found a diverging point, keep the history up to that point
  if (divergeIndex >= 0) {
    breadcrumbs = history.slice(0, divergeIndex + 1);
  }

  // Add any new path segments
  let currentPath = breadcrumbs[breadcrumbs.length - 1]?.path || "";
  const remainingPaths = pathname
    .slice(currentPath.length)
    .split("/")
    .filter(Boolean);

  remainingPaths.forEach((path) => {
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

  useEffect(() => {
    const storedHistory = localStorage.getItem("breadcrumbHistory");
    if (storedHistory) {
      setHistory(JSON.parse(storedHistory));
    }
  }, []);

  useEffect(() => {
    const newBreadcrumbs = getBreadcrumbs(location.pathname, history);
    if (JSON.stringify(newBreadcrumbs) !== JSON.stringify(history)) {
      setHistory(newBreadcrumbs);
      localStorage.setItem("breadcrumbHistory", JSON.stringify(newBreadcrumbs));
    }
  }, [location.pathname, history]);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <>
      {/* Mobile Logo */}
      <div className="md:hidden flex items-center h-10 w-10 gap-2">
        <img
          src="/hlogo.png"
          alt="Huntrr Logo"
          className="w-fit h-full -p-8 rounded-lg border bg-black/2 border-black/30 dark:border-white/20 backdrop-blur-3xl shadow-md"
        />
        <span className="text-lg font-medium tracking-tight mt-1">
          Huntrr
          <span className="text-[10px] hidden px-2 py-0.5 ml-2 rounded-sm bg-[#8752f3]/20 font-medium">
            beta
          </span>
        </span>
      </div>

      {/* Desktop Breadcrumb */}
      <div className="hidden md:block">
        <Breadcrumb className="dark:bg-white/5 bg-background/50 dark:hover:bg-white/10 hover:bg-black/5 transition-colors dark:border-white/10 p-4 rounded-lg md:shadow-lg shadow-md backdrop-blur-6xl w-fit px-4 py-2 dark:shadow-lg border border-black/5 font-medium text-sm">
          <BreadcrumbList>
            {history.map((breadcrumb, index) => (
              <BreadcrumbItem key={breadcrumb.path} className="text-sm font-medium">
                {index === history.length - 1 ? (
                  <BreadcrumbPage className="font-medium px-2">{breadcrumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    onClick={() => handleNavigation(breadcrumb.path)}
                    className="cursor-pointer font-medium text-sm"
                  >
                    {breadcrumb.label}
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
