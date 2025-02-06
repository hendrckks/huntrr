import React from "react";

const SpinningLoader: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full w-full">
      <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default SpinningLoader; 