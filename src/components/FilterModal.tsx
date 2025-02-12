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

const FilterModal = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="dark:bg-white/5 bg-background/50 dark:hover:bg-white/10 dark:border-white/10"
        >
          <Filter className="h-4 w-4 " />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] dark:bg-[#121212]">
        <DialogHeader>
          <DialogTitle>Filter Properties</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 dark:bg-[#121212]">
          {/* Price Range */}
          <div className="space-y-2">
            <Label>Price Range (KSh)</Label>
            <div className="pt-2">
              <Slider
                defaultValue={[0, 100000]}
                max={100000}
                step={1000}
                className="w-full"
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>KSh 0</span>
              <span>KSh 100,000</span>
            </div>
          </div>

          {/* Property Type */}
          <div className="space-y-2">
            <Label>Property Type</Label>
            <Select>
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
              <Select>
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
              <Select>
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
                <Checkbox id="security" />
                <label htmlFor="security" className="text-sm">
                  Security Guard
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="cctv" />
                <label htmlFor="cctv" className="text-sm">
                  CCTV
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="parking" />
                <label htmlFor="parking" className="text-sm">
                  Secure Parking
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="pets" />
                <label htmlFor="pets" className="text-sm">
                  Pets Allowed
                </label>
              </div>
            </div>
          </div>

          {/* Water Availability */}
          <div className="space-y-2">
            <Label>Water Availability</Label>
            <Select>
              <SelectTrigger className="w-full dark:bg-zinc-900">
                <SelectValue placeholder="Select availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24_7">24/7</SelectItem>
                <SelectItem value="scheduled_daily">Scheduled Daily</SelectItem>
                <SelectItem value="scheduled_weekly">
                  Scheduled Weekly
                </SelectItem>
                <SelectItem value="irregular">Irregular</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Applied Filters */}
          <div className="space-y-2">
            <Label>Applied Filters</Label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="dark:bg-zinc-800">
                2 Bedrooms
              </Badge>
              <Badge variant="secondary" className="dark:bg-zinc-800">
                Under KSh 50,000
              </Badge>
              <Badge variant="secondary" className="dark:bg-zinc-800">
                Apartment
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              variant="outline"
              className="w-full dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              Reset
            </Button>
            <Button className="w-full">Apply Filters</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilterModal;
