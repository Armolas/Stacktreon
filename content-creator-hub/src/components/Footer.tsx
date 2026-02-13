import { Link } from "react-router-dom";

const footerLinks = [
  { label: "Explore", to: "/explore" },
  { label: "Creators", to: "/dashboard/creator" },
  { label: "Feed", to: "/dashboard/fan" },
];

const Footer = () => (
  <footer className="border-t border-border/60 bg-background/80 backdrop-blur">
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="uppercase tracking-[0.3em] text-foreground">Stacktreon</p>
        <p className="mt-2 text-muted-foreground">
          © {new Date().getFullYear()} Stacktreon - built on Stacks & x402.
        </p>
      </div>
      <div className="flex gap-6">
        {footerLinks.map((link) => (
          <Link key={link.label} to={link.to} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
        <a className="cursor-not-allowed opacity-60">Docs</a>
      </div>
    </div>
  </footer>
);

export default Footer;
