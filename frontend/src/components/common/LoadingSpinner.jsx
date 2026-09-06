const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-900">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-surface-700 rounded-full animate-spin border-t-primary-500"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-spin border-b-primary-400" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
        </div>
        <p className="text-surface-400 text-sm font-medium animate-pulse">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
