'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock } from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase/config';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        // Note: we can optionally update the profile with the 'name' here using updateProfile
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ===== LEFT PANEL ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px', background: 'var(--white)', maxWidth: 560 }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 48 }}>
          <div style={{ width: 32, height: 32, background: 'var(--cyan)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'var(--dark)', fontWeight: 900, fontSize: 16 }}>⚡</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-primary)' }}>SMARTFLOW</span>
        </Link>

        <div className="animate-fade-in">
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8 }}>
            {isSignUp ? 'Create your account.' : 'Welcome back.'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 36, fontSize: 15 }}>
            {isSignUp
              ? 'Join 1M+ fans and experience smarter stadium visits.'
              : 'Access your personalized stadium guide and real-time insights.'}
          </p>

          {error && (
            <div style={{ background: '#FEF2F2', color: 'var(--danger)', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 24, border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {isSignUp && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. James Wilson"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-with-icon">
                <Mail size={14} className="input-icon" />
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>Password</label>
                {!isSignUp && <Link href="#" style={{ fontSize: 13, color: 'var(--cyan-dark)', fontWeight: 500 }}>Forgot password?</Link>}
              </div>
              <div className="input-with-icon">
                <Lock size={14} className="input-icon" />
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-full" style={{ marginTop: 8, borderRadius: 'var(--radius-md)', padding: '14px' }}>
              {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
            {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
            <button onClick={() => { setIsSignUp(!isSignUp); setError(null); }} style={{ color: 'var(--cyan-dark)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>
              {isSignUp ? 'Sign in' : 'Create one for free'}
            </button>
          </p>

          <div className="divider" style={{ margin: '32px 0' }}>OR CONTINUE WITH</div>

          {/* Social buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            <button onClick={signInWithGoogle} disabled={loading} className="btn btn-outline btn-full" style={{ borderRadius: 'var(--radius-md)', padding: '13px 20px', justifyContent: 'center', gap: 10, fontSize: 14 }}>
              <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.48h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
              Continue with Google
            </button>
          </div>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            By continuing, you agree to SmartFlow&apos;s{' '}
            <Link href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Terms of Service</Link>{' '}
            and{' '}
            <Link href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>Privacy Policy</Link>.
          </p>
        </div>
      </div>

      {/* ===== RIGHT PANEL ===== */}
      <div style={{
        flex: 1,
        position: 'relative',
        background: 'var(--dark-2)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflow: 'hidden',
      }}>
        <img
          src="https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=900&q=80"
          alt="Stadium"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
        />
        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 40%, rgba(0,0,0,0.2) 100%)' }} />

        {/* Floating tag */}
        <div style={{ position: 'absolute', top: 32, right: 32, background: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ width: 28, height: 28, background: 'var(--cyan-soft)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan-dark)' }}>↗</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Gate B is clear</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Recommended entry route</div>
          </div>
        </div>

        {/* Bottom content */}
        <div style={{ position: 'relative', padding: '40px 48px', color: 'white' }}>
          <h2 style={{ fontSize: 42, fontWeight: 900, lineHeight: 1.1, marginBottom: 16 }}>
            Your stadium,{' '}
            <span style={{ color: 'var(--cyan)' }}>smarter.</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', marginBottom: 40, lineHeight: 1.6, maxWidth: 420 }}>
            Join 50,000+ fans using real-time crowd intelligence to skip the queues and focus on the game.
          </p>
          <div style={{ display: 'flex', gap: 32 }}>
            {[
              { value: '12min', label: 'AVG. TIME SAVED' },
              { value: '98%', label: 'ENTRY ACCURACY' },
              { value: '0s', label: 'ROUTING DELAY' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--cyan)' }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
