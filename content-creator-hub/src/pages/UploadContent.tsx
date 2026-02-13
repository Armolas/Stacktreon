import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadContent, getCreatorByWallet } from "@/lib/api";
import { useWallet } from "@/contexts/WalletContext";

const UploadContent = () => {
  const navigate = useNavigate();
  const { stxAddress, isAuthenticated } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [fileType, setFileType] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !isAuthenticated || !stxAddress) {
      setError("Please connect your wallet and select a file");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Get creator ID from wallet address
      const creator = await getCreatorByWallet(stxAddress);

      await uploadContent(
        creator.id,
        file,
        title,
        description,
        parseFloat(price) || 0
      );

      navigate("/dashboard/creator");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload content";

      // If creator not found, redirect to register page
      if (errorMessage.includes("Creator not found") || errorMessage.includes("register as a creator")) {
        navigate("/dashboard/creator/register");
        return;
      }

      setError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const detectedType = file
    ? file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("audio/")
      ? "audio"
      : "article"
    : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-lg">
        <div className="mb-8">
          <h1 className="text-xl font-semibold">Upload Content</h1>
          <p className="text-sm text-muted-foreground">
            Add new content for your subscribers. Set a price for pay-per-view or leave at 0 for subscriber-only.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Building a Stacks dApp from Scratch"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your content..."
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Content Type</Label>
            <Select value={fileType} onValueChange={setFileType} required>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="price">Pay-Per-View Price (STX)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step="any"
              placeholder="0"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Set to 0 if this content is for subscribers only.</p>
          </div>

          <div className="space-y-1.5">
            <Label>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="video/*,image/*,audio/*,application/pdf,.md,.txt"
            />
            {file ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · Detected type: {detectedType}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 p-8 rounded-lg border border-dashed border-border hover:border-foreground/30 transition-colors text-muted-foreground hover:text-foreground"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm">Click to select a file</span>
                <span className="text-xs">Video, image, audio, PDF, or text</span>
              </button>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={!file || isUploading}>
            {isUploading ? "Uploading..." : "Upload Content"}
          </Button>
        </form>
      </div>
    </Layout>
  );
};

export default UploadContent;
