import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Zap, Shield, Eye, Users, TrendingUp, Layers } from "lucide-react";

const FEATURES = [
  { icon: Zap, title: "Instant Unlocks", desc: "x402 pay-per-view settles the moment someone taps “Unlock”." },
  { icon: Users, title: "Optional Memberships", desc: "Monthly access tiers for superfans who want everything." },
  { icon: Shield, title: "Custody in Your Hands", desc: "No opaque platforms - just wallets, signatures, and trust." },
  { icon: Eye, title: "Discreet Paywalls", desc: "HTTP-native flows that feel invisible yet secure." },
  { icon: TrendingUp, title: "Clarity Insights", desc: "Revenue, cohorts, renewals - all distilled for action." },
  { icon: Layers, title: "Stacks Native", desc: "Bitcoin security with the elegance of curated software." },
];

const STAT_CARDS = [
  { label: "Creators", value: "3,200+", detail: "Publishing premium drops" },
  { label: "Avg. renewal", value: "91%", detail: "Subscriptions / last 30d" },
  { label: "Pay-per-view unlocks", value: "240k", detail: "Instant STX settlements" },
];

const Index = () => {
  return (
    <Layout>
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-12 rounded-[32px] border border-border/60 bg-card/70 px-6 py-16 text-center shadow-2xl lg:px-16">
        <p className="text-[11px] uppercase tracking-[0.8em] text-muted-foreground">
          Curated experiences on Bitcoin
        </p>
        <div className="max-w-3xl">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
            A creator home with subscription and pay-per-view superpowers.
          </h1>
          <p className="mt-6 text-base text-muted-foreground">
            Stacktreon pairs monthly membership and à la carte premium drops. Fans can subscribe - or simply pay once to
            view a single release - while creators enjoy instant, on-chain settlement.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-xs uppercase tracking-[0.4em] text-muted-foreground sm:flex-row sm:gap-8">
          {STAT_CARDS.map((card) => (
            <div key={card.label} className="flex flex-col items-center gap-1">
              <span className="text-3xl font-semibold tracking-tight text-foreground">{card.value}</span>
              <span>{card.label}</span>
              <span className="tracking-normal normal-case text-muted-foreground/70">{card.detail}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/explore">
            <Button size="lg" className="rounded-full px-8 text-xs tracking-[0.3em]">
              Discover creators <ArrowRight className="ml-2 h-3 w-3" />
            </Button>
          </Link>
          <Link to="/dashboard/creator">
            <Button
              size="lg"
              variant="outline"
              className="rounded-full border-border/70 bg-transparent px-8 text-xs tracking-[0.3em]"
            >
              Become a host
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto mt-16 w-full max-w-6xl rounded-[28px] border border-border/70 bg-background/70 px-6 py-14 shadow-lg lg:px-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          <div className="lg:w-1/3">
            <p className="text-[11px] uppercase tracking-[0.6em] text-muted-foreground">Why Stacktreon</p>
            <h2 className="mt-4 text-2xl font-semibold leading-tight">
              Payments, memberships, and vault-grade custody - wrapped in calm UI.
            </h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Every surface favors whitespace, restrained color, and intentional feedback. Dark mode mirrors light mode with
              the same elegance, ensuring collectors feel confidence at every interaction.
            </p>
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <feature.icon className="mb-4 h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
