import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Home, Hotel, Building2, Bath, Bed, CreditCard } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const QuickFilter = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Property types
  const propertyTypes = [
    {
      id: "apartment",
      label: "Apartment",
      icon: <Building2 className="mr-1 h-3 w-3" />,
    },
    { id: "house", label: "House", icon: <Home className="mr-1 h-3 w-3" /> },
    { id: "studio", label: "Studio", icon: <Hotel className="mr-1 h-3 w-3" /> },
  ];

  // Bedroom options
  const bedroomOptions = [
    { id: "1", label: "1 Bed", icon: <Bed className="mr-1 h-3 w-3" /> },
    { id: "2", label: "2 Beds", icon: <Bed className="mr-1 h-3 w-3" /> },
    { id: "3", label: "3+ Beds", icon: <Bed className="mr-1 h-3 w-3" /> },
  ];

  // Bathroom options
  const bathroomOptions = [
    { id: "1", label: "1 Bath", icon: <Bath className="mr-1 h-3 w-3" /> },
    { id: "2", label: "2+ Baths", icon: <Bath className="mr-1 h-3 w-3" /> },
  ];

  // Price range options
  const priceOptions = [
    {
      id: "price_20000",
      label: "< 20K",
      min: 0,
      max: 20000,
      icon: <CreditCard className="mr-1 h-3 w-3" />,
    },
    {
      id: "price_50000",
      label: "< 50K",
      min: 0,
      max: 50000,
      icon: <CreditCard className="mr-1 h-3 w-3" />,
    },
    {
      id: "price_80000",
      label: "< 80K",
      min: 0,
      max: 80000,
      icon: <CreditCard className="mr-1 h-3 w-3" />,
    },
  ];

  const toggleFilter = (
    filterId: string,
    filterType: string,
    value: string | { min: number; max: number }
  ) => {
    const newParams = new URLSearchParams(searchParams);

    // Check if filter is already active
    const isActive = activeFilters.includes(filterId);

    // Update active filters state
    if (isActive) {
      setActiveFilters(activeFilters.filter((id) => id !== filterId));

      // Remove from search params
      if (filterType === "price") {
        newParams.delete("minPrice");
        newParams.delete("maxPrice");
      } else {
        newParams.delete(filterType);
      }
    } else {
      // First remove any other filters of the same type
      // This is the fixed part - we need to be careful about how we identify filters of the same type
      const sameTypeFilters = activeFilters.filter((id) => {
        if (filterType === "price") {
          return id.startsWith("price_");
        }
        if (filterType === "type") {
          return propertyTypes.some((pt) => pt.id === id);
        }
        if (filterType === "bedrooms") {
          // Only match bedroom filters
          return bedroomOptions.some((bo) => bo.id === id);
        }
        if (filterType === "bathrooms") {
          // Only match bathroom filters
          return bathroomOptions.some((bo) => bo.id === id);
        }
        return false;
      });

      setActiveFilters([
        ...activeFilters.filter((id) => !sameTypeFilters.includes(id)),
        filterId,
      ]);

      // Add to search params
      if (filterType === "price" && typeof value !== "string") {
        if (value.min > 0) newParams.set("minPrice", value.min.toString());
        if (value.max < 100000) newParams.set("maxPrice", value.max.toString());
      } else if (typeof value === "string") {
        newParams.set(filterType, value);
      }
    }

    setSearchParams(newParams);
  };

  const clearAllFilters = () => {
    setActiveFilters([]);
    setSearchParams(new URLSearchParams());
  };

  return (
    <Card className="h-full col-span-1 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl flex flex-col sm:flex-row sm:items-center justify-between font-medium gap-2">
          Quick Filters
          {activeFilters.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-sm tracking-normal bg-black text-white hover:text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/90"
              onClick={clearAllFilters}
            >
              Clear all filters
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Property Type
          </h3>
          <div className="flex flex-wrap gap-2">
            {propertyTypes.map((type) => (
              <Badge
                key={type.id}
                variant={
                  activeFilters.includes(type.id) ? "default" : "outline"
                }
                className={`cursor-pointer text-sm py-1 px-3 font-medium dark:hover:bg-white/70 hover:bg-[#121212]/90 bg-black/90 dark:bg-white/80 dark:text-black text-white transition-colors ${
                  activeFilters.includes(type.id)
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : ""
                }`}
                onClick={() => toggleFilter(type.id, "type", type.id)}
              >
                {type.icon} {type.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-[200px] space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Bedrooms
          </h3>
          <div className="flex flex-wrap gap-2">
            {bedroomOptions.map((option) => (
              <Badge
                key={option.id}
                variant={
                  activeFilters.includes(option.id) ? "default" : "outline"
                }
                className={`cursor-pointer text-sm py-1 px-3 hover:bg-[#121212]/90 dark:hover:bg-white/70 bg-black/90 dark:bg-white/80 dark:text-black text-white font-medium transition-colors ${
                  activeFilters.includes(option.id)
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : ""
                }`}
                onClick={() => toggleFilter(option.id, "bedrooms", option.id)}
              >
                {option.icon} {option.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-[200px] space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Bathrooms
          </h3>
          <div className="flex flex-wrap gap-2">
            {bathroomOptions.map((option) => (
              <Badge
                key={`bath_${option.id}`}
                variant={
                  activeFilters.includes(`bath_${option.id}`)
                    ? "default"
                    : "outline"
                }
                className={`cursor-pointer text-sm py-1 px-3 hover:bg-[#121212]/90 dark:hover:bg-white/70 bg-black/90 dark:bg-white/80 dark:text-black text-white font-medium transition-colors ${
                  activeFilters.includes(`bath_${option.id}`)
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : ""
                }`}
                onClick={() =>
                  toggleFilter(`bath_${option.id}`, "bathrooms", option.id)
                }
              >
                {option.icon} {option.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-[200px] space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Price Range
          </h3>
          <div className="flex flex-wrap gap-2">
            {priceOptions.map((option) => (
              <Badge
                key={option.id}
                variant={
                  activeFilters.includes(option.id) ? "default" : "outline"
                }
                className={`cursor-pointer text-sm py-1 px-3 hover:bg-[#121212]/90 dark:hover:bg-white/70 bg-black/90 dark:bg-white/80 dark:text-black text-white font-medium transition-colors ${
                  activeFilters.includes(option.id)
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : ""
                }`}
                onClick={() =>
                  toggleFilter(option.id, "price", {
                    min: option.min,
                    max: option.max,
                  })
                }
              >
                {option.icon} {option.label}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickFilter;
