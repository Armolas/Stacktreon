import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useParams } from "react-router-dom";
import { Lock, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ContentResponse,
  CreatorResponse,
  SubscriptionStatusResponse,
  checkSubscriptionStatus,
  createTransaction,
  getContentByCreator,
  getCreatorByUsername,
  updateTransactionStatus,
} from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";
import { useSubscriptionContract } from "@/hooks/useSubscriptionContract";

const formatDate = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const normalizeSubscriptionFee = (fee: CreatorResponse["subscriptionFee"]) => {
  const numeric = typeof fee === "string" ? Number.parseFloat(fee) : fee;
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
};

const formatSubscriptionLabel = (fee: CreatorResponse["subscriptionFee"]) => {
  const normalized = normalizeSubscriptionFee(fee);
  return `${normalized.toLocaleString(undefined, {
    minimumFractionDigits: normalized % 1 === 0 ? 0 : 2,
    maximumFractionDigits: normalized % 1 === 0 ? 0 : 2,
  })} STX`;
};

const CreatorProfile = () => {
  const { handle } = useParams();
  const { toast } = useToast();
  const { stxAddress, isAuthenticated, connectWallet } = useWallet();
  const { subscribe: subscribeOnContract } = useSubscriptionContract();

  const [creator, setCreator] = useState<CreatorResponse | null>(null);
  const [content, setContent] = useState<ContentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatusResponse | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  const loadCreator = useCallback(async () => {
    if (!handle) {
      setError("Creator handle not provided.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const creatorResponse = await getCreatorByUsername(handle);
      setCreator(creatorResponse);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load creator profile.";
      setError(message);
      setCreator(null);
    } finally {
      setIsLoading(false);
    }
  }, [handle]);

  useEffect(() => {
    loadCreator();
  }, [loadCreator]);

  const loadContent = useCallback(
    async (creatorId: string, wallet?: string) => {
      setContentLoading(true);
      try {
        const creatorContent = await getContentByCreator(creatorId, wallet);
        setContent(creatorContent);
      } catch (err) {
        console.error("Failed to load content", err);
      } finally {
        setContentLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!creator?.id) {
      setContent([]);
      return;
    }
    loadContent(creator.id, stxAddress || undefined);
  }, [creator?.id, stxAddress, loadContent]);

  const refreshSubscriptionStatus = useCallback(async () => {
    if (!creator?.id || !stxAddress) {
      setSubscriptionStatus(null);
      return;
    }

    try {
      const status = await checkSubscriptionStatus(creator.id, stxAddress);
      setSubscriptionStatus(status);
    } catch (err) {
      console.error("Failed to check subscription", err);
    }
  }, [creator?.id, stxAddress]);

  useEffect(() => {
    refreshSubscriptionStatus();
  }, [refreshSubscriptionStatus]);

  const isSubscribed = subscriptionStatus?.subscribed;
  const isOwner = creator?.walletAddress === stxAddress;

  const handleSubscribe = useCallback(async () => {
    if (!creator || !stxAddress) return;

    setIsSubscribing(true);
    setError(null);

    try {
      toast({
        title: "Confirm in wallet",
        description: "Opening your wallet to complete the subscription…",
      });

      const { txId } = await subscribeOnContract(creator.walletAddress);

      toast({
        title: "Transaction submitted",
        description: `Tx ${txId.slice(0, 8)}… sent. Recording subscription…`,
      });

      const transaction = await createTransaction({
        payerWallet: stxAddress,
        creatorWallet: creator.walletAddress,
        type: "subscription",
        amountCents: normalizeSubscriptionFee(creator.subscriptionFee),
        txHash: txId,
        status: "pending",
      });

      await updateTransactionStatus(transaction.id, "confirmed", txId);

      toast({
        title: "Subscription confirmed",
        description: "Welcome aboard! Enjoy premium content.",
      });

      refreshSubscriptionStatus();
      loadContent(creator.id, stxAddress);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Subscription failed.";
      setError(message);
      toast({
        variant: "destructive",
        title: "Subscription failed",
        description: message,
      });
    } finally {
      setIsSubscribing(false);
    }
  }, [creator, stxAddress, subscribeOnContract, toast, refreshSubscriptionStatus, loadContent]);

  const handlePrimaryAction = async () => {
    if (!creator) return;

    if (!isAuthenticated || !stxAddress) {
      try {
        await connectWallet();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Wallet connection failed.";
        toast({
          variant: "destructive",
          title: "Connection failed",
          description: message,
        });
      }
      return;
    }

    if (isSubscribed) {
      toast({
        title: "Already subscribed",
        description: "You already have access to this creator.",
      });
      return;
    }

    handleSubscribe();
  };

  const heroInitial = useMemo(() => {
    if (!creator?.displayName) return "?";
    return creator.displayName.charAt(0).toUpperCase();
  }, [creator?.displayName]);

  const contentList = useMemo(() => {
    if (!content.length) return null;

    return content.map((item) => (
      <Link
        key={item.id}
        to={`/content/${item.id}`}
        className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-background/70 p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
      >
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
            <span className="capitalize">{item.contentType}</span>
            <span>· {formatDate(item.createdAt)}</span>
          </div>
          <h3 className="truncate text-sm font-medium">{item.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          {item.locked ? (
            <>
              <Lock className="w-3 h-3" /> {item.price ? `Pay ${item.price} STX` : "Subscribe"}
            </>
          ) : item.price === 0 ? (
            "Complimentary"
          ) : (
            <>
              <Zap className="w-3 h-3" /> {item.price} STX
            </>
          )}
        </span>
      </Link>
    ));
  }, [content]);

  if (isLoading) {
    return (
      <Layout>
        <div className="mx-auto flex w-full max-w-4xl items-center justify-center rounded-3xl border border-border/70 bg-card/80 px-8 py-20 text-center text-muted-foreground">
          Loading curator profile…
        </div>
      </Layout>
    );
  }

  if (error || !creator) {
    return (
      <Layout>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 rounded-3xl border border-destructive/40 bg-destructive/10 px-8 py-20 text-center text-destructive">
          <p>{error || "Creator not found."}</p>
          <Button size="sm" variant="outline" onClick={loadCreator}>
            Retry
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        <div className="rounded-[30px] border border-border/70 bg-card/80 p-8 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/70 text-2xl font-semibold">
                {heroInitial}
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">Premium creator</p>
                <h1 className="text-3xl font-semibold">{creator.displayName}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>@{creator.username}</span>
                  {creator.bns && <span>· {creator.bns}</span>}
                  <span>· Since {formatDate(creator.createdAt)}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 text-right">
              <Button
                size="lg"
                className="rounded-full px-8 text-xs tracking-[0.3em]"
                onClick={handlePrimaryAction}
                disabled={isSubscribing || isSubscribed}
              >
                {isAuthenticated ? (
                  isSubscribed ? (
                    "Subscribed"
                  ) : isSubscribing ? (
                    "Processing…"
                  ) : (
                    <>
                      Subscribe {formatSubscriptionLabel(creator.subscriptionFee)}
                      <span className="ml-1 font-normal text-muted-foreground">/ mo</span>
                    </>
                  )
                ) : (
                  "Connect Wallet"
                )}
              </Button>
              {isSubscribed && subscriptionStatus?.expiresAt && (
                <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
                  Access until {formatDate(subscriptionStatus.expiresAt)}
                </p>
              )}
              {!isSubscribed && (
                <p className="text-[11px] text-muted-foreground uppercase tracking-[0.3em]">
                  Or unlock individual pieces via pay-per-view.
                </p>
              )}
            </div>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">{creator.bio}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(creator.categories && creator.categories.length > 0 ? creator.categories : ["Curator"]).map((category) => (
              <Badge key={category} variant="outline" className="rounded-full border-border/60 px-4 py-1 text-xs uppercase tracking-[0.3em]">
                {category}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border/60 bg-card/80 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Profile</h2>
            <dl className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.4em]">Wallet</dt>
                <dd className="font-mono text-xs">{creator.walletAddress}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.4em]">BNS</dt>
                <dd>{creator.bns || "Not set"}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.4em]">Subscription</dt>
                <dd>{formatSubscriptionLabel(creator.subscriptionFee)} / month</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">Essentials</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Choose the full subscription for recurring drops, or unlock individual releases via one-time pay-per-view.
              Every purchase immediately settles on-chain and grants private viewing links.
            </p>
            {isOwner && (
              <p className="mt-4 text-xs text-muted-foreground">
                Maintain your profile from the{" "}
                <Link to="/dashboard/creator" className="underline">
                  Creator Dashboard
                </Link>
                .
              </p>
            )}
          </div>
        </div>

        <Tabs defaultValue="content" className="rounded-2xl border border-border/60 bg-card/80 p-6">
          <TabsList className="w-full justify-start gap-2 bg-transparent">
            <TabsTrigger value="content" className="rounded-full px-4 py-2">
              Premium Content
            </TabsTrigger>
            <TabsTrigger value="about" className="rounded-full px-4 py-2">
              About
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="mt-6">
            {contentLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Preparing the catalog…</p>
            ) : content.length ? (
              <div className="space-y-2">{contentList}</div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No premium drops yet.</p>
            )}
          </TabsContent>

          <TabsContent value="about" className="mt-6">
            <div className="space-y-3 text-sm text-muted-foreground">
              {creator.about ? (
                creator.about.split("\n").map((paragraph, index) => <p key={index}>{paragraph}</p>)
              ) : (
                <p>This creator has not added an about section yet.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default CreatorProfile;
