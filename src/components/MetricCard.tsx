import React from 'react';
import { Card, CardContent } from './ui/card';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import NumberFlow from "@number-flow/react";

interface MetricCardProps {
  title: string;
  value: number;
  growth?: number;
  storageKey?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, growth, storageKey }) => {
  const isPositive = growth !== undefined && growth >= 0;
  
  React.useEffect(() => {
    if (storageKey && value !== undefined) {
      const now = Date.now();
      const ONE_HOUR = 3600000;
      const stored = localStorage.getItem(storageKey);
      const previousData = stored ? JSON.parse(stored) : { value: 0, timestamp: 0 };
      
      if (!previousData.timestamp || now - previousData.timestamp > ONE_HOUR) {
        localStorage.setItem(storageKey, JSON.stringify({
          value,
          timestamp: now
        }));
      }
    }
  }, [value, storageKey]);

  return (
    <Card className="border">
      <CardContent className="p-4">
        <div className="text-sm font-medium text-gray-600 dark:text-white">
          {title}
        </div>
        <div className="flex items-baseline gap-3 mt-1">
          <div className="text-2xl font-bold font-sans text-gray-900 dark:text-white">
            <NumberFlow value={value} />
          </div>
          {growth !== undefined && (
            <div className={`flex items-center text-[10px] font-medium rounded-md px-2 py-1 cursor-pointer ${isPositive ? 'text-green-600 bg-green-100/70 dark:bg-green-100/10' : 'text-red-600 bg-red-100/70'}`}>
              {isPositive ? (
                <ArrowUpIcon className="h-3 w-3" />
              ) : (
                <ArrowDownIcon className="h-4 w-4" />
              )}
              <span>{Math.abs(growth).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricCard;