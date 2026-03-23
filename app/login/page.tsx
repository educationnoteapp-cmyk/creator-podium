'use client';

// /login — Creator Podium sign-in page.
//
// Behaviour depends on site_settings.is_registration_open:
//
//   TRUE  (default) — normal Google OAuth for everyone.
//   FALSE (FOMO mode) — new-user registration is hidden; instead an
//         "Apply for Early Access" waitlist form is shown.
//         Existing users can still log in via a subtle "Already have access?" link.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { getSession, signInWithGoogle } from '@/lib/auth';

type WaitlistStatus = 'idle' | 'loading' | 'success' | 'already' | 'error';

export default function LoginPage() {
  const supabase = createClient();

  const [checking,          setChecking]          = useState(true);
  const [registrationOpen,  setRegistrationOpen]  = useState(true);
  const [signingIn,         setSigningIn]         = useState(false);
  const [authError,         setAuthError]         = useState<string | null>(null);

  // FOMO-mode state
  const [showSignIn,        setShowSignIn]        = useState(false); // existing-user escape hatch
  const [waitlistEmail,     setWaitlistEmail]     = useState('');
  const [waitlistStatus,    setWaitlistStatus]    = useState<WaitlistStatus>('idle');
  const [waitlistMsg,       setWaitlistMsg]       = useState('');

  // ── Surface ?error from OAuth callback ─────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('error')) setAuthError('Sign-in failed. Please try again.');
    }
  }, []);

  // ── Check session + fetch registration status ───────────────────────────
  useEffect(() => {
    async function init() {
      const session = await getSession();
      if (session) {
        window.location.href = '/dashboard';
        return;
      }

      // Fetch is_registration_open from site_settings (no auth required)
      const { data } = await supabase
        .from('site_settings')
        .select('is_registration_open')
        .eq('id', 1)
        .single();

      setRegistrationOpen(data?.is_registration_open ?? true);
      setChecking(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Google sign-in ──────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch {
      setAuthError('Failed to start sign-in. Please try again.');
      setSigningIn(false);
    }
  };

  // ── Waitlist submit ─────────────────────────────────────────────────────
  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = waitlistEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWaitlistMsg('Please enter a valid email address.');
      setWaitlistStatus('error');
      return;
    }

    setWaitlistStatus('loading');
    const { error } = await supabase.from('waitlist').insert({ email });

    if (!error) {
      setWaitlistStatus('success');
      setWaitlistMsg("You're on the list! We'll be in touch 👑");
      return;
    }

    // Unique-violation → already on the list
    if (error.code === '23505') {
      setWaitlistStatus('already');
      setWaitlistMsg("You're already on the list!");
      return;
    }

    setWaitlistStatus('error');
    setWaitlistMsg('Something went wrong. Please try again.');
  };

  // ── Loading / session check ─────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <motion.div
          className="w-8 h-8 border-2 border-slate-700 border-t-indigo-500 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  // ── Shared Google button ────────────────────────────────────────────────
  const GoogleButton = () => (
    <motion.button
      onClick={handleGoogleSignIn}
      disabled={signingIn}
      className="w-full flex items-center justify-center gap-3 px-6 py-4
                 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-base
                 rounded-2xl transition-colors duration-150
                 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_32px_rgba(0,0,0,0.5)]
                 disabled:opacity-60 disabled:cursor-not-allowed"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {signingIn ? (
        <>
          <motion.div
            className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
          />
          <span className="text-slate-500">Redirecting to Google…</span>
        </>
      ) : (
        <>
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </>
      )}
    </motion.button>
  );

  // ── FOMO Mode: registration closed ─────────────────────────────────────
  if (!registrationOpen) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[400px]
                          rounded-full bg-yellow-500/8 blur-[120px]" />
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[300px]
                          rounded-full bg-indigo-600/6 blur-[100px]" />
        </div>

        <motion.div
          className="relative z-10 w-full max-w-sm text-center space-y-8"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Crown + headline */}
          <div className="space-y-4">
            <motion.div
              className="text-6xl block"
              animate={{
                filter: [
                  'drop-shadow(0 0 8px rgba(255,215,0,0.35))',
                  'drop-shadow(0 0 24px rgba(255,215,0,0.7))',
                  'drop-shadow(0 0 8px rgba(255,215,0,0.35))',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              👑
            </motion.div>

            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">
                Creator Podium
              </h1>
              <p className="text-slate-400 mt-2 text-base font-medium">
                Exclusive Early Access
              </p>
            </div>

            <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
              We&apos;re invite-only right now. Drop your email and we&apos;ll
              reach out when a spot opens up.
            </p>
          </div>

          {/* Waitlist form */}
          <AnimatePresence mode="wait">
            {waitlistStatus === 'success' || waitlistStatus === 'already' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`px-5 py-4 rounded-2xl border text-sm font-semibold
                  ${waitlistStatus === 'success'
                    ? 'bg-yellow-400/8 border-yellow-400/30 text-yellow-300'
                    : 'bg-indigo-500/8 border-indigo-400/30 text-indigo-300'
                  }`}
              >
                {waitlistMsg}
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleWaitlistSubmit}
                className="space-y-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <input
                  type="email"
                  value={waitlistEmail}
                  onChange={(e) => {
                    setWaitlistEmail(e.target.value);
                    setWaitlistStatus('idle');
                  }}
                  placeholder="your@email.com"
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white
                             placeholder:text-slate-600 rounded-2xl px-5 py-4 text-base
                             focus:outline-none focus:border-yellow-400/50
                             focus:shadow-[0_0_0_3px_rgba(250,204,21,0.08)]
                             transition-all"
                />

                <AnimatePresence>
                  {waitlistStatus === 'error' && (
                    <motion.p
                      key="err"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-red-400 text-sm text-left px-1"
                    >
                      {waitlistMsg}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={waitlistStatus === 'loading'}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl
                             font-extrabold text-slate-950 text-base transition-all
                             disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(90deg, #FFD700, #FFED4A)' }}
                  whileHover={{ scale: 1.02, boxShadow: '0 0 28px rgba(255,215,0,0.35)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  {waitlistStatus === 'loading' ? (
                    <>
                      <motion.span
                        className="w-4 h-4 border-2 border-slate-700 border-t-slate-900 rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                      />
                      Joining…
                    </>
                  ) : (
                    'Apply for Early Access 👑'
                  )}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Existing-user escape hatch */}
          <div className="pt-2">
            {!showSignIn ? (
              <motion.button
                onClick={() => setShowSignIn(true)}
                className="text-xs text-slate-600 hover:text-slate-400 transition-colors underline
                           underline-offset-2 py-3 px-4 min-h-[44px] inline-flex items-center"
                whileHover={{ scale: 1.02 }}
              >
                Already have access? Sign in
              </motion.button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <p className="text-xs text-slate-500 mb-2">Sign in with your existing account:</p>
                <GoogleButton />
                <AnimatePresence>
                  {authError && (
                    <motion.p
                      key="auth-error"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-red-400 text-sm bg-red-950/50 border border-red-800/40
                                 rounded-xl px-4 py-3"
                    >
                      {authError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Normal Mode: registration open ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px]
                        rounded-full bg-indigo-600/10 blur-[130px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[300px]
                        rounded-full bg-violet-600/8 blur-[100px]" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm text-center space-y-10"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Crown + tagline */}
        <div className="space-y-4">
          <motion.div
            className="text-7xl block"
            animate={{
              filter: [
                'drop-shadow(0 0 8px rgba(255,215,0,0.35))',
                'drop-shadow(0 0 24px rgba(255,215,0,0.7))',
                'drop-shadow(0 0 8px rgba(255,215,0,0.35))',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            👑
          </motion.div>

          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">
              Creator Podium
            </h1>
            <p className="text-slate-400 mt-2 text-lg font-medium">
              Own the Podium 👑
            </p>
          </div>

          <p className="text-slate-600 text-sm max-w-xs mx-auto leading-relaxed">
            Connect your Stripe, set your slug, and let fans compete
            for the top spot — live.
          </p>
        </div>

        {/* Google button + error */}
        <div className="space-y-4">
          <GoogleButton />

          <AnimatePresence>
            {authError && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-400 text-sm bg-red-950/50 border border-red-800/40
                           rounded-xl px-4 py-3"
              >
                {authError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <p className="text-slate-700 text-xs leading-relaxed">
          By signing in you agree to our terms of service.
          Fan-facing podium pages are always publicly accessible.
        </p>
      </motion.div>
    </div>
  );
}
