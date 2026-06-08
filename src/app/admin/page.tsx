"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { no } from "@/i18n/no";
import {
  demoBusiness,
  demoClients,
  demoInvoices,
  demoServices,
} from "@/lib/data/demo";
import { formatNok } from "@/lib/norway/mva";
import { PAYMENT_OPTIONS } from "@/lib/payments/methods";
import { FREE_TRIAL_MONTHS } from "@/lib/pricing/plans";
import type { Booking } from "@/lib/types/booking";

type AdminTab = "calendar" | "clients" | "invoices" | "settings";

const TABS: { id: AdminTab; label: string; icon: string }[] = [
  { id: "calendar", label: no.admin.calendar, icon: "📅" },
  { id: "clients", label: no.admin.clients, icon: "👥" },
  { id: "invoices", label: no.admin.invoices, icon: "🧾" },
  { id: "settings", label: no.admin.settings, icon: "⚙️" },
];

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("calendar");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifVisible, setNotifVisible] = useState(true);

  useEffect(() => {
    fetch("/api/bookings?slug=salong-nord")
      .then((r) => r.json())
      .then((d) => setBookings(d.bookings ?? []));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNotifVisible((v) => !v), 2800);
    return () => clearInterval(id);
  }, []);

  const todayBookings = bookings.filter((b) => b.status !== "cancelled");

  function serviceName(id: string) {
    return demoServices.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <div className="flex min-h-screen bg-[#EFF8F4] font-sans text-[#0D3B2E]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-[#C8E6D8] bg-white">
        <div className="border-b border-[#C8E6D8] px-5 py-5">
          <Logo size="sm" />
          <p className="mt-2 text-xs font-semibold text-[#7A9A8E]">{no.admin.panelTitle}</p>
        </div>
        <nav className="flex-1 p-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-[#0F6E56]/10 text-[#0F6E56]"
                  : "text-[#4A6B5E] hover:bg-[#EFF8F4]"
              }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-[#C8E6D8] p-4">
          <p className="text-xs font-bold text-[#0F6E56]">{FREE_TRIAL_MONTHS} mnd gratis</p>
          <p className="text-[10px] text-[#7A9A8E]">{demoBusiness.name}</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-between border-b border-[#C8E6D8] bg-white px-8 py-4">
          <h1 className="text-lg font-bold">
            {TABS.find((t) => t.id === tab)?.icon}{" "}
            {TABS.find((t) => t.id === tab)?.label}
          </h1>
          <a
            href={`/${demoBusiness.slug}`}
            target="_blank"
            className="text-xs font-semibold text-[#0F6E56] hover:underline"
          >
            {demoBusiness.slug}.bookti.no ↗
          </a>
        </header>

        <div className="p-8">
          {tab === "calendar" && (
            <>
              <div
                className="mb-6 flex items-center gap-3 rounded-xl border border-[#0F6E56]/20 bg-white px-4 py-3 text-sm text-[#0F6E56] shadow-sm transition-all duration-500"
                style={{ opacity: notifVisible ? 1 : 0 }}
              >
                <span className="text-xl">🔔</span>
                <div>
                  <div className="font-bold">{no.dashboard.newBooking}</div>
                  <div className="text-xs opacity-60">Sara Andersen — kl. 15:30 · Vipps betalt</div>
                </div>
                <span className="ml-auto text-xs opacity-40">akkurat nå</span>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: no.dashboard.appointmentsToday, val: String(todayBookings.length) },
                  { label: no.dashboard.weeklyRevenue, val: formatNok(680000) },
                  { label: no.dashboard.occupancy, val: "87%" },
                  { label: no.dashboard.activeCustomers, val: String(demoClients.length) },
                ].map(({ label, val }) => (
                  <div key={label} className="rounded-xl border border-[#C8E6D8] bg-white p-4 shadow-sm">
                    <div className="text-xs text-[#7A9A8E]">{label}</div>
                    <div className="mt-1 text-2xl font-bold text-[#0F6E56]">{val}</div>
                  </div>
                ))}
              </div>

              <h2 className="mb-3 text-xs font-bold tracking-widest text-[#7A9A8E] uppercase">
                {no.dashboard.todaysAppointments}
              </h2>
              <div className="space-y-2">
                {todayBookings.map((b) => {
                  const done = b.status === "completed";
                  const time = new Intl.DateTimeFormat("nb-NO", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Oslo",
                  }).format(new Date(b.startsAt));

                  return (
                    <div
                      key={b.id}
                      className={`flex items-center gap-4 rounded-xl border bg-white px-4 py-3 shadow-sm ${
                        done ? "border-[#C8E6D8] opacity-50" : "border-[#C8E6D8]"
                      }`}
                    >
                      <span className="w-12 font-mono text-sm font-bold text-[#0F6E56]">{time}</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{b.customerName}</div>
                        <div className="text-xs text-[#7A9A8E]">{serviceName(b.serviceId)}</div>
                      </div>
                      <span className="text-xs text-[#7A9A8E]">{b.customerPhone}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          done ? "bg-[#EFF8F4] text-[#7A9A8E]" : "bg-[#0F6E56]/10 text-[#0F6E56]"
                        }`}
                      >
                        {done ? no.dashboard.done : no.dashboard.upcoming}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "clients" && (
            <div className="overflow-hidden rounded-xl border border-[#C8E6D8] bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#C8E6D8] bg-[#EFF8F4] text-left text-xs text-[#7A9A8E]">
                    <th className="px-4 py-3 font-bold">Navn</th>
                    <th className="px-4 py-3 font-bold">Telefon</th>
                    <th className="px-4 py-3 font-bold">Besøk</th>
                    <th className="px-4 py-3 font-bold">Sist</th>
                  </tr>
                </thead>
                <tbody>
                  {demoClients.map((c) => (
                    <tr key={c.id} className="border-b border-[#C8E6D8] last:border-0">
                      <td className="px-4 py-3 font-semibold">{c.name}</td>
                      <td className="px-4 py-3 text-[#4A6B5E]">{c.phone}</td>
                      <td className="px-4 py-3 text-[#0F6E56] font-bold">{c.visits}</td>
                      <td className="px-4 py-3 text-[#7A9A8E]">{c.lastVisit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "invoices" && (
            <>
              <div className="mb-4 flex justify-end">
                <button className="rounded-lg bg-[#0F6E56] px-4 py-2 text-xs font-bold text-white">
                  {no.invoicing.altinnExport}
                </button>
              </div>
              <div className="space-y-2">
                {demoInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-4 rounded-xl border border-[#C8E6D8] bg-white px-4 py-3 shadow-sm"
                  >
                    <span className="font-mono text-sm font-bold text-[#0F6E56]">#{inv.number}</span>
                    <span className="flex-1 text-sm font-semibold">{inv.client}</span>
                    <span className="text-sm font-bold">{formatNok(inv.amountOre)}</span>
                    <span className="text-xs text-[#7A9A8E]">{inv.date}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        inv.status === "betalt"
                          ? "bg-[#0F6E56]/10 text-[#0F6E56]"
                          : "bg-orange-50 text-orange-600"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "settings" && (
            <div className="max-w-lg space-y-6">
              <section className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold">{no.admin.businessSettings}</h3>
                {[
                  { label: "Bedriftsnavn", value: demoBusiness.name },
                  { label: "Org.nr", value: demoBusiness.orgNumber },
                  { label: "E-post", value: demoBusiness.email },
                  { label: "Telefon", value: demoBusiness.phone },
                  { label: "Adresse", value: `${demoBusiness.address}, ${demoBusiness.postalCode} ${demoBusiness.city}` },
                ].map(({ label, value }) => (
                  <div key={label} className="mb-3">
                    <label className="text-xs font-bold text-[#7A9A8E]">{label}</label>
                    <input
                      readOnly
                      value={value}
                      className="mt-1 w-full rounded-lg border border-[#C8E6D8] bg-[#EFF8F4] px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </section>

              <section className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold">Betalingsmetoder</h3>
                <div className="space-y-2">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-3 rounded-lg border border-[#C8E6D8] px-4 py-3 text-sm">
                      <input type="checkbox" defaultChecked className="accent-[#0F6E56]" />
                      <span className="font-semibold">{opt.label}</span>
                      <span className="text-xs text-[#7A9A8E]">{opt.description}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[#7A9A8E]">
                  Vipps MSN: {demoBusiness.vippsMerchantId} · Stripe: demo-modus
                </p>
              </section>

              <section className="rounded-xl border border-[#C8E6D8] bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-bold">{no.admin.notifications}</h3>
                {["SMS ved ny booking", "Push-varsler", "E-post kvittering"].map((n) => (
                  <label key={n} className="mb-2 flex items-center gap-3 text-sm">
                    <input type="checkbox" defaultChecked className="accent-[#0F6E56]" />
                    {n}
                  </label>
                ))}
              </section>

              <button className="rounded-xl bg-[#0F6E56] px-6 py-3 text-sm font-bold text-white">
                {no.admin.save}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
