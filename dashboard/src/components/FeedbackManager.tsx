"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { MessageSquare, ThumbsUp, ThumbsDown, Search, ChevronDown, ChevronUp, X, ArrowLeft, Calendar, User, Utensils } from "lucide-react";

type Review = {
  id: string;
  rating_thumbs: boolean | null;
  public_note: string | null;
  photo_url: string | null;
  created_at: string;
  menu_items: {
    id: string;
    name: string;
    menu_categories: { restaurant_id: string } | null;
  } | null;
  users: {
    email: string | null;
    phone_number: string | null;
    full_name: string | null;
  } | null;
};

function RatingBadge({ rating }: { rating: boolean | null }) {
  if (rating === true) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-bold rounded-full">
      <ThumbsUp className="w-3.5 h-3.5" /> Positive
    </span>
  );
  if (rating === false) return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm font-bold rounded-full">
      <ThumbsDown className="w-3.5 h-3.5" /> Negative
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-full">
      <MessageSquare className="w-3.5 h-3.5" /> No Rating
    </span>
  );
}

function DetailPanel({ review, onClose }: { review: Review; onClose: () => void }) {
  const itemName = review.menu_items?.name || "Unknown Item";
  const dinerName = review.users?.full_name || "Deleted User";
  const date = new Date(review.created_at);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Feedback
          </button>
          <RatingBadge rating={review.rating_thumbs} />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden">

          {/* Photo */}
          {review.photo_url && (
            <div className="relative w-full h-64 bg-slate-100 dark:bg-slate-800 shrink-0">
              <Image
                src={review.photo_url}
                alt="Review photo"
                fill
                className="object-cover"
                sizes="512px"
                priority
              />
            </div>
          )}

          <div className="p-6 space-y-6">

            {/* Diner info */}
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">{dinerName}</p>
                {review.users?.email && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{review.users.email}</p>
                )}
                {review.users?.phone_number && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{review.users.phone_number}</p>
                )}
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                  <Utensils className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Item</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{itemName}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Date</span>
                </div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Public note */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                Diner's Feedback
              </p>
              {review.public_note ? (
                <blockquote className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 border-l-4 border-emerald-500 text-slate-700 dark:text-slate-300 leading-relaxed italic">
                  "{review.public_note}"
                </blockquote>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 text-center">
                  <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-400 dark:text-slate-500 text-sm">No written feedback left.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

type DateRange = "all" | "today" | "week" | "month";

const DATE_FILTERS: { label: string; value: DateRange }[] = [
  { label: "All time", value: "all" },
  { label: "Today", value: "today" },
  { label: "This week", value: "week" },
  { label: "This month", value: "month" },
];

function cutoff(range: DateRange): number {
  const now = new Date();
  if (range === "today") { now.setHours(0, 0, 0, 0); return now.getTime(); }
  if (range === "week") return Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (range === "month") return Date.now() - 30 * 24 * 60 * 60 * 1000;
  return 0;
}

export function FeedbackManager({ reviews }: { reviews: Review[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const searchParams = useSearchParams();
  const highlightItemId = searchParams.get("item");

  const idToName = useMemo(() => {
    const map: Record<string, string> = {};
    reviews.forEach(r => {
      if (r.menu_items?.id) map[r.menu_items.id] = r.menu_items.name;
    });
    return map;
  }, [reviews]);

  useEffect(() => {
    if (highlightItemId && idToName[highlightItemId]) {
      setExpandedItems(new Set([idToName[highlightItemId]]));
      setTimeout(() => {
        document.getElementById(`item-${highlightItemId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [highlightItemId, idToName]);

  const filteredByDate = useMemo(() => {
    const threshold = cutoff(dateRange);
    return threshold === 0 ? reviews : reviews.filter(r => new Date(r.created_at).getTime() >= threshold);
  }, [reviews, dateRange]);

  const groupedReviews = useMemo(() => {
    const groups: Record<string, Review[]> = {};
    filteredByDate.forEach((review) => {
      const itemName = review.menu_items?.name || "Unknown Item";
      if (!groups[itemName]) groups[itemName] = [];
      groups[itemName].push(review);
    });
    return groups;
  }, [filteredByDate]);

  const filteredItems = useMemo(() => {
    return Object.keys(groupedReviews)
      .filter((itemName) => itemName.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  }, [groupedReviews, searchQuery]);

  const toggleExpand = (itemName: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemName)) next.delete(itemName);
      else next.add(itemName);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Search + Date filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search for a menu item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-sm text-slate-900 dark:text-slate-100 transition-shadow"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 shadow-sm">
          {DATE_FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setDateRange(value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                dateRange === value
                  ? "bg-emerald-500 text-white"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion List */}
      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <div className="text-center text-slate-500 py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="font-semibold">No feedback found</p>
            <p className="text-sm mt-1 text-slate-400">
              {dateRange !== "all" ? "Try a wider date range or " : ""}
              {searchQuery ? `no items match "${searchQuery}"` : "no reviews in this period yet."}
            </p>
          </div>
        ) : (
          filteredItems.map((itemName) => {
            const itemReviews = groupedReviews[itemName];
            const isExpanded = expandedItems.has(itemName);
            const positiveCount = itemReviews.filter(r => r.rating_thumbs === true).length;
            const negativeCount = itemReviews.filter(r => r.rating_thumbs === false).length;
            const itemId = itemReviews[0]?.menu_items?.id;

            return (
              <div
                key={itemName}
                id={itemId ? `item-${itemId}` : undefined}
                className={`bg-white dark:bg-slate-900 rounded-2xl border ${isExpanded ? 'border-emerald-200 dark:border-emerald-800 shadow-md' : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'} overflow-hidden transition-all duration-200`}
              >
                <button
                  onClick={() => toggleExpand(itemName)}
                  className="w-full px-6 py-5 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4 text-left">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{itemName}</h3>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-full">
                        {itemReviews.length} Review{itemReviews.length !== 1 ? 's' : ''}
                      </span>
                      {positiveCount > 0 && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-full">
                          <ThumbsUp className="w-3 h-3" /> {positiveCount}
                        </span>
                      )}
                      {negativeCount > 0 && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-full">
                          <ThumbsDown className="w-3 h-3" /> {negativeCount}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>

                {isExpanded && (
                  <div className="p-6 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 fade-in duration-200 space-y-3">
                    {itemReviews.map((review) => {
                      const dinerName = review.users?.full_name || "Deleted User";
                      const date = new Date(review.created_at);
                      return (
                        <button
                          key={review.id}
                          onClick={() => setSelectedReview(review)}
                          className="w-full text-left bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50 hover:border-slate-200 dark:hover:border-slate-600 flex items-center gap-4 transition-all group"
                        >
                          {/* Rating icon */}
                          <div className="shrink-0">
                            {review.rating_thumbs === true ? (
                              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2.5 rounded-full">
                                <ThumbsUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              </div>
                            ) : review.rating_thumbs === false ? (
                              <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-full">
                                <ThumbsDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </div>
                            ) : (
                              <div className="bg-slate-200 dark:bg-slate-700 p-2.5 rounded-full">
                                <MessageSquare className="w-4 h-4 text-slate-500" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{dinerName}</p>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {review.public_note ? `"${review.public_note}"` : "No written feedback"}
                            </p>
                          </div>

                          {/* Photo thumb + date */}
                          <div className="flex items-center gap-3 shrink-0">
                            {review.photo_url && (
                              <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                <Image src={review.photo_url} alt="" fill className="object-cover" sizes="40px" />
                              </div>
                            )}
                            <div className="text-right">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {date.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">
                                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <ChevronDown className="w-4 h-4 text-slate-300 dark:text-slate-600 -rotate-90 group-hover:text-slate-400 transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Detail panel */}
      {selectedReview && (
        <DetailPanel review={selectedReview} onClose={() => setSelectedReview(null)} />
      )}
    </div>
  );
}
