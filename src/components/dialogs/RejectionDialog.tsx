import * as React from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

export const rejectionReasons = [
  {
    value: "inappropriate_content",
    label: "Inappropriate or misleading content",
  },
  {
    value: "incomplete_information",
    label: "Incomplete or inaccurate information",
  },
  {
    value: "poor_quality_photos",
    label: "Poor quality or insufficient photos",
  },
  {
    value: "policy_violation",
    label: "Violation of listing policies",
  },
] as const;

export type RejectionReason = (typeof rejectionReasons)[number]["value"];

interface RejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: RejectionReason) => void;
}

export function RejectionDialog({
  open,
  onOpenChange,
  onConfirm,
}: RejectionDialogProps) {
  const [selectedReason, setSelectedReason] = React.useState<RejectionReason>();

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Listing</DialogTitle>
            <DialogDescription>
              Please select a reason for rejecting this listing.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Select
                value={selectedReason}
                onValueChange={(value: RejectionReason) =>
                  setSelectedReason(value)
                }
              >
                <SelectTrigger id="reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {rejectionReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!selectedReason}
            >
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </motion.div>
    </Dialog>
  );
}