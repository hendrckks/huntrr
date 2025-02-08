import { useLocation, useNavigate } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";

const getBreadcrumbs = (pathname: string) => {
  const paths = pathname.split("/").filter(Boolean);
  if (paths.length === 0) return [{ label: "Home", path: "/" }];

  const breadcrumbs = [{ label: "Home", path: "/" }];
  let currentPath = "";

  paths.forEach((path) => {
    currentPath += `/${path}`;
    const label = path
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    breadcrumbs.push({ label, path: currentPath });
  });

  return breadcrumbs;
};

export default function BreadcrumbNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const breadcrumbs = getBreadcrumbs(location.pathname);

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <Breadcrumb className="mb-6 ml-4 bg-white/10 w-fit px-4 py-2 rounded-md shadow-lg">
      <BreadcrumbList>
        {breadcrumbs.map((breadcrumb, index) => (
          <BreadcrumbItem key={breadcrumb.path} className="text-sm">
            {index === breadcrumbs.length - 1 ? (
              <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink 
                onClick={() => handleNavigation(breadcrumb.path)}
                className="cursor-pointer"
              >
                {breadcrumb.label}
              </BreadcrumbLink>
            )}
            {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
