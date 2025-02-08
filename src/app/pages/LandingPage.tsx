import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#637257] to-[#4b5942] flex flex-col items-center justify-center text-white px-4">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
          Find Your Perfect Home
        </h1>
        <p className="text-xl md:text-2xl text-gray-200 max-w-2xl mx-auto">
          Connect with verified landlords and discover your ideal living space.
        </p>
        <div className="mt-10">
          <Link
            to="/app"
            className="bg-white text-[#4b5942] px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-100 transition-colors duration-200 inline-block"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;