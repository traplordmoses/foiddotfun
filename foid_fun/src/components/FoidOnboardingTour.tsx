'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAudioSettings } from '@/lib/audioSettings';

const COOKIE_KEY = 'foid_onboarded';

interface TourSlide {
  exe: string;
  icon: string;
  title: string;
  body: string;
  accent: string;
  href: string;
  cta: string;
}

const SLIDES: TourSlide[] = [
  {
    exe: 'welcome.exe',
    icon: '🌊',
    title: 'WELCOME TO FOID',
    body: 'An onchain funnel for memes and culture. Three programs. One mission: canonize the internet.',
    accent: '#00ffff',
    href: '',
    cta: '',
  },
  {
    exe: 'loreboard.exe',
    icon: '🖼️',
    title: 'LOREBOARD — THE COLLAGE',
    body: 'A living memetic collage. Upload anything. Place it on the infinite canvas. As the community grows, the collage grows — all backed by an ever-evolving NFT.',
    accent: '#ff6bd5',
    href: '/board',
    cta: 'View the Board',
  },
  {
    exe: 'vote.exe',
    icon: '🗳️',
    title: 'VOTE — SHAPE THE CULTURE',
    body: 'Community members submit memes. You swipe right to approve, left to reject. Approved proposals get placed on the Loreboard permanently — governed by the people who show up.',
    accent: '#a855f7',
    href: '/vote',
    cta: 'Start Voting',
  },
  {
    exe: 'pray.exe',
    icon: '🙏',
    title: 'PRAY — DAILY RITUAL',
    body: 'Check in with Foid Mommy every day. Build your prayer streak. Boost your voting power. The faithful are rewarded.',
    accent: '#00ffff',
    href: '/pray',
    cta: 'Begin Praying',
  },
  {
    exe: 'ready.exe',
    icon: '⚡',
    title: "YOU'RE IN",
    body: 'Connect your wallet to start voting, uploading, and praying. Your journey in the FOID Foundation begins now.',
    accent: '#00ffd5',
    href: '',
    cta: '',
  },
];

