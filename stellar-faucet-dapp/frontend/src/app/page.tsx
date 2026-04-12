import { FaucetApp } from '@/components/FaucetApp';
import { StarField } from '@/components/StarField';

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden">
      {/* Animated star background */}
      <StarField />

      {/* Grid overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(52,97,245,1) 1px, transparent 1px), linear-gradient(90deg, rgba(52,97,245,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-8">
        <FaucetApp />
      </div>
    </main>
  );
}
