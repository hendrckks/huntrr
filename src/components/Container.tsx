import { ReactNode } from "react";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

const Container = ({ children, className = "" }: ContainerProps) => {
  return (
    <div
      className={`
      px-2
      py-4
      mx-auto      
   ${className}
    `}
    >
      {children}
    </div>
  );
};

export default Container;
