import Layout from "@/components/Layout";
import { Link } from "react-router-dom";

const NotFound = () => (
  <Layout>
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 rounded-3xl border border-border/70 bg-card/80 px-8 py-20 text-center">
      <h1 className="text-4xl font-semibold">404</h1>
      <p className="text-sm text-muted-foreground">That page doesn't exist.</p>
      <Link to="/" className="text-sm text-primary underline hover:text-primary/90">
        Return home
      </Link>
    </div>
  </Layout>
);

export default NotFound;
