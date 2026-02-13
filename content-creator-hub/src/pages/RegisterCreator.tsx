import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { registerCreator } from "@/lib/api";
import { useSubscriptionContract } from "@/hooks/useSubscriptionContract";

const CATEGORIES = [
  'Digital Art',
  'Music',
  'Writing',
  'Education',
  'Gaming',
  'Photography',
  'Development',
  'Video Production',
  'Podcasting',
  'Comics',
  'Animation',
  'Crafts',
  'Technology',
  'Fitness',
  'Cooking',
  'Other'
];

const RegisterCreator = () => {
  const navigate = useNavigate();
  const { stxAddress, isAuthenticated } = useWallet();
  const { toast } = useToast();
  const { registerCreator: registerOnContract } = useSubscriptionContract();
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    walletAddress: "",
    bns: "",
    subscriptionFee: 0,
    bio: "",
    about: "",
    categories: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registrationStep, setRegistrationStep] = useState<string>("");

  // Auto-fill wallet address when connected
  useEffect(() => {
    if (stxAddress) {
      setForm((prev) => ({ ...prev, walletAddress: stxAddress }));
    }
  }, [stxAddress]);

  const update = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleCategory = (category: string) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !stxAddress) {
      setError("Please connect your wallet first");
      return;
    }

    if (form.subscriptionFee <= 0) {
      setError("Subscription fee must be greater than 0");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Step 1: Register on smart contract
      setRegistrationStep("Registering on blockchain...");
      toast({
        title: "Step 1/2",
        description: "Opening wallet to register on blockchain...",
      });

      const { txId } = await registerOnContract(stxAddress, form.subscriptionFee);

      toast({
        title: "Transaction Submitted",
        description: `Transaction ID: ${txId.slice(0, 8)}...`,
      });

      // Step 2: Register on backend after contract registration
      setRegistrationStep("Saving profile to database...");
      toast({
        title: "Step 2/2",
        description: "Saving your creator profile...",
      });

      const creator = await registerCreator(form);

      toast({
        title: "Success!",
        description: "Creator profile created successfully",
      });

      // Redirect to dashboard after successful registration
      navigate("/dashboard/creator");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to register creator";
      setError(errorMessage);
      toast({
        title: "Registration Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setRegistrationStep("");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-lg">
        <div className="mb-8">
          <h1 className="text-xl font-semibold">Become a Creator</h1>
          <p className="text-sm text-muted-foreground">
            No creator profile found for this wallet. Set up your profile to start monetizing your content.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}

        {!isAuthenticated && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
            Please connect your wallet to register as a creator
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="devdao"
              minLength={3}
              required
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Min 3 characters. This will be your unique handle.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="DevDAO"
              required
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="walletAddress">Wallet Address</Label>
            <Input
              id="walletAddress"
              placeholder="SP2..."
              required
              value={form.walletAddress}
              onChange={(e) => update("walletAddress", e.target.value)}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Your connected Stacks wallet address (auto-filled).</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bns">BNS Name</Label>
            <Input
              id="bns"
              placeholder="devdao.btc"
              required
              value={form.bns}
              onChange={(e) => update("bns", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subscriptionFee">Monthly Subscription Fee (STX)</Label>
            <Input
              id="subscriptionFee"
              type="number"
              min={0}
              step="any"
              placeholder="5"
              required
              value={form.subscriptionFee || ""}
              onChange={(e) => update("subscriptionFee", parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Input
              id="bio"
              placeholder="A short one-liner about you"
              required
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="about">About</Label>
            <Textarea
              id="about"
              placeholder="Tell fans more about what you create and why they should subscribe..."
              required
              rows={4}
              value={form.about}
              onChange={(e) => update("about", e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Categories (Optional)</Label>
            <p className="text-xs text-muted-foreground">Select categories that best describe your content</p>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={category}
                    checked={form.categories.includes(category)}
                    onCheckedChange={() => toggleCategory(category)}
                  />
                  <Label
                    htmlFor={category}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={!isAuthenticated || isSubmitting}>
            {isSubmitting ? (registrationStep || "Creating Profile...") : "Create Profile"}
          </Button>
          {registrationStep && (
            <p className="text-sm text-center text-muted-foreground">
              {registrationStep}
            </p>
          )}
        </form>
      </div>
    </Layout>
  );
};

export default RegisterCreator;
