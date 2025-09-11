export default function WindowControls() {
  return (
    <div className="h-7 bg-dark-surface flex items-center justify-end px-2 border-b border-dark-border">
      <div className="flex gap-2">
        <div 
          className="w-3 h-3 rounded-full bg-gray-600 cursor-pointer" 
          data-testid="minimize-button"
        />
        <div 
          className="w-3 h-3 rounded-full bg-red-primary cursor-pointer" 
          data-testid="close-button"
        />
      </div>
    </div>
  );
}
