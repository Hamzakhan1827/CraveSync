"use client";

import { useState, useMemo } from "react";
import { Search, ThumbsUp, ThumbsDown, MessageSquare, ArrowLeft, User, Star, Phone, Mail, Calendar } from "lucide-react";
import Image from "next/image";

type CustomerReview = {
  id: string;
  rating_thumbs: boolean | null;
  public_note: string | null;
  photo_url: string | null;
  created_at: string;
  item_name: string;
};

type Customer = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  reviews: CustomerReview[];
};

function getInitial(name: string | null, email: string | null) {
  return (name || email || "?").charAt(0).toUpperCase();
}

function getBadge(count: number) {
  if (count >= 10) return { label: "VIP", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" };
  if (count >= 5)  return { label: "Regular", color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400" };
  return null;
}

function DetailPanel({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const positive = customer.reviews.filter(r => r.rating_thumbs === true).length;
  const negative = customer.reviews.filter(r => r.rating_thumbs === false).length;
  const satisfaction = customer.reviews.length > 0 ? Math.round((positive / customer.reviews.length) * 100) : null;
  const lastVisit = new Date(customer.reviews[0]?.created_at);
  const badge = getBadge(customer.reviews.length);

  const topItems = useMemo(() => {
    const counts: Record<string, number> = {};
    customer.reviews.forEach(r => { counts[r.item_name] = (counts[r.item_name] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [customer.reviews]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button onClick={onClose} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Directory
          </button>
          {badge && <span className={`text-xs font-bold px-3 py-1 rounded-full ${badge.color}`}>{badge.label}</span>}
        </div>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden">
          <div className="p-6 space-y-6">

            {/* Profile */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-2xl font-black text-indigo-600 dark:text-indigo-400 shrink-0">
                {getInitial(customer.full_name, customer.email)}
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">{customer.full_name || "Deleted User"}</h2>
                {customer.email && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3.5 h-3.5" /> {customer.email}
                  </p>
                )}
                {customer.phone_number && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5" /> {customer.phone_number}
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{customer.reviews.length}</p>
                <p className="text-xs text-slate-400 font-semibold mt-1">Reviews</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{satisfaction ?? "—"}%</p>
                <p className="text-xs text-emerald-500 font-semibold mt-1">Positive</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 text-center">
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">{lastVisit.toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                <p className="text-xs text-slate-400 font-semibold mt-1">Last Visit</p>
              </div>
            </div>

            {/* Satisfaction bar */}
            {satisfaction !== null && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-semibold text-slate-500">Satisfaction rate</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{positive} 👍 · {negative} 👎</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${satisfaction >= 70 ? 'bg-emerald-500' : satisfaction >= 40 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${satisfaction}%` }}
                  />
                </div>
              </div>
            )}

            {/* Favourite items */}
            {topItems.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Favourite Items</p>
                <div className="space-y-2">
                  {topItems.map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/40 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700/50">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{name}</span>
                      <span className="text-xs font-bold text-slate-400">{count}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review history */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Review History</p>
              <div className="space-y-3">
                {customer.reviews.map(r => (
                  <div key={r.id} className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{r.item_name}</span>
                      <div className="flex items-center gap-2">
                        {r.rating_thumbs === true && <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />}
                        {r.rating_thumbs === false && <ThumbsDown className="w-3.5 h-3.5 text-red-400" />}
                        <span className="text-xs text-slate-400">
                          {new Date(r.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    {r.public_note && (
                      <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{r.public_note}"</p>
                    )}
                    {r.photo_url && (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden mt-2 border border-slate-200 dark:border-slate-700">
                        <Image src={r.photo_url} alt="" fill className="object-cover" sizes="64px" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export function CustomerDirectory({ customers }: { customers: Customer[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return customers.filter(c =>
      (c.full_name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone_number || "").toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <User className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-base font-semibold">No diners yet</p>
        <p className="text-sm mt-1 text-slate-400">Customers who review your dishes will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email or phone…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm text-slate-900 dark:text-slate-100 transition-shadow"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-xs uppercase tracking-wider text-slate-400 font-semibold">
              <th className="px-6 py-4">Diner</th>
              <th className="px-6 py-4 text-center">Reviews</th>
              <th className="px-6 py-4 text-center">Satisfaction</th>
              <th className="px-6 py-4">Last Visit</th>
              <th className="px-6 py-4">Top Item</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {filtered.map(customer => {
              const positive = customer.reviews.filter(r => r.rating_thumbs === true).length;
              const satisfaction = customer.reviews.length > 0 ? Math.round((positive / customer.reviews.length) * 100) : null;
              const lastVisit = new Date(customer.reviews[0]?.created_at);
              const badge = getBadge(customer.reviews.length);
              const topItem = (() => {
                const counts: Record<string, number> = {};
                customer.reviews.forEach(r => { counts[r.item_name] = (counts[r.item_name] || 0) + 1; });
                return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
              })();

              return (
                <tr
                  key={customer.id}
                  onClick={() => setSelectedCustomer(customer)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-black text-indigo-600 dark:text-indigo-400 shrink-0">
                        {getInitial(customer.full_name, customer.email)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{customer.full_name || "Deleted User"}</p>
                          {badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{customer.email || customer.phone_number || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{customer.reviews.length}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {satisfaction !== null ? (
                      <span className={`font-bold text-sm ${satisfaction >= 70 ? 'text-emerald-600 dark:text-emerald-400' : satisfaction >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
                        {satisfaction}%
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {lastVisit.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 max-w-[160px] truncate">
                    {topItem || "—"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                  No diners match "{searchQuery}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedCustomer && (
        <DetailPanel customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}
