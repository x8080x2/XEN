export default function WindowControls() {
  const handleMinimize = () => {
    if (window.electron?.minimize) {
      window.electron.minimize();
    }
  };

  const handleClose = () => {
    if (window.electron?.close) {
      window.electron.close();
    }
  };

  return (
    <div className="h-7 bg-dark-surface flex items-center justify-end px-2 border-b border-dark-border">
      <div className="flex gap-2">
        <div 
          className="w-3 h-3 rounded-full bg-gray-600 hover:bg-gray-500 cursor-pointer transition-colors" 
          onClick={handleMinimize}
          data-testid="minimize-button"
        />
        <div 
          className="w-3 h-3 rounded-full bg-red-primary hover:bg-red-700 cursor-pointer transition-colors" 
          onClick={handleClose}
          data-testid="close-button"
        />
      </div>
    </div>
  );
}
