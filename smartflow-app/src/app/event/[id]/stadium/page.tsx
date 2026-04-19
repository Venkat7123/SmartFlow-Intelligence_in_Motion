'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import { Sidebar, MobileNav } from '@/components/layout/AppNav';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { getEventById } from '@/lib/firebase/db';
import { Event } from '@/types';
import Link from 'next/link';

// Dynamic import — Maps/Three.js only load client-side
// We gracefully resolve the type error here by standardizing the default export import
const StadiumHeatmap3D = dynamic(
  () => import('@/components/event/StadiumHeatmap3D'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        position: 'fixed', inset: 0, background: '#020617', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: 'white',
        fontSize: 18, fontWeight: 700
      }}>
        Loading Stadium View...
      </div>
    )
  }
);

export default function StadiumViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [enrolledEvent, setEnrolledEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    async function fetchEventDetails() {
      try {
        setLoading(true);
        const event = await getEventById(id);
        if (event) {
          setEnrolledEvent(event as Event);
        }
      } catch (err) {
        console.error('Failed to load event for stadium:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchEventDetails();
  }, [user, authLoading, router, id]);

  if (!loading && !enrolledEvent) {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <PageHeader title="Stadium Live View" />
          <div className="page-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24
            }}>
              <span style={{ fontSize: 32 }}>🏟️</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>Not Enrolled in Any Events</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.5, marginBottom: 32 }}>
              The Live Stadium View is an exclusive feature for ticket holders. Enroll in an upcoming event to unlock real-time crowd tracking and intelligent navigation.
            </p>
            <Link href="/discover" className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 15 }}>
              Discover Near You
            </Link>
          </div>
        </div>
        <MobileNav />
      </div>
    );
  }

  if (loading || authLoading || !enrolledEvent) {
    return <div style={{ background: '#020617', minHeight: '100vh' }} />;
  }

  let targetDate = new Date(Date.now() + 45 * 60 * 1000); 
  if (enrolledEvent.date && enrolledEvent.time) {
    const d = new Date(`${enrolledEvent.date} ${enrolledEvent.time}`);
    if (!isNaN(d.getTime()) && d.getTime() > Date.now()) {
      targetDate = d;
    }
  }

  // Bind the targetDate seamlessly without breaking strict types
  const eventWithTargetDate = { ...enrolledEvent, _targetDate: targetDate };

  return (
    <>
      <StadiumHeatmap3D
        onClose={() => router.back()}
        event={eventWithTargetDate as Event & { _targetDate: Date }}
      />
    </>
  );
}
