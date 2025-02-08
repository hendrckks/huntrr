const Home = () => {
  return (
    <div className="min-h-screen p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Welcome back!</h1>
        <p className="text-gray-600">Here's an overview of your financial activity</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card Summary */}
        <div className="bg-white text-black dark:bg-inherit dark:text-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Active Cards</h3>
          <div className="flex items-center justify-between">
            <span className="text-3xl font-semibold">6</span>
            <span className="text-sm text-gray-500">Total Cards</span>
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="bg-white dark:bg-inherit dark:text-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Recent Transactions</h3>
          <div className="flex items-center justify-between">
            <span className="text-3xl font-semibold">24</span>
            <span className="text-sm text-gray-500">This Week</span>
          </div>
        </div>

        {/* Spend Summary */}
        <div className="bg-white dark:bg-inherit dark:text-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-medium mb-4">Total Spend</h3>
          <div className="flex items-center justify-between">
            <span className="text-3xl font-semibold">$12,450</span>
            <span className="text-sm text-gray-500">This Month</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
