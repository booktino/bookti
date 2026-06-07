"use client";

import { FormEvent, useEffect, useState } from "react";

const BG = "#04342C";
const LAUNCH_DATE = new Date("2026-09-01T00:00:00");

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getTimeLeft(): TimeLeft {
  const diff = LAUNCH_DATE.getTime() - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function ComingSoonPage() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(interval);
  }, []);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  const countdown = [
    { value: timeLeft.days, label: "Dager" },
    { value: timeLeft.hours, label: "Timer" },
    { value: timeLeft.minutes, label: "Minutter" },
    { value: timeLeft.seconds, label: "Sekunder" },
  ];

  return (
    <div
      className="relative min-h-screen overflow-hidden font-sans text-white"
      style={{ backgroundColor: BG }}
    >
      {/* Background video placeholder */}
      <video
        className="fixed inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      >
        <source src="/background.mp4" type="video/mp4" />
      </video>

      {/* Overlay for readability */}
      <div
        className="fixed inset-0"
        style={{ backgroundColor: `${BG}CC` }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Logo */}
        <header className="px-6 py-8">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold backdrop-blur-sm">
              Bti
            </span>
            <span className="text-sm font-medium tracking-wide text-white/70">
              Bookti
            </span>
          </div>
        </header>

        {/* Main */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
          <h1 className="max-w-2xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            Bookti kommer snart
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/60 sm:text-xl">
            Smart booking for norske servicebedrifter
          </p>

          {/* Waitlist */}
          <div className="mt-12 w-full max-w-md">
            {submitted ? (
              <p className="text-sm text-white/70">
                Takk! Vi varsler deg når Bookti lanseres.
              </p>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="din@epost.no"
                  className="h-12 flex-1 rounded-full border border-white/20 bg-white/10 px-5 text-sm text-white placeholder:text-white/40 backdrop-blur-sm outline-none transition-colors focus:border-white/40"
                />
                <button
                  type="submit"
                  className="h-12 shrink-0 rounded-full bg-white px-6 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ color: BG }}
                >
                  Varsle meg
                </button>
              </form>
            )}
          </div>

          {/* Countdown */}
          <div className="mt-16 grid w-full max-w-lg grid-cols-4 gap-4 sm:gap-6">
            {countdown.map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <span className="text-3xl font-bold tabular-nums sm:text-4xl">
                  {pad(value)}
                </span>
                <span className="text-xs uppercase tracking-widest text-white/40">
                  {label}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-white/30">
            Lansering 1. september 2026
          </p>
        </main>
      </div>
    </div>
  );
}
