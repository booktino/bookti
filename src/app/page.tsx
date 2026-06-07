const BRAND = "#0F6E56";

const features = [
  {
    title: "Enkel nettbooking",
    description:
      "La kundene bestille time selv — døgnet rundt, uten telefon og e-post frem og tilbake.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M4.5 8.25h15M5.25 19.5h13.5a1.5 1.5 0 001.5-1.5V7.5a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v10.5a1.5 1.5 0 001.5 1.5z"
        />
      </svg>
    ),
  },
  {
    title: "Kalendersynk",
    description:
      "Hold oversikt over alle avtaler på ett sted. Synkroniser med Google Kalender på sekunder.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5a3 3 0 003-3V6.75"
        />
      </svg>
    ),
  },
  {
    title: "Automatiske påminnelser",
    description:
      "Reduser no-shows med SMS- og e-postpåminnelser sendt automatisk før hver time.",
    icon: (
      <svg
        className="h-6 w-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
    ),
  },
];

const pricingIncludes = [
  "Ubegrenset antall bookinger",
  "Kalendersynkronisering",
  "SMS- og e-postpåminnelser",
  "Egendefinert bookingside",
  "Norsk kundestøtte",
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-white font-sans text-zinc-900">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-100 bg-white/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#" className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: BRAND }}
            >
              Bti
            </span>
            <span className="text-lg font-semibold tracking-tight">Bookti</span>
          </a>
          <div className="hidden items-center gap-8 text-sm font-medium text-zinc-600 md:flex">
            <a href="#funksjoner" className="transition-colors hover:text-zinc-900">
              Funksjoner
            </a>
            <a href="#priser" className="transition-colors hover:text-zinc-900">
              Priser
            </a>
          </div>
          <a
            href="#priser"
            className="rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND }}
          >
            Kom i gang
          </a>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-6 pb-24 pt-20">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `radial-gradient(circle at 30% 20%, ${BRAND} 0%, transparent 50%), radial-gradient(circle at 70% 80%, ${BRAND} 0%, transparent 50%)`,
            }}
          />
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p
                className="mb-4 inline-block rounded-full px-4 py-1.5 text-sm font-medium"
                style={{ backgroundColor: `${BRAND}14`, color: BRAND }}
              >
                Booking gjort enkelt
              </p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Gi kundene en{" "}
                <span style={{ color: BRAND }}>smidig bookingopplevelse</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-600">
                Bookti hjelper små bedrifter med å ta imot bookinger online,
                holde orden i kalenderen og redusere uteblivelser — alt på ett
                sted.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href="#priser"
                  className="inline-flex h-12 items-center justify-center rounded-full px-8 text-base font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  Start gratis prøveperiode
                </a>
                <a
                  href="#funksjoner"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-zinc-200 px-8 text-base font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  Se funksjoner
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="funksjoner" className="bg-zinc-50 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Alt du trenger for å drive booking
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-zinc-600">
                Tre kraftige verktøy som sparer deg tid og gir kundene en
                profesjonell opplevelse.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div
                    className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-3 leading-relaxed text-zinc-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="priser" className="px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Enkel, forutsigbar prising
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-zinc-600">
                Ingen skjulte gebyrer. Alt inkludert i én månedlig pris.
              </p>
            </div>
            <div className="mx-auto max-w-md">
              <div
                className="overflow-hidden rounded-2xl border-2 shadow-lg"
                style={{ borderColor: BRAND }}
              >
                <div
                  className="px-8 py-6 text-center text-white"
                  style={{ backgroundColor: BRAND }}
                >
                  <p className="text-sm font-medium uppercase tracking-wider opacity-90">
                    Bookti Pro
                  </p>
                </div>
                <div className="bg-white px-8 py-10">
                  <div className="text-center">
                    <span className="text-5xl font-bold tracking-tight">
                      299
                    </span>
                    <span className="ml-1 text-2xl font-medium text-zinc-500">
                      NOK
                    </span>
                    <p className="mt-1 text-sm text-zinc-500">per måned</p>
                  </div>
                  <ul className="mt-8 space-y-3">
                    {pricingIncludes.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-3 text-sm text-zinc-700"
                      >
                        <svg
                          className="h-5 w-5 shrink-0"
                          style={{ color: BRAND }}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#"
                    className="mt-8 flex h-12 w-full items-center justify-center rounded-full text-base font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: BRAND }}
                  >
                    Kom i gang
                  </a>
                  <p className="mt-4 text-center text-xs text-zinc-400">
                    14 dagers gratis prøveperiode. Ingen binding.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="border-t border-zinc-100 px-6 py-12"
        style={{ backgroundColor: `${BRAND}08` }}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ backgroundColor: BRAND }}
            >
              Bti
            </span>
            <span className="font-semibold">Bookti</span>
          </div>
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} Bookti. Alle rettigheter reservert.
          </p>
          <div className="flex gap-6 text-sm text-zinc-500">
            <a href="#" className="transition-colors hover:text-zinc-900">
              Personvern
            </a>
            <a href="#" className="transition-colors hover:text-zinc-900">
              Vilkår
            </a>
            <a href="#" className="transition-colors hover:text-zinc-900">
              Kontakt
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
