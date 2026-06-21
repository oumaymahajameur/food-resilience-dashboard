"use client";

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-blue-400">Hors ligne</h1>
        <p className="text-slate-400">
          Vérifiez votre connexion internet et réessayez.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}