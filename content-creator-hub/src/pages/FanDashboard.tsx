import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import {
  ContentResponse,
  SubscriptionResponse,
  TransactionResponse,
  getContentByCreator,
  getTransactionsByWallet,
  getUserSubscriptions,
} from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";

const formatDate = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatAmount = (amount?: number) => {
  if (amount === undefined || amount === null) return "0.00 STX";
  return `${amount} STX`;
};

const formatStxValue = (value: number | string | null | undefined) => {
  const numeric =
    typeof value === "string" ? Number.parseFloat(value) : typeof value === "number" ? value : 0;
  return numeric;
};

const FanDashboard = () => {
  const { stxAddress, isAuthenticated, connectWallet } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [feed, setFeed] = useState<ContentResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isAuthenticated || !stxAddress) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [subsResponse, txResponse] = await Promise.all([
          getUserSubscriptions(stxAddress),
          getTransactionsByWallet(stxAddress),
        ]);
        setSubscriptions(subsResponse);
        setTransactions(txResponse);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load dashboard data.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, stxAddress]);

  useEffect(() => {
    if (!stxAddress || subscriptions.length === 0) {
      setFeed([]);
      setFeedLoading(false);
      return;
    }

    let cancelled = false;
    const fetchFeed = async () => {
      setFeedLoading(true);
      try {
        const contentArrays = await Promise.all(
          subscriptions.map((sub) => getContentByCreator(sub.creator.id, stxAddress))
        );
        if (cancelled) return;

        const merged = new Map<string, ContentResponse>();
        contentArrays.flat().forEach((item) => {
          merged.set(item.id, item);
        });

        const combined = Array.from(merged.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setFeed(combined.slice(0, 15));
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load feed.";
          setError((prev) => prev ?? message);
        }
      } finally {
        if (!cancelled) {
          setFeedLoading(false);
        }
      }
    };

    fetchFeed();

    return () => {
      cancelled = true;
    };
  }, [subscriptions, stxAddress]);

  const history = useMemo(() => {
    return transactions
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 15);
  }, [transactions]);

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto flex w-full max-w-4xl items-center justify-center rounded-3xl border border-border/70 bg-card/80 px-8 py-20 text-center text-muted-foreground">
          Loading your collector console…
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated || !stxAddress) {
    return (
      <Layout>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 rounded-3xl border border-border/70 bg-card/80 px-8 py-20 text-center">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to see memberships and content.
          </p>
          <Button size="sm" onClick={connectWallet}>
            Connect Wallet
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="rounded-[28px] border border-border/70 bg-card/80 p-8 shadow-xl">
          <p className="text-[11px] uppercase tracking-[0.6em] text-muted-foreground">Access console</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">My Feed</h1>
              <p className="text-sm text-muted-foreground">Track pay-per-view unlocks and subscription drops.</p>
            </div>
            <div className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
              {subscriptions.length} active subscriptions
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs uppercase tracking-[0.4em] text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="feed" className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-lg">
          <TabsList className="w-full justify-start gap-2 bg-transparent">
            <TabsTrigger value="feed" className="rounded-full px-4 py-2">
              Feed
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="rounded-full px-4 py-2">
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-full px-4 py-2">
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-6">
            {feedLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Curating your private feed…</p>
            ) : feed.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {subscriptions.length === 0 ? "Subscribe to creators to begin receiving releases." : "No new posts yet."}
              </p>
            ) : (
              <div className="space-y-3">
                {feed.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/60 text-sm font-semibold">
                      {item.creator.displayName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                        {item.creator.displayName} · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                      <h3 className="truncate text-sm font-medium">{item.title}</h3>
                    </div>
                    {item.locked ? (
                      <Button size="sm" variant="outline" className="rounded-full px-4 text-xs uppercase tracking-[0.3em]" asChild>
                        <Link to={`/content/${item.id}`}>
                          <Lock className="mr-2 h-3 w-3" />
                          {formatStxValue(item.price)} STX
                        </Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="rounded-full px-4 text-xs uppercase tracking-[0.3em]" asChild>
                        <Link to={`/content/${item.id}`}>
                          <Eye className="mr-2 h-3 w-3" />
                          View
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="subscriptions" className="mt-6">
            {subscriptions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No active subscriptions yet.</p>
            ) : (
              <div className="space-y-3">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-5"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/60 text-sm font-semibold">
                      {sub.creator.displayName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium">{sub.creator.displayName}</h3>
                      <p className="text-xs text-muted-foreground">
                        @{sub.creator.username} · {formatStxValue(sub.creator.subscriptionFee)} STX/mo
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Renews {sub.expiresAt ? formatDate(sub.expiresAt) : "soon"}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="rounded-full px-4 text-xs uppercase tracking-[0.3em]" asChild>
                        <Link to={`/creator/${sub.creator.username}`}>Profile</Link>
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-full px-4 text-xs text-destructive uppercase tracking-[0.3em]" disabled>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background/70 p-5 text-xs uppercase tracking-[0.4em] text-muted-foreground"
                  >
                    <div className="flex-1">
                      <h3 className="text-sm font-medium capitalize tracking-normal text-foreground">
                        {tx.type.replace("-", " ")}
                      </h3>
                      <p className="text-[11px]">{formatDate(tx.createdAt)}</p>
                    </div>
                    <Badge variant={tx.status === "confirmed" ? "default" : "outline"} className="text-[10px] uppercase">
                      {tx.status}
                    </Badge>
                    <span className="text-sm font-semibold text-foreground tracking-normal">
                      {formatAmount(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default FanDashboard;
