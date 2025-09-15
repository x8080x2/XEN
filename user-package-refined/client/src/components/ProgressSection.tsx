import { useEmailSender } from "@/hooks/useEmailSender";

export default function ProgressSection() {
  const { progress, logs } = useEmailSender();

  return (
    <div className="mt-6 p-4 bg-gray-900 rounded border border-dark-border">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold text-dark-text">Progress</span>
        <span className="text-xs text-dark-muted" data-testid="progress-text">
          {progress.sent} / {progress.total} sent
        </span>
      </div>
      
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div 
          className="progress-fill h-2 rounded-full transition-all duration-300" 
          style={{ width: `${progress.percentage}%` }}
          data-testid="progress-bar"
        />
      </div>
      
      <div className="mt-3 space-y-1 max-h-32 overflow-y-auto" data-testid="logs-container">
        {logs.length === 0 ? (
          <div className="text-xs text-dark-muted">No activity yet...</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="text-xs" data-testid={`log-${index}`}>
              <span className={log.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                [{log.timestamp}]
              </span>{' '}
              <span className="text-dark-muted">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
