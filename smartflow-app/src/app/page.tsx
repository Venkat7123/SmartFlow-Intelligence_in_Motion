'use client';
import Link from 'next/link';
import { Zap, ArrowRight, Play, TrendingUp, Navigation, UtensilsCrossed, Clock, Star, MessageCircle, Camera, Share2, Briefcase, ChevronRight, Mail, Phone, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const features = [
  {
    icon: TrendingUp,
    title: 'Crowd Intelligence',
    desc: 'Real-time heatmaps and density sensors tell you exactly where the crowd is moving before you get there.',
    tag: 'Real-time',
  },
  {
    icon: Navigation,
    title: 'Smart Routing',
    desc: 'Turn-by-turn 3D navigation inside the stadium. Find your seat, toilets, or shops via the shortest path.',
    tag: null,
  },
  {
    icon: UtensilsCrossed,
    title: 'Seamless Pre-Order',
    desc: "Order food and merch from your seat. We'll alert you when it's ready for quick pickup at the nearest stand.",
    tag: null,
  },
  {
    icon: Clock,
    title: 'Gate Predictions',
    desc: 'AI-powered arrival windows. Know exactly which gate to enter for the fastest access to your section.',
    tag: 'AI-Powered',
  },
];

const stats = [
  { value: '45+', label: 'Stadiums Partnered' },
  { value: '40%', label: 'Wait Time Reduced' },
  { value: '4.9', label: 'App Store Rating' },
  { value: '1.2M', label: 'Monthly Active Users' },
];

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)' }}>
      {/* ========== TOP NAV ========== */}
      <nav className="topnav">
        <Link href="/" className="topnav-logo">
          <div className="logo-icon">
            <Zap size={16} fill="currentColor" />
          </div>
          SMARTFLOW
        </Link>
        <ul className="topnav-links">
          <li><Link href="#features">Features</Link></li>
          <li><Link href="#testimonial">About</Link></li>
          <li><Link href="#contact">Contact Us</Link></li>
        </ul>
        <div className="topnav-actions">
          {!loading && user ? (
            <Link href="/dashboard" className="btn btn-primary btn-sm">Go to Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-outline btn-sm">Sign In</Link>
              <Link href="/login" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>
      </nav>

      {/* ========== HERO ========== */}
      <section style={{ paddingTop: 64, background: 'linear-gradient(135deg, #e0f7ff 0%, #f0fdff 50%, #e8f5e9 100%)', overflow: 'hidden' }}>
        <div className="container">
          <div className="hero-grid" style={{ alignItems: 'center', minHeight: 'calc(100vh - 64px)', padding: '60px 0' }}>
            {/* Left */}
            <div className="animate-fade-in hero-content">
              <span className="badge badge-cyan" style={{ marginBottom: 20, display: 'inline-flex' }}>
                🚀 NEW: 3D Heatmap Navigation 2.0
              </span>
              <h1 style={{ fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 20 }}>
                Your stadium,{' '}
                <span style={{ color: 'var(--cyan-dark)', fontStyle: 'italic' }}>smarter.</span>
              </h1>
              <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 480, lineHeight: 1.7 }}>
                Experience the game, not the queue. Real-time crowd intelligence and AI-powered routing designed for the modern fan.
              </p>
              <div className="btn-group" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 40 }}>
                {!loading && user ? (
                  <Link href="/dashboard" className="btn btn-primary btn-lg">
                    Go to Dashboard <ArrowRight size={18} />
                  </Link>
                ) : (
                  <Link href="/login" className="btn btn-primary btn-lg">
                    Get Started <ArrowRight size={18} />
                  </Link>
                )}
                <Link href="#contact" className="btn btn-outline btn-lg">
                  Contact Us
                </Link>
              </div>
              {/* Social proof */}
              <div className="social-proof" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex' }}>
                  {['photo-1472099645785-5658abf4ff4e', 'photo-1494790108377-be9c29b29330', 'photo-1507003211169-0a1dd7228f2d', 'photo-1438761681033-6461ffad8d80'].map((id, i) => (
                    <img
                      key={id}
                      src={`https://images.unsplash.com/${id}?w=50&q=80`}
                      alt=""
                      style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid white', marginLeft: i > 0 ? -8 : 0, objectFit: 'cover' }}
                    />
                  ))}
                </div>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>12k+</strong> fans navigating live right now
                </span>
              </div>
            </div>

            {/* Right – Mockup Card */}
            <div className="animate-slide-up" style={{ position: 'relative' }}>
              <div style={{
                borderRadius: 24, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.15)',
                background: '#111',
                transform: 'rotate(1deg)',
              }}>
                <img
                  src="https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800&q=80"
                  alt="Stadium aerial view"
                  style={{ width: '100%', height: 380, objectFit: 'cover', opacity: 0.85 }}
                />
              </div>

              {/* Floating pills */}
              <div className="card hero-pill-1" style={{ position: 'absolute', top: 20, left: -30, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Gate A Flow</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Optimal (2 min)</div>
                </div>
              </div>
              <div className="card hero-pill-2" style={{ position: 'absolute', bottom: 20, right: -20, padding: '10px 16px', minWidth: 160 }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Stands Capacity</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--surface-2)', borderRadius: 4 }}>
                    <div style={{ width: '88%', height: '100%', background: 'var(--cyan)', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>88%</span>
                </div>
              </div>
              {/* Live badge */}
              <div style={{
                position: 'absolute', top: 20, right: 20,
                background: 'rgba(239,68,68,0.9)', color: 'white',
                fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 4,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', display: 'inline-block' }} />
                LIVE HEATMAP
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== STATS BAR ========== */}
      <section style={{ background: 'var(--white)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div className="stats-grid">
            {stats.map((stat, i) => (
              <div key={stat.label} className="stat-item">
                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--text-primary)' }}>{stat.value}</div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== FEATURES ========== */}
      <section id="features" className="section">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 className="section-title">Built for the ultimate fan experience</h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 12, maxWidth: 520, margin: '12px auto 0' }}>
              No more guessing which gate is fastest or missing the kickoff because of a food queue. SmartFlow handles the logistics.
            </p>
          </div>
          <div className="grid-4">
            {features.map((f) => (
              <div key={f.title} className="card"
                style={{ padding: '28px 24px', position: 'relative', transition: 'all 0.2s', cursor: 'default' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = '';
                  (e.currentTarget as HTMLElement).style.boxShadow = '';
                }}
              >
                {f.tag && (
                  <span className="badge badge-cyan" style={{ position: 'absolute', top: 16, right: 16, fontSize: 9 }}>{f.tag}</span>
                )}
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--cyan-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: 'var(--cyan-dark)' }}>
                  <f.icon size={20} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== TESTIMONIAL ========== */}
      <section id="testimonial" style={{ background: 'var(--white)', padding: '80px 0' }}>
        <div className="container" style={{ maxWidth: 640, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 28, color: '#FACC15' }}>
            {[...Array(5)].map((_, i) => <Star key={i} size={20} fill="currentColor" />)}
          </div>
          <blockquote style={{ fontSize: 22, fontWeight: 500, lineHeight: 1.5, marginBottom: 32, color: 'var(--text-primary)' }}>
            &ldquo;SmartFlow transformed our matchday operations. We saw a 35% improvement in gate throughput and much happier fans.&rdquo;
          </blockquote>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <img
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&q=80"
              alt="Marcus Sterling"
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--cyan-soft)' }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Marcus Sterling</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Director of Operations, Wembley Stadium</div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{
          background: 'var(--dark-2)', borderRadius: 24, padding: '64px 48px', textAlign: 'center',
          maxWidth: 900, margin: '0 auto', position: 'relative', overflow: 'hidden',
        }}>
          {/* BG decoration */}
          <div style={{ position: 'absolute', right: -40, bottom: -40, fontSize: 200, opacity: 0.04, color: 'var(--cyan)', fontWeight: 900, lineHeight: 1, userSelect: 'none' }}>
            ⚡
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: 'var(--white)', marginBottom: 16 }}>
            Ready to upgrade your next event?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 40 }}>
            Join over 1 million fans using SmartFlow to navigate their favorite stadiums globally.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" className="btn btn-primary btn-lg">Get SmartFlow Now</Link>
            <button className="btn btn-lg" style={{ border: '1.5px solid rgba(255,255,255,0.3)', color: 'var(--white)', borderRadius: 'var(--radius-full)', padding: '16px 32px', fontSize: 16, fontWeight: 600, background: 'transparent' }}>
              Partner with Us
            </button>
          </div>
        </div>
      </section>

      {/* ========== CONTACT US ========== */}
      <section id="contact" style={{ padding: '80px 24px', background: 'var(--white)', borderTop: '1px solid var(--border)' }}>
        <div className="container" style={{ maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 className="section-title">Get in Touch</h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 12 }}>
              Have questions about integrating SmartFlow in your stadium or just want to say hi? Reach out to our team.
            </p>
          </div>
          <div className="contact-grid">
            <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24, justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--cyan-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan-dark)' }}>
                  <Mail size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Email Us</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>hello@smartflow.io</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--cyan-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan-dark)' }}>
                  <MapPin size={20} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Office HQ</div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>100 Tech Lane, San Francisco</div>
                </div>
              </div>
            </div>
            
            <form style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <input type="text" placeholder="First Name" style={{ flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit' }} />
                <input type="text" placeholder="Last Name" style={{ flex: 1, padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit' }} />
              </div>
              <input type="email" placeholder="Work Email" style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit' }} />
              <textarea placeholder="How can we help?" rows={4} style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
              <button type="button" onClick={(e) => {
                e.preventDefault();
                alert('Thank you! Our sales team will follow up within 24 hours.');
              }} className="btn btn-primary" style={{ padding: '14px', borderRadius: 8 }}>
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer style={{ background: 'var(--white)', borderTop: '1px solid var(--border)', padding: '48px 0 24px' }}>
        <div className="container">
          <div className="footer-grid">
            <div>
              <Link href="/" className="topnav-logo" style={{ marginBottom: 16, display: 'inline-flex' }}>
                <div className="logo-icon"><Zap size={16} fill="currentColor" /></div>
                SMARTFLOW
              </Link>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 240 }}>
                Pioneering the future of stadium attendance with real-time intelligence and seamless fan navigation.
              </p>
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                {[MessageCircle, Camera, Share2, Briefcase].map((Icon, i) => (
                  <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    <Icon size={14} />
                  </div>
                ))}
              </div>
            </div>
            {[
              { title: 'Product', links: ['Main Dashboard', '3D Stadium UI', 'Smart Routing', 'Pre-Order Food'] },
              { title: 'Partners', links: ['Stadium Solutions', 'Event Management', 'API Documentation', 'Case Studies'] },
              { title: 'Company', links: ['About Us', 'Careers', 'Privacy Policy', 'Terms of Service'] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 16 }}>{col.title}</div>
                {col.links.map(link => (
                  <div key={link} style={{ marginBottom: 10 }}>
                    <Link href="#" style={{ fontSize: 14, color: 'var(--text-secondary)', transition: 'color 0.15s' }}
                      onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--text-primary)'}
                      onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--text-secondary)'}
                    >{link}</Link>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>© 2026 SmartFlow Technologies Inc. All rights reserved.</span>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🌐 English (US)</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔒 GDPR Compliant</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
