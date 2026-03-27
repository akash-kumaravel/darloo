import * as React from 'react';
import { Heart, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const state = (this as any).state;
    const props = (this as any).props;

    if (state.hasError) {
      let errorDetails = null;
      try {
        if (state.error?.message) {
          errorDetails = JSON.parse(state.error.message);
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center cinematic-gradient p-6 text-center">
          <div className="relative mb-8">
            <Heart className="w-20 h-20 text-primary fill-primary/20 animate-pulse" />
            <div className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg">
              <RefreshCw className="w-5 h-5 text-red-500" />
            </div>
          </div>
          
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter mb-4 uppercase">
            Something went wrong
          </h1>
          
          <p className="text-slate-500 max-w-md mb-8 font-medium">
            {errorDetails ? (
              `A connection error occurred while ${errorDetails.operationType}ing ${errorDetails.path || 'data'}.`
            ) : (
              "The loveverse encountered a small glitch. Don't worry, your progress is safe."
            )}
          </p>

          <button
            onClick={() => window.location.reload()}
            className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Restart starfall
          </button>

          {errorDetails && (
            <div className="mt-12 p-4 bg-black/5 rounded-xl text-[10px] font-mono text-slate-400 max-w-xs overflow-hidden text-ellipsis">
              Error: {errorDetails.error}
            </div>
          )}
        </div>
      );
    }

    return props.children;
  }
}
