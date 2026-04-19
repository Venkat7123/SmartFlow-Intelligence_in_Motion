'use client';
import Link from 'next/link';
import { MapPin, Clock, Ticket } from 'lucide-react';
import { Event } from '@/types';

interface EventCardProps {
  event: Event;
  variant?: 'discover' | 'compact';
}

export function EventCard({ event, variant = 'discover' }: EventCardProps) {
  const getRelativeDate = () => {
    if (event.isLive) return 'LIVE NOW';
    
    // Parse the date (assuming format like "April 20, 2026")
    const eventDate = new Date(event.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'TODAY';
    if (diffDays === 1) return 'TOMORROW';
    if (diffDays > 1) return `${diffDays} DAYS REM`;
    if (diffDays < 0) return 'ENDED';
    return event.date;
  };

  const relativeDate = getRelativeDate();

  return (
    <div className="card" style={{ overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = '';
      }}
    >
      {/* Image */}
      <div style={{ position: 'relative', height: 180 }}>
        <img
          src={event.imageUrl}
          alt={event.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {event.isLive ? (
          <span className="badge badge-live" style={{ 
            position: 'absolute', top: 12, left: 12, 
            boxShadow: '0 4px 12px rgba(239,68,68,0.4)',
            border: 'none',
            background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
            color: 'white',
            padding: '4px 12px'
          }}>
            LIVE NOW
          </span>
        ) : (
          <span className="badge" style={{ 
            position: 'absolute', top: 12, left: 12, 
            background: 'rgba(15, 23, 42, 0.75)', 
            backdropFilter: 'blur(8px)',
            color: 'var(--cyan)', 
            border: '1px solid rgba(0, 229, 255, 0.3)',
            padding: '4px 12px',
            fontSize: 10,
            fontWeight: 800
          }}>
            {relativeDate}
          </span>
        )}
        <span
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(255,255,255,0.9)', color: 'var(--dark)',
            fontSize: 10, fontWeight: 800, padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-sm)',
            textTransform: 'uppercase'
          }}
        >
          {event.category}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '16px' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, lineHeight: 1.3 }}>{event.title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            <MapPin size={12} />
            {event.venue}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
            <Clock size={12} />
            {event.date} • {event.time}
          </div>
        </div>

        <Link
          href={`/attend/${event.id}`}
          className="btn btn-primary btn-full"
          style={{ borderRadius: 'var(--radius-md)' }}
        >
          <Ticket size={14} />
          I&apos;m Attending
        </Link>
      </div>
    </div>
  );
}
