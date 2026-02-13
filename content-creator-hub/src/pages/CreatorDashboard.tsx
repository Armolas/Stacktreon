import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import {
  ContentResponse,
  CreatorResponse,
  SubscriptionResponse,
  TransactionResponse,
  getContentByCreator,
  getCreatorByWallet,
  getCreatorSubscribers,
  getTransactionsByCreator,
} from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";

const formatDate = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const CreatorDashboard = () => {
  const navigate = useNavigate();
  const { stxAddress, isAuthenticated } = useWallet();
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrating, setIsHydrating] = useState(false);
  const [creator, setCreator] = useState<CreatorResponse | null>(null);
  const [content, setContent] = useState<ContentResponse[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriptionResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const hydrateDashboard = useCallback(
    async (creatorId: string, walletAddress: string) => {
      setIsHydrating(true);
      try {
        const [contentResponse, subscriberResponse, transactionResponse] = await Promise.all([
          getContentByCreator(creatorId, stxAddress || undefined),
          getCreatorSubscribers(creatorId),
          getTransactionsByCreator(walletAddress),
        ]);

        setContent(contentResponse);
        setSubscribers(subscriberResponse);
        setTransactions(transactionResponse);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load creator data.";
        setError(message);
      } finally {
        setIsHydrating(false);
      }
    },
    [stxAddress]
  );

  useEffect(() => {
    const checkCreator = async () => {
      if (!isAuthenticated || !stxAddress) {
        setIsLoading(false);
        return;
      }

      try {
        const creatorProfile = await getCreatorByWallet(stxAddress);
        setCreator(creatorProfile);
        await hydrateDashboard(creatorProfile.id, creatorProfile.walletAddress);
      } catch (error) {
        console.error('Creator not found, redirecting to register page', error);
        navigate('/dashboard/creator/register');
      } finally {
        setIsLoading(false);
      }
    };

    checkCreator();
  }, [stxAddress, isAuthenticated, navigate, hydrateDashboard]);

  const stats = useMemo(() => {
    const confirmedTx = transactions.filter((tx) => tx.status === "confirmed");
    const totalEarned = confirmedTx.reduce((sum, tx) => sum + parseFloat(String(tx.amount)), 0);
    const ppvEarned = confirmedTx
      .filter((tx) => tx.type === "pay-per-view")
      .reduce((sum, tx) => sum + parseFloat(String(tx.amount)), 0);
    const totalViews = content.reduce((sum, item) => sum + (item.viewCount || 0), 0);
    const activeSubscribers = subscribers.filter((sub) => {
      if (sub.status !== "active") return false;
      if (!sub.expiresAt) return true;
      return new Date(sub.expiresAt) > new Date();
    }).length;

    const formatSTX = (amount: number) => {
      return Number(amount).toFixed(2);
    };

    return [
      { label: "Total Earned", value: `${formatSTX(totalEarned)} STX` },
      { label: "Active Subscribers", value: activeSubscribers.toString() },
      { label: "Total Views", value: totalViews.toLocaleString() },
      { label: "PPV Revenue", value: `${formatSTX(ppvEarned)} STX` },
    ];
  }, [transactions, content, subscribers]);

  const recentSubscribers = useMemo(() => {
    return subscribers
      .slice()
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 5);
  }, [subscribers]);

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto flex w-full max-w-4xl items-center justify-center rounded-3xl border border-border/70 bg-card/80 px-8 py-20 text-center text-muted-foreground">
          Preparing your atelier…
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 rounded-3xl border border-border/70 bg-card/80 px-8 py-20 text-center">
          <p className="text-sm text-muted-foreground">
            Connect your wallet to access the creator dashboard.
          </p>
        </div>
      </Layout>
    );
  }

  if (!creator) {
    return null; // Will redirect in useEffect
  }

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="flex items-center justify-between rounded-[28px] border border-border/70 bg-card/80 p-8 shadow-xl">
          <div>
            <p className="text-[11px] uppercase tracking-[0.6em] text-muted-foreground">Creator suite</p>
            <h1 className="text-3xl font-semibold">Creator Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage releases, memberships, and settlements.</p>
          </div>
          <Button size="sm" asChild className="rounded-full px-6 text-xs uppercase tracking-[0.3em]">
            <Link to="/dashboard/creator/upload">
              <Plus className="mr-2 h-3 w-3" /> New
            </Link>
          </Button>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-xs uppercase tracking-[0.4em] text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border/60 bg-background/70 p-5 shadow-sm">
              <p className="text-2xl font-semibold">{isHydrating ? "…" : s.value}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Profile</h2>
            <dl className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div>
                <dt className="uppercase tracking-wide text-[10px]">Display Name</dt>
                <dd className="text-foreground text-sm font-medium">{creator.displayName}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-[10px]">Handle</dt>
                <dd>@{creator.username}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-[10px]">Wallet</dt>
                <dd className="font-mono text-[11px] break-all">{creator.walletAddress}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-[10px]">BNS</dt>
                <dd>{creator.bns || "Not set"}</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-[10px]">Subscription Fee</dt>
                <dd>{creator.subscriptionFee} STX / month</dd>
              </div>
              <div>
                <dt className="uppercase tracking-wide text-[10px]">Joined</dt>
                <dd>{formatDate(creator.createdAt) || "-"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/80 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Recent Subscribers</h2>
            {recentSubscribers.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">No subscribers yet.</p>
            ) : (
              <ul className="mt-4 space-y-2 text-xs text-muted-foreground">
                {recentSubscribers.map((sub) => (
                  <li key={sub.id} className="flex items-center justify-between">
                    <span className="font-mono text-[11px]">{sub.subscriberWallet.slice(0, 6)}…{sub.subscriberWallet.slice(-4)}</span>
                    <span>{formatDistanceToNow(new Date(sub.startedAt), { addSuffix: true })}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Tabs defaultValue="content" className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-lg">
          <TabsList className="w-full justify-start gap-2 bg-transparent">
            <TabsTrigger value="content" className="rounded-full px-4 py-2">
              Content
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-full px-4 py-2">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="subscribers" className="rounded-full px-4 py-2">
              Subscribers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-6">
            {isHydrating ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Refreshing content…</p>
            ) : content.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No content yet. Upload your first piece!</p>
            ) : (
              <div className="space-y-3">
                {content.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-5">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium truncate">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {item.viewCount?.toLocaleString() || 0} views · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs capitalize">{item.contentType}</Badge>
                    <div className="text-xs text-muted-foreground text-right w-24">
                      {item.price > 0 ? `${item.price} STX` : "Subscribers"}
                    </div>
                    <Button size="sm" variant="outline" className="text-xs" asChild>
                      <Link to={`/content/${item.id}`}>View</Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            {isHydrating ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading analytics…</p>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No transactions yet.</p>
            ) : (
              <div className="space-y-3">
                {transactions.slice(0, 10).map((tx) => (
                  <div key={tx.id} className="rounded-2xl border border-border/60 bg-background/70 p-5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium capitalize">{tx.type.replace("-", " ")}</span>
                      <Badge variant={tx.status === "confirmed" ? "default" : "outline"} className="text-[10px] uppercase">
                        {tx.status}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {tx.amount} STX · {formatDate(tx.createdAt)}
                    </p>
                    {tx.txHash && (
                      <p className="font-mono text-[10px] mt-1">
                        {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-6)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="subscribers" className="mt-6">
            {isHydrating ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading subscribers…</p>
            ) : subscribers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No subscribers yet.</p>
            ) : (
              <div className="space-y-3">
                {subscribers.map((sub) => (
                  <div key={sub.id} className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-background/70 p-5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px]">{sub.subscriberWallet}</span>
                      <Badge variant={sub.status === "active" ? "default" : "outline"} className="text-[10px] uppercase">
                        {sub.status}
                      </Badge>
                    </div>
                    <div>
                      Started {formatDate(sub.startedAt)} · Expires {formatDate(sub.expiresAt)}
                    </div>
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

export default CreatorDashboard;
