'use client';

import { motion } from 'framer-motion';

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center pt-4 pb-2"
    >
      <div className="flex items-center justify-center gap-3 mb-3">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="text-3xl"
        >
          ✦
        </motion.div>
        <h1
          className="gradient-text text-4xl md:text-5xl font-black tracking-widest uppercase"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Stellar Faucet
        </h1>
        <motion.div
          animate={{ rotate: [360, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="text-3xl"
        >
          ✦
        </motion.div>
      </div>
      <p
        className="text-sm tracking-widest uppercase"
        style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}
      >
        Soroban Smart Contract · Testnet · Rate Limited
      </p>

      {/* Network badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full text-xs"
        style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: '#10b981',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: '#10b981',
            boxShadow: '0 0 6px #10b981',
            animation: 'pulse 2s infinite',
          }}
        />
        TESTNET ACTIVE
      </motion.div>
    </motion.header>
  );
}
