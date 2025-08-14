import React from 'react';
import { Card, CardContent } from './ui/card';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import NumberFlow from "@number-flow/react";

interface MetricCardProps {
  title: string;
  value: number;
  growth?: number;
  storageKey?: string;
  last24h?: number;
  last24hLabel?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, growth, storageKey, last24h, last24hLabel }) => {
  const isPositive = growth !== undefined && growth >= 0;
  const show24h = typeof last24h === 'number';
  
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
        <div className="text-base font-medium text-black dark:text-white">
          {title}
        </div>
        <div className="flex items-center mt-4 gap-6">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            <NumberFlow value={value} />
          </div>
          {show24h ? (
            <div className={`flex items-center text-xs shadow-sm font-medium rounded-lg px-2.5 py-0.5 backdrop-blur-3xl border ${(last24h as number) >= 0 ? 'bg-green-100/30 dark:bg-green-500/10 border-green-200/50 dark:border-green-500/50' : 'bg-red-100/30 dark:bg-red-500/10 border-red-200/30 dark:border-red-500/20'}`}>
              <span className={`whitespace-nowrap gap-1.5 flex items-center font-semibold ${(last24h as number) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                <NumberFlow 
                  value={last24h as number} 
                  className="text-xs"
                /> {last24hLabel || 'In the last 24 hours'}
              </span>
            </div>
          ) : (
            growth !== undefined && (
              <div className={`flex items-center text-[10px] font-medium rounded-md px-2 py-1 cursor-pointer ${isPositive ? 'text-green-600 bg-green-100/70 dark:bg-green-100/10' : 'text-red-600 bg-red-100/70'}`}>
                {isPositive ? (
                  <ArrowUpIcon className="h-3 w-3" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4" />
                )}
                <span>{Math.abs(growth).toFixed(1)}%</span>
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricCard;