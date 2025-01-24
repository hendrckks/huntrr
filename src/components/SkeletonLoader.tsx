import React from "react";

const SkeletonLoader: React.FC = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-300 rounded w-3/4 mb-4"></div>
    <div className="h-4 bg-gray-300 rounded w-1/2"></div>
  </div>
);

export default SkeletonLoader;
