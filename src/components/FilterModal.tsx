import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
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
import { Filter } from "lucide-react";

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
    neighborhood: string;
    city: string;
  };
}

const FilterModal = () => {
  const [showScrollButton, setShowScrollButton] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
        behavior: "smooth"
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
      neighborhood: "",
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

  const handleLocationChange = (field: keyof typeof filters.location, value: string) => {
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
        neighborhood: "",
        city: "",
      },
    });
  };

  const getAppliedFilters = () => {
    const applied = [];

    if (filters.propertyType) {
      applied.push({
        id: "propertyType",
        label: filters.propertyType.charAt(0).toUpperCase() + filters.propertyType.slice(1),
      });
    }

    if (filters.bedrooms) {
      applied.push({
        id: "bedrooms",
        label: `${filters.bedrooms} ${filters.bedrooms === "1" ? "Bedroom" : "Bedrooms"}`,
      });
    }

    if (filters.bathrooms) {
      applied.push({
        id: "bathrooms",
        label: `${filters.bathrooms} ${filters.bathrooms === "1" ? "Bathroom" : "Bathrooms"}`,
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
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="dark:bg-white/5 bg-background/50 dark:hover:bg-white/10 dark:border-white/10 h-10 w-10"
        >
          <Filter className="h-5 w-5 dark:text-muted-foreground text-black/50" />
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:max-w-[800px] max-h-[90vh] overflow-y-auto dark:bg-[#121212]  w-[95vw]" 
        ref={contentRef}
        onScroll={handleScroll}
      >
        <DialogHeader>
          <DialogTitle>Filter Properties</DialogTitle>
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
                className="w-full"
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
            <Select value={filters.propertyType} onValueChange={handlePropertyTypeChange}>
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
              <Select value={filters.bedrooms} onValueChange={handleBedroomsChange}>
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
              <Select value={filters.bathrooms} onValueChange={handleBathroomsChange}>
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

          {/* Location Filters */}
          <div className="space-y-2">
            <Label>Location</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Area</Label>
                <Select value={filters.location.area} onValueChange={(value) => handleLocationChange("area", value)}>
                  <SelectTrigger className="w-full dark:bg-zinc-900">
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="westlands">Westlands</SelectItem>
                    <SelectItem value="kilimani">Kilimani</SelectItem>
                    <SelectItem value="karen">Karen</SelectItem>
                    <SelectItem value="lavington">Lavington</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">City</Label>
                <Select value={filters.location.city} onValueChange={(value) => handleLocationChange("city", value)}>
                  <SelectTrigger className="w-full dark:bg-zinc-900">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nairobi">Nairobi</SelectItem>
                    <SelectItem value="mombasa">Mombasa</SelectItem>
                    <SelectItem value="kisumu">Kisumu</SelectItem>
                    <SelectItem value="nakuru">Nakuru</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Water Availability */}
          <div className="space-y-4">
            <Label>Water Availability</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Availability</Label>
                <Select value={filters.waterAvailability} onValueChange={handleWaterAvailabilityChange}>
                  <SelectTrigger className="w-full dark:bg-zinc-900">
                    <SelectValue placeholder="Select availability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24_7">24/7</SelectItem>
                    <SelectItem value="scheduled_daily">Scheduled Daily</SelectItem>
                    <SelectItem value="scheduled_weekly">Scheduled Weekly</SelectItem>
                    <SelectItem value="irregular">Irregular</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Area</Label>
                <Select value={filters.location.area} onValueChange={(value) => handleLocationChange("area", value)}>
                  <SelectTrigger className="w-full dark:bg-zinc-900">
                    <SelectValue placeholder="Select area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="westlands">Westlands</SelectItem>
                    <SelectItem value="kilimani">Kilimani</SelectItem>
                    <SelectItem value="karen">Karen</SelectItem>
                    <SelectItem value="lavington">Lavington</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">City</Label>
                <Select value={filters.location.city} onValueChange={(value) => handleLocationChange("city", value)}>
                  <SelectTrigger className="w-full dark:bg-zinc-900">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nairobi">Nairobi</SelectItem>
                    <SelectItem value="mombasa">Mombasa</SelectItem>
                    <SelectItem value="kisumu">Kisumu</SelectItem>
                    <SelectItem value="nakuru">Nakuru</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Applied Filters */}
          <div className="space-y-2">
            <Label>Applied Filters</Label>
            <div className="flex flex-wrap gap-2">
              {getAppliedFilters().map((filter) => (
                <Badge key={filter.id} variant="secondary" className="dark:bg-zinc-800 font-medium text-sm py-1.5 px-3">
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
            >
              Reset
            </Button>
            <Button className="w-full">Apply Filters</Button>
          </div>
        </div>

        <AnimatePresence>
          {showScrollButton && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
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
