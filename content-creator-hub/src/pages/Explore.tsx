import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreatorResponse, getAllCreators } from "@/lib/api";

const DEFAULT_CATEGORIES = [
  "Digital Art",
  "Music",
  "Writing",
  "Education",
  "Gaming",
  "Photography",
  "Development",
  "Video Production",
  "Podcasting",
  "Comics",
  "Animation",
  "Crafts",
  "Technology",
  "Fitness",
  "Cooking",
  "Other",
];

const getInitial = (name?: string) => {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase() || "?";
};

const formatSubscriptionFee = (fee: CreatorResponse["subscriptionFee"]) => {
  const numericFee =
    typeof fee === "string" ? Number.parseFloat(fee) : Number(fee);

  if (!Number.isFinite(numericFee) || numericFee < 0) {
    return "- STX";
  }

  const formatted =
    numericFee % 1 === 0 ? numericFee.toFixed(0) : numericFee.toFixed(2);

  return `${formatted} STX`;
};

const Explore = () => {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [creators, setCreators] = useState<CreatorResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCreators = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAllCreators();
      setCreators(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load creators");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCreators();
  }, [loadCreators]);

  const categories = useMemo(() => {
    const derived = Array.from(
      new Set(
        creators
          .flatMap((creator) => creator.categories || [])
          .filter((cat): cat is string => Boolean(cat && cat.trim()))
      )
    ).sort();

    const list = derived.length ? derived : DEFAULT_CATEGORIES;
    return ["All", ...list];
  }, [creators]);

  useEffect(() => {
    if (category !== "All" && !categories.includes(category)) {
      setCategory("All");
    }
  }, [categories, category]);

  const filtered = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return creators.filter((creator) => {
      const creatorCategories = creator.categories || [];
      const matchesCategory =
        category === "All" ||
        creatorCategories.some(
          (cat) => cat?.toLowerCase() === category.toLowerCase()
        );

      if (!matchesCategory) {
        return false;
      }

      if (!searchTerm) {
        return true;
      }

      const searchableFields = [
        creator.displayName,
        creator.username,
        creator.bio,
        creator.about,
        ...creatorCategories,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableFields.includes(searchTerm);
    });
  }, [creators, category, search]);

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/80 p-8 shadow-lg">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] uppercase tracking-[0.6em] text-muted-foreground">Curated Directory</p>
            <h1 className="text-3xl font-semibold tracking-tight">Explore creators designing the future of patronage.</h1>
            <p className="text-sm text-muted-foreground">
              Filter by discipline or search across bios, BNS names, and descriptions. Each profile is vetted and on-chain.
            </p>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative lg:flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, discipline, or statement"
                className="h-12 rounded-2xl border border-border/70 bg-background/80 pl-12 pr-4 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.3em] transition ${
                    category === cat
                      ? "border-transparent bg-foreground text-background"
                      : "border-border/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </header>

        {error && (
          <div className="flex items-center justify-between rounded-2xl border border-destructive/50 bg-destructive/10 px-6 py-4 text-xs uppercase tracking-[0.4em] text-destructive">
            <span>{error}</span>
            <button
              onClick={loadCreators}
              className="rounded-full border border-destructive px-4 py-2 text-[10px] tracking-[0.5em]"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="py-24 text-center text-sm text-muted-foreground">Curating the list…</p>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((creator) => (
                <Link
                  key={creator.id}
                  to={`/creator/${creator.username}`}
                  className="group flex flex-col gap-3 rounded-3xl border border-transparent bg-card/80 p-6 shadow-sm transition hover:-translate-y-1 hover:border-border/80 hover:shadow-xl"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/60 text-base font-semibold">
                        {getInitial(creator.displayName)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{creator.displayName}</p>
                        <p className="text-xs text-muted-foreground">@{creator.username}</p>
                      </div>
                    </div>
                    <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                      {creator.categories?.[0] || "Curator"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {creator.bio || "This creator curates experiences with intention and restraint."}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{creator.bns || "-"}</span>
                    <span>{formatSubscriptionFee(creator.subscriptionFee)} / month</span>
                  </div>
                </Link>
              ))}
            </div>
            {filtered.length === 0 && !error && (
              <p className="py-24 text-center text-sm text-muted-foreground">No creators match that search.</p>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Explore;
