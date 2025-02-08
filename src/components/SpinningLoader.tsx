import React from "react";

const SpinningLoader: React.FC = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default SpinningLoader; 