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
      md:px-20
      sm:px-40
      2xl:px-96
      xl:px-64
      py-4
      mx-auto
      w-[75vw]
      
   ${className}
    `}
    >
      {children}
    </div>
  );
};

export default Container;
