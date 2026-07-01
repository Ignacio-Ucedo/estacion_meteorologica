type InlineErrorProps = {
  message: string;
  onRetry?: () => void;
};

export function InlineError({ message, onRetry }: InlineErrorProps) {
  return (
    <div className="inline-error" role="alert">
      <svg className="inline-error-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
        <line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="16.5" r="1" fill="currentColor" />
      </svg>
      <p className="inline-error-message">{message}</p>
      {onRetry && (
        <button className="inline-error-retry" type="button" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
