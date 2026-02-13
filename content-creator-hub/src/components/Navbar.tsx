import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Wallet, Menu, X } from "lucide-react";
import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ThemeToggle";

const Navbar = () => {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, stxAddress, connectWallet, disconnectWallet, isConnecting } = useWallet();

  const links = [
    { to: "/explore", label: "Explore" },
    { to: "/dashboard/creator", label: "Creators" },
    { to: "/dashboard/fan", label: "Feed" },
  ];

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-foreground">
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span className="h-3 w-3 rounded-full bg-primary/70" />
            <span className="absolute h-5 w-5 rounded-full bg-primary/20 blur" />
          </span>
          Stacktreon
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-xs uppercase tracking-[0.2em] transition-colors ${
                location.pathname === link.to
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!isAuthenticated ? (
            <Button
              size="sm"
              variant="secondary"
              className="text-xs font-semibold tracking-wide"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              <Wallet className="w-3 h-3" />
              <span className="hidden sm:inline">
                {isConnecting ? "Connecting..." : "Connect"}
              </span>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs font-semibold tracking-wide border border-border/50"
                >
                  <Wallet className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    {stxAddress ? formatAddress(stxAddress) : "Connected"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem
                  onClick={() => navigator.clipboard.writeText(stxAddress || '')}
                >
                  Copy Address
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={disconnectWallet}
                  className="text-red-600"
                >
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            className="rounded-full border border-border/60 p-2 text-foreground md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-border/60 bg-background/95 px-4 py-4 shadow-xl md:hidden">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileOpen(false)}
              className={`block py-2 text-xs uppercase tracking-[0.3em] ${
                location.pathname === link.to
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
