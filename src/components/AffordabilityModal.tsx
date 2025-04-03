import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import NumberFlow from "@number-flow/react";

interface AffordabilityState {
  monthlyIncome: number;
  existingDebt: number;
  householdSize: number;
  location: string;
  utilityPercentage: number;
  insuranceCost: number;
  savingsGoal: number;
}

const AffordabilityModal = () => {
  const [, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [affordability, setAffordability] = useState<AffordabilityState>({
    monthlyIncome: 50000, // Default values in KES
    existingDebt: 0,
    householdSize: 1,
    location: "",
    utilityPercentage: 0, // Optional: percentage for utilities
    insuranceCost: 0, // Optional: insurance cost
    savingsGoal: 0, // Optional: monthly savings goal
  });

  // Calculate maximum affordable rent based on comprehensive factors
  const calculateAffordableRent = () => {
    const disposableIncome =
      affordability.monthlyIncome -
      affordability.existingDebt -
      affordability.savingsGoal;

    // Calculate total housing budget (30% rule)
    const housingBudget = disposableIncome * 0.3;

    // Deduct estimated utilities and insurance
    const utilityEstimate =
      (housingBudget * affordability.utilityPercentage) / 100;
    const totalDeductions = utilityEstimate + affordability.insuranceCost;

    // Calculate base rent
    const baseRent = housingBudget - totalDeductions;

    // Adjust based on household size
    const householdAdjustment = 1 - (affordability.householdSize - 1) * 0.1;
    const adjustedRent = baseRent * Math.max(householdAdjustment, 0.6);

    return Math.max(adjustedRent, 0);
  };

  const handleClearFilters = () => {
    setAffordability({
      monthlyIncome: 50000,
      existingDebt: 0,
      householdSize: 1,
      location: "",
      utilityPercentage: 0,
      insuranceCost: 0,
      savingsGoal: 0,
    });
    setSearchParams((prev) => {
      prev.delete("maxPrice");
      return prev;
    });
  };

  const handleApplyFilters = () => {
    const maxRent = calculateAffordableRent();
    setSearchParams((prev) => {
      prev.set("maxPrice", maxRent.toString());
      return prev;
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          variant="outline"
          className="inline-flex dark:bg-white/5 md:bg-background/50 bg-white/10 dark:hover:bg-white/10 md:hover:bg-black/5 hover:bg-white/15 transition-colors dark:border-white/10 p-4 md:rounded-lg rounded-md md:shadow-lg shadow-md backdrop-blur-6xl items-center justify-center whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border hover:text-accent-foreground px-4 sm:px-8 dark:text-white md:border-black/15 border-white/20 gap-2 md:w-auto w-full"
        >
          <span>Affordability Calculator</span>
          <kbd className="hidden md:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-base">⌘</span>A
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[96vh] overflow-y-auto rounded-2xl font-inter">
        <DialogHeader className="border-b border-b-black/20">
          <DialogTitle className="text-center mb-5">RentAbility</DialogTitle>
        </DialogHeader>
        <h2 className="text-lg tracking-tight font-bold">
          Renting a home is a big move. We're here to help you every step of the
          way.
        </h2>
        <p className="tracking-tight text-sm dark:text-white/80">
          Let's figure out what you can afford and track how it changes over
          time. If you're not sure of something, it's okay to take your best
          guess.
        </p>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="monthlyIncome">Monthly Income (KES)</Label>
            <Input
              id="monthlyIncome"
              type="number"
              value={affordability.monthlyIncome}
              onChange={(e) =>
                setAffordability((prev) => ({
                  ...prev,
                  monthlyIncome: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="existingDebt">Monthly Debt Payments (KES)</Label>
            <Input
              id="existingDebt"
              type="number"
              value={affordability.existingDebt}
              onChange={(e) =>
                setAffordability((prev) => ({
                  ...prev,
                  existingDebt: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Household Size</Label>
            <Slider
              value={[affordability.householdSize]}
              min={1}
              max={10}
              step={1}
              onValueChange={(value) =>
                setAffordability((prev) => ({
                  ...prev,
                  householdSize: value[0],
                }))
              }
            />
            <span className="text-sm text-gray-500 mt-1">
              {affordability.householdSize}{" "}
              {affordability.householdSize === 1 ? "person" : "people"}
            </span>
          </div>
          <div className="grid gap-2">
            <Label className="text-lg">
              How much do you expect to spend on utilities?
              <span className="text-gray-500 dark:text-white/70 text-xs ml-1">(optional)</span>
            </Label>
            <p className="text-sm text-gray-500 dark:text-white/70 mb-2">
              Utilities typically range from 5-20% of rent, including water,
              electricity, and internet.
            </p>
            <Slider
              value={[affordability.utilityPercentage]}
              min={5}
              max={20}
              step={1}
              onValueChange={(value) =>
                setAffordability((prev) => ({
                  ...prev,
                  utilityPercentage: value[0],
                }))
              }
            />
            <span className="text-sm text-gray-500 mt-1">
              {affordability.utilityPercentage}% of rent
            </span>
          </div>
          <div className="grid gap-2">
            <Label className="text-lg">
              Do you have any monthly insurance payments?
              <span className="text-gray-500 dark:text-white/70 text-xs ml-1">(optional)</span>
            </Label>
            <p className="text-sm text-gray-500 dark:text-white/70 mb-2">
              Include rental insurance or any other property-related insurance
              costs.
            </p>
            <Input
              type="number"
              value={affordability.insuranceCost}
              onChange={(e) =>
                setAffordability((prev) => ({
                  ...prev,
                  insuranceCost: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-lg">
              What's your target monthly savings?
              <span className="text-gray-500 dark:text-white/70 text-xs ml-1">(optional)</span>
            </Label>
            <p className="text-sm text-gray-500 dark:text-white/70 mb-2">
              Setting aside money for future goals helps in better financial
              planning.
            </p>
            <Input
              type="number"
              value={affordability.savingsGoal}
              onChange={(e) =>
                setAffordability((prev) => ({
                  ...prev,
                  savingsGoal: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="pt-4">
            <div className="bg-black/5 dark:bg-white/5 p-8 rounded-lg">
              <h4 className="font-medium mb-2">Maximum Affordable Rent</h4>
              <p className="text-3xl font-bold text-purple-700 dark:text-purple-500">
                KES <NumberFlow value={calculateAffordableRent()} />
                /month
              </p>
              <p className="text-xs text-gray-500 dark:text-white/70 mt-2">
                Based on the 30% rule and your household factors
              </p>
            </div>
          </div>
          <Button onClick={handleApplyFilters} className="mt-4 w-full">
            Apply to Search
          </Button>
          <Button
            variant="outline"
            onClick={handleClearFilters}
            className="w-full border -mt-2 border-black/20 dark:border-white/20"
          >
            Clear filters
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AffordabilityModal;
