import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, Loader2 } from "lucide-react";
import { getLocationSuggestions } from "../lib/firebase/firestore";
import { Command } from "cmdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

import { Slider } from "../components/ui/slider";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "./ui/input";

interface FilterState {
  priceRange: [number, number];
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  amenities: {
    security: boolean;
    cctv: boolean;
    parking: boolean;
    pets: boolean;
  };
  waterAvailability: string;
  location: {
    area: string;
    city: string;
  };
}

const FilterModal = () => {
  const [, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Add state for location suggestions
  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);

  // Debounce function
  const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  // Fetch suggestions handler
  const fetchSuggestions = async (value: string, field: "area" | "city") => {
    if (value.length >= 3) {
      try {
        console.log(`Fetching suggestions for ${field}: ${value}`);
        const suggestions = await getLocationSuggestions(value, field);
        console.log(`Got suggestions for ${field}:`, suggestions);
        switch (field) {
          case "area":
            setAreaSuggestions(suggestions);
            break;
          case "city":
            setCitySuggestions(suggestions);
            break;
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      }
    } else {
      // Clear suggestions if input is too short
      console.log(`Clearing suggestions for ${field} - input too short`);
      switch (field) {
        case "area":
          setAreaSuggestions([]);
          break;
        case "city":
          setCitySuggestions([]);
          break;
      }
    }
  };

  // Debounced fetch suggestions
  const debouncedFetchSuggestions = debounce(fetchSuggestions, 300);

  const handleScroll = () => {
    if (contentRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20; // 20px threshold
      setShowScrollButton(!isAtBottom);
    }
  };

  const scrollToBottom = () => {
    if (contentRef.current) {
      contentRef.current.scrollTo({
        top: contentRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 100000],
    propertyType: "",
    bedrooms: "",
    bathrooms: "",
    amenities: {
      security: false,
      cctv: false,
      parking: false,
      pets: false,
    },
    waterAvailability: "",
    location: {
      area: "",
      city: "",
    },
  });

  const handlePriceChange = (value: [number, number]) => {
    setFilters((prev) => ({ ...prev, priceRange: value }));
  };

  const handlePropertyTypeChange = (value: string) => {
    setFilters((prev) => ({ ...prev, propertyType: value }));
  };

  const handleBedroomsChange = (value: string) => {
    setFilters((prev) => ({ ...prev, bedrooms: value }));
  };

  const handleBathroomsChange = (value: string) => {
    setFilters((prev) => ({ ...prev, bathrooms: value }));
  };

  const handleAmenityChange = (amenity: keyof typeof filters.amenities) => {
    setFilters((prev) => ({
      ...prev,
      amenities: {
        ...prev.amenities,
        [amenity]: !prev.amenities[amenity],
      },
    }));
  };

  const handleWaterAvailabilityChange = (value: string) => {
    setFilters((prev) => ({ ...prev, waterAvailability: value }));
  };

  const handleLocationChange = (
    field: keyof typeof filters.location,
    value: string
  ) => {
    setFilters((prev) => ({
      ...prev,
      location: {
        ...prev.location,
        [field]: value,
      },
    }));
  };

  const handleReset = () => {
    setFilters({
      priceRange: [0, 100000],
      propertyType: "",
      bedrooms: "",
      bathrooms: "",
      amenities: {
        security: false,
        cctv: false,
        parking: false,
        pets: false,
      },
      waterAvailability: "",
      location: {
        area: "",
        city: "",
      },
    });
  };

  const getAppliedFilters = () => {
    const applied = [];

    if (filters.propertyType) {
      applied.push({
        id: "propertyType",
        label:
          filters.propertyType.charAt(0).toUpperCase() +
          filters.propertyType.slice(1),
      });
    }

    if (filters.bedrooms) {
      applied.push({
        id: "bedrooms",
        label: `${filters.bedrooms} ${
          filters.bedrooms === "1" ? "Bedroom" : "Bedrooms"
        }`,
      });
    }

    if (filters.bathrooms) {
      applied.push({
        id: "bathrooms",
        label: `${filters.bathrooms} ${
          filters.bathrooms === "1" ? "Bathroom" : "Bathrooms"
        }`,
      });
    }

    if (filters.priceRange[1] < 100000) {
      applied.push({
        id: "price",
        label: `Under KSh ${filters.priceRange[1].toLocaleString()}`,
      });
    }

    Object.entries(filters.amenities).forEach(([key, value]) => {
      if (value) {
        applied.push({
          id: key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
        });
      }
    });

    if (filters.waterAvailability) {
      applied.push({
        id: "water",
        label: filters.waterAvailability.replace("_", " "),
      });
    }

    Object.entries(filters.location).forEach(([key, value]) => {
      if (value) {
        applied.push({
          id: `location_${key}`,
          label: `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`,
        });
      }
    });

    return applied;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="dark:bg-white/5 bg-background/50 dark:hover:bg-white/10 hover:bg-black/5 transition-colors dark:border-white/10 p-5 rounded-lg md:shadow-lg shadow-md backdrop-blur-3xl font-medium w-full flex gap-4 justify-between items-center"
        >
          <div className="flex items-center gap-2">
            {/* <Filter className="h-3 w-3 dark:text-muted-foreground text-muted-foreground md:text-black/50" /> */}
            Filter Listings
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="flex items-center justify-center w-5 h-5 p-3 border dark:border-white/30 border-black/20 rounded">
              ⌘
            </span>
            +<span>I</span>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:max-w-[800px] max-h-[90vh] overflow-y-auto dark:bg-[#121212] shadow-2xl w-[95vw] md:backdrop-blur-3xl backdrop-blur-none bg-white"
        ref={contentRef}
        onScroll={handleScroll}
      >
        <DialogHeader>
          <DialogTitle className="font-medium">Filter Properties</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-3 dark:bg-[#121212]">
          {/* Price Range */}
          <div className="space-y-2">
            <Label>Price Range (KSh)</Label>
            <div className="pt-2">
              <Slider
                value={filters.priceRange}
                onValueChange={handlePriceChange}
                max={100000}
                step={1000}
                className="w-full [&_[role=slider]]:h-4 [&_[role=slider]]:w-4 [&_[role=slider]]:rounded-full"
                minStepsBetweenThumbs={1}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>KSh {filters.priceRange[0].toLocaleString()}</span>
              <span>KSh {filters.priceRange[1].toLocaleString()}</span>
            </div>
          </div>
          {/* Property Type */}
          <div className="space-y-2">
            <Label>Property Type</Label>
            <Select
              value={filters.propertyType}
              onValueChange={handlePropertyTypeChange}
            >
              <SelectTrigger className="w-full dark:bg-zinc-900">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apartment">Apartment</SelectItem>
                <SelectItem value="house">House</SelectItem>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="villa">Villa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Bedrooms & Bathrooms */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bedrooms</Label>
              <Select
                value={filters.bedrooms}
                onValueChange={handleBedroomsChange}
              >
                <SelectTrigger className="w-full dark:bg-zinc-900">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, "5+"].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bathrooms</Label>
              <Select
                value={filters.bathrooms}
                onValueChange={handleBathroomsChange}
              >
                <SelectTrigger className="w-full dark:bg-zinc-900">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, "4+"].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Amenities */}
          <div className="space-y-2">
            <Label>Amenities</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="security"
                  checked={filters.amenities.security}
                  onCheckedChange={() => handleAmenityChange("security")}
                />
                <label htmlFor="security" className="text-sm">
                  Security Guard
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cctv"
                  checked={filters.amenities.cctv}
                  onCheckedChange={() => handleAmenityChange("cctv")}
                />
                <label htmlFor="cctv" className="text-sm">
                  CCTV
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="parking"
                  checked={filters.amenities.parking}
                  onCheckedChange={() => handleAmenityChange("parking")}
                />
                <label htmlFor="parking" className="text-sm">
                  Secure Parking
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pets"
                  checked={filters.amenities.pets}
                  onCheckedChange={() => handleAmenityChange("pets")}
                />
                <label htmlFor="pets" className="text-sm">
                  Pets Allowed
                </label>
              </div>
            </div>
          </div>
          {/* Location Section */}

          <div className="space-y-2">
            <Label>Location</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {["area", "city"].map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                  </Label>
                  <div className="relative">
                    <Input
                      placeholder={`Enter ${field}`}
                      value={
                        filters.location[field as keyof typeof filters.location]
                      }
                      onChange={(e) => {
                        handleLocationChange(
                          field as keyof typeof filters.location,
                          e.target.value
                        );
                        debouncedFetchSuggestions(
                          e.target.value,
                          field as "area" | "city"
                        );
                      }}
                      className="w-full dark:bg-zinc-900"
                    />
                    {(field === "area" ? areaSuggestions : citySuggestions)
                      .length > 0 && (
                      <div className="absolute w-full mt-1 py-1 bg-popover border rounded-md shadow-md z-10">
                        <Command>
                          <Command.List>
                            {(field === "area"
                              ? areaSuggestions
                              : citySuggestions
                            ).map((suggestion) => (
                              <Command.Item
                                key={suggestion}
                                onSelect={() => {
                                  handleLocationChange(
                                    field as keyof typeof filters.location,
                                    suggestion
                                  );
                                  if (field === "area") {
                                    setAreaSuggestions([]);
                                  } else {
                                    setCitySuggestions([]);
                                  }
                                }}
                                className="px-2 py-1.5 hover:bg-accent text-xs cursor-pointer"
                              >
                                {suggestion}
                              </Command.Item>
                            ))}
                          </Command.List>
                        </Command>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Water Availability */}
          <div className="space-y-4">
            <Label>Water Availability</Label>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Availability
              </Label>
              <Select
                value={filters.waterAvailability}
                onValueChange={handleWaterAvailabilityChange}
              >
                <SelectTrigger className="w-full dark:bg-zinc-900">
                  <SelectValue placeholder="Select availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24_7">24/7</SelectItem>
                  <SelectItem value="scheduled_daily">
                    Scheduled Daily
                  </SelectItem>
                  <SelectItem value="scheduled_weekly">
                    Scheduled Weekly
                  </SelectItem>
                  <SelectItem value="irregular">Irregular</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Applied Filters */}
          <div className="space-y-2">
            <Label>Applied Filters</Label>
            <div className="flex flex-wrap gap-2">
              {getAppliedFilters().map((filter) => (
                <Badge
                  key={filter.id}
                  variant="secondary"
                  className="dark:bg-zinc-800 font-medium text-sm py-1.5 px-3"
                >
                  {filter.label}
                </Badge>
              ))}
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              variant="outline"
              className="w-full dark:bg-zinc-900 dark:hover:bg-zinc-800"
              onClick={handleReset}
              disabled={isLoading}
            >
              Reset
            </Button>
            <Button
              className="w-full"
              onClick={async () => {
                setIsLoading(true);
                try {
                  // Build the search params
                  const params = new URLSearchParams();

                  if (filters.propertyType) {
                    params.set("type", filters.propertyType);
                  }

                  if (filters.bedrooms) {
                    params.set("bedrooms", filters.bedrooms);
                  }

                  if (filters.bathrooms) {
                    params.set("bathrooms", filters.bathrooms);
                  }

                  if (filters.priceRange[1] < 100000) {
                    params.set("maxPrice", filters.priceRange[1].toString());
                  }
                  if (filters.priceRange[0] > 0) {
                    params.set("minPrice", filters.priceRange[0].toString());
                  }

                  // Handle amenities
                  const activeAmenities = Object.entries(filters.amenities)
                    .filter(([, value]) => value)
                    .map(([key]) => key);
                  if (activeAmenities.length > 0) {
                    params.set("amenities", activeAmenities.join(","));
                  }

                  if (filters.waterAvailability) {
                    params.set("water", filters.waterAvailability);
                  }

                  // Handle location
                  Object.entries(filters.location).forEach(([key, value]) => {
                    if (value) {
                      params.set(`location_${key}`, value);
                    }
                  });

                  setSearchParams(params);
                  // Close the dialog after successful submission
                  setOpen(false);
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                "Apply Filters"
              )}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showScrollButton && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
            >
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg dark:bg-zinc-800 dark:hover:bg-zinc-700"
                onClick={scrollToBottom}
              >
                <ArrowDown className="h-5 w-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default FilterModal;
