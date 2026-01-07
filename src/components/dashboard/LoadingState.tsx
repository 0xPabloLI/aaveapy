const LoadingState = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-muted animate-spin border-t-primary border-r-secondary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xl font-bold gradient-text">A</span>
          </div>
        </div>
        <p className="mt-4 text-muted-foreground animate-pulse">Loading markets...</p>
      </div>
    </div>
  );
};

export default LoadingState;