function useTypedText(text: string, active: boolean, speed = 28): string {
  const [typed, setTyped] = useState('');
  const idx = useRef(0);

  useEffect(() => {
    if (!active) {
      setTyped('');
      idx.current = 0;
      return;
    }
    idx.current = 0;
    setTyped('');
    const timer = setInterval(() => {
      idx.current += 1;
      if (idx.current >= text.length) {
        setTyped(text);
        clearInterval(timer);
      } else {
        setTyped(text.slice(0, idx.current));
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, active, speed]);

  return typed;
}

export default function FoidOnboardingTour() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const audioRef = useRef<AudioContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Check if user has seen onboarding
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cookie = document.cookie.split(';').find(c => c.trim().startsWith(COOKIE_KEY + '='));
    if (!cookie) {
      // Delay slightly so enter gate animation finishes
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const slide = SLIDES[current];
  const typedBody = useTypedText(slide.body, visible && !transitioning, 18);
  const isFirst = current === 0;
  const isLast = current === SLIDES.length - 1;

  const dismiss = useCallback(() => {
    document.cookie = `${COOKIE_KEY}=1; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
    setVisible(false);
  }, []);

  const playTick = useCallback(() => {
    if (!getAudioSettings().sfxEnabled) return;
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        audioRef.current = new Ctx();
      }
      const ctx = audioRef.current;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.03);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // audio not available
    }
  }, []);

  const goTo = useCallback((index: number) => {
    if (index === current || transitioning) return;
    setDirection(index > current ? 'next' : 'prev');
    setTransitioning(true);
    playTick();
    setTimeout(() => {
      setCurrent(index);
      setTransitioning(false);
    }, 250);
  }, [current, transitioning, playTick]);

  const next = useCallback(() => {
    if (isLast) {
      dismiss();
      return;
    }
    goTo(current + 1);
  }, [current, isLast, goTo, dismiss]);

  const prev = useCallback(() => {
    if (!isFirst) goTo(current - 1);
  }, [current, isFirst, goTo]);

  const handleTryCta = useCallback(() => {
    dismiss();
    if (slide.href) router.push(slide.href);
  }, [dismiss, router, slide.href]);

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, next, prev, dismiss]);

  // Touch swipe
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) next();
      else prev();
    }
    touchStart.current = null;
  }, [next, prev]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: 'rgba(5,7,11,0.88)',
        backdropFilter: 'blur(20px)',
        zIndex: 99999,
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Ambient glow matching current slide accent */}
      <div
        style={{
          position: 'absolute',
          width: '60vw',
          height: '60vw',
          maxWidth: 500,
          maxHeight: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${slide.accent}18 0%, transparent 70%)`,
          filter: 'blur(80px)',
          transition: 'background 0.5s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Skip button */}
      <button
        onClick={dismiss}
        className="absolute top-6 right-6 text-[10px] tracking-[0.3em] uppercase text-white/30 hover:text-white/60 transition-colors z-10"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        SKIP
      </button>

      {/* Main card */}
      <div
        className="relative w-[92vw] max-w-lg"
        style={{
          opacity: transitioning ? 0 : 1,
          transform: transitioning
            ? `translateX(${direction === 'next' ? '-30px' : '30px'})`
            : 'translateX(0)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
        }}
      >
        {/* Vista window frame */}
        <div className="vista-window" style={{ overflow: 'visible' }}>
          <div className="vista-window__titlebar">
            <div className="vista-window__controls" aria-hidden="true">
              <span className="vista-window__control vista-window__control--minimize" />
              <span className="vista-window__control vista-window__control--restore" />
              <span
                className="vista-window__control vista-window__control--close"
                onClick={dismiss}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <span className="vista-window__title text-[11px]">{slide.exe}</span>
          </div>

          <div
            className="vista-window__body"
            style={{
              padding: '32px 28px 24px',
              minHeight: 320,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderTop: `2px solid ${slide.accent}33`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Scanline effect */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
                pointerEvents: 'none',
                opacity: 0.5,
              }}
            />

            {/* Icon */}
            <div
              style={{
                fontSize: 56,
                lineHeight: 1,
                marginBottom: 20,
                filter: `drop-shadow(0 0 20px ${slide.accent}60)`,
                animation: 'onboardIconFloat 3s ease-in-out infinite',
              }}
            >
              {slide.icon}
            </div>

            {/* Title */}
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: slide.accent,
                textShadow: `0 0 30px ${slide.accent}50`,
                textAlign: 'center',
                marginBottom: 16,
                textTransform: 'uppercase',
              }}
            >
              {slide.title}
            </h2>

            {/* Body — typed effect */}
            <p
              style={{
                fontFamily: 'var(--font-terminal)',
                fontSize: 13,
                lineHeight: 1.7,
                color: 'rgba(200,230,245,0.85)',
                textAlign: 'center',
                maxWidth: 380,
                minHeight: 66,
              }}
            >
              {typedBody}
              <span
                style={{
                  display: 'inline-block',
                  width: 7,
                  height: 15,
                  background: slide.accent,
                  marginLeft: 2,
                  verticalAlign: 'middle',
                  opacity: typedBody.length < slide.body.length ? 1 : 0,
                  animation: 'onboardCursorBlink 0.6s step-end infinite',
                }}
              />
            </p>

            {/* CTA button for slides that have one */}
            {slide.cta && (
              <button
                onClick={handleTryCta}
                style={{
                  marginTop: 20,
                  padding: '8px 24px',
                  borderRadius: 8,
                  border: `1px solid ${slide.accent}55`,
                  background: `${slide.accent}12`,
                  color: slide.accent,
                  fontSize: 11,
                  letterSpacing: '0.2em',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = `${slide.accent}25`;
                  e.currentTarget.style.borderColor = `${slide.accent}88`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = `${slide.accent}12`;
                  e.currentTarget.style.borderColor = `${slide.accent}55`;
                }}
              >
                {slide.cta}
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 20,
            padding: '0 4px',
          }}
        >
          {/* Back button */}
          <button
            onClick={prev}
            disabled={isFirst}
            style={{
              padding: '8px 16px',
              fontSize: 11,
              letterSpacing: '0.15em',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: isFirst ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
              background: 'transparent',
              border: 'none',
              cursor: isFirst ? 'default' : 'pointer',
              transition: 'color 0.2s',
            }}
          >
            {'<'} BACK
          </button>

          {/* Dots — button is a 24x24 hit target to satisfy WCAG 2.2 AA
              target-size (2.5.8). The visible pill is an inner span. */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {SLIDES.map((s, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                style={{
                  width: 24,
                  height: 24,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    width: i === current ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: i === current ? slide.accent : 'rgba(255,255,255,0.2)',
                    boxShadow: i === current ? `0 0 12px ${slide.accent}60` : 'none',
                    transition: 'all 0.3s ease',
                  }}
                />
              </button>
            ))}
          </div>

          {/* Next / Finish button */}
          <button
            onClick={next}
            style={{
              padding: '8px 16px',
              fontSize: 11,
              letterSpacing: '0.15em',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: isLast ? '#00ffd5' : 'rgba(255,255,255,0.5)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
          >
            {isLast ? 'ENTER' : 'NEXT >'}
          </button>
        </div>
      </div>

      {/* CSS animations */}
      <style jsx global>{`
        @keyframes onboardIconFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes onboardCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
