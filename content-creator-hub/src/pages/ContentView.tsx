import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Lock, Zap, ArrowLeft, Calendar } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { getContentById, checkSubscriptionStatus } from "@/lib/api";
import { fetchPaidContent } from "@/lib/x402Client";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Content {
  id: string;
  title: string;
  description: string;
  contentType: string;
  price: number;
  fileUrl: string | null;
  locked?: boolean;
  viewCount: number;
  createdAt: string;
  creator: {
    id: string;
    displayName: string;
    username: string;
    subscriptionFee: number;
  };
}

const ContentView = () => {
  const { id } = useParams();
  const { stxAddress, isAuthenticated } = useWallet();
  const { toast } = useToast();
  const [content, setContent] = useState<Content | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      if (!id) return;

      try {
        const data = await getContentById(id, stxAddress || undefined);
        setContent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [id, stxAddress]);

  const isLocked = content?.locked || (content?.price && content.price > 0 && !content.fileUrl);


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handlePayPerView = async () => {
    if (!isAuthenticated || !stxAddress) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to make a payment",
        variant: "destructive",
      });
      return;
    }

    if (!id) return;

    setIsPaying(true);
    setError(null);

    try {
      const paidContent = await fetchPaidContent(
        id,
        stxAddress,
        (amount) => {
          toast({
            title: "Payment Required",
            description: `Opening wallet to pay ${amount} STX...`,
          });
        },
        (txId) => {
          toast({
            title: "Payment Submitted",
            description: `Waiting for blockchain confirmation... This may take 1-2 minutes.`,
            duration: 5000,
          });
        }
      );

      // Update content with unlocked data
      setContent(paidContent.data);

      toast({
        title: "Success!",
        description: "Content unlocked. Enjoy!",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      toast({
        title: "Payment Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPaying(false);
    }
  };

  const renderContent = () => {
    if (!content?.fileUrl) return null;

    switch (content.contentType) {
      case 'video':
        return (
          <div className="rounded-2xl overflow-hidden bg-black shadow-lg">
            <video
              controls
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              playsInline
              className="w-full"
            >
              <source src={content.fileUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        );
      case 'audio':
        return (
          <div className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-sm">
            <audio
              controls
              controlsList="nodownload"
              preload="metadata"
              className="w-full"
            >
              <source src={content.fileUrl} type="audio/mpeg" />
              Your browser does not support the audio tag.
            </audio>
          </div>
        );
      default:
        if (content.fileUrl?.endsWith('.pdf')) {
          return (
            <div className="rounded-2xl border border-border overflow-hidden shadow-sm" style={{ height: '600px' }}>
              <iframe
                src={content.fileUrl}
                className="w-full h-full"
                title={content.title}
              />
            </div>
          );
        }
        return (
          <div className="rounded-2xl border border-border/70 overflow-hidden shadow-sm">
            <iframe
              src={content.fileUrl}
              className="w-full min-h-[400px]"
              title={content.title}
            />
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <p className="text-center text-muted-foreground">Loading...</p>
        </div>
      </Layout>
    );
  }

  if (error || !content) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-2xl">
          <p className="text-center text-red-600">{error || 'Content not found'}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <Link to="/explore" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3 h-3" /> Back
        </Link>

        <article>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="capitalize">{content.contentType}</span>
            <span>· {formatDate(content.createdAt)}</span>
            <span>· {content.viewCount.toLocaleString()} views</span>
          </div>

          <h1 className="text-2xl font-semibold mb-4">
            {content.title}
          </h1>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm">
              {content.creator.displayName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium">{content.creator.displayName}</p>
              <p className="text-xs text-muted-foreground">@{content.creator.username}</p>
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-4 mb-8">
            <p>{content.description}</p>
          </div>

          {isLocked ? (
            <div className="rounded-lg border border-border p-8 text-center">
              <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium text-sm mb-1">Premium Content</h3>
              <p className="text-xs text-muted-foreground mb-5 max-w-sm mx-auto">
                This content is locked. Choose how to access it.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="sm"
                  onClick={handlePayPerView}
                  disabled={isPaying || !isAuthenticated}
                >
                  <Zap className="w-3 h-3" />
                  {isPaying ? 'Processing...' : `Pay ${content.price} STX`}
                </Button>
                <Button size="sm" variant="outline" disabled>
                  <Calendar className="w-3 h-3" /> Subscribe {content.creator.subscriptionFee} STX/mo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                {isAuthenticated ? 'Payments on Stacks blockchain' : 'Connect wallet to pay'}
              </p>
            </div>
          ) : (
            <div className="mb-8">
              {renderContent()}
            </div>
          )}
        </article>
      </div>
    </Layout>
  );
};

export default ContentView;
