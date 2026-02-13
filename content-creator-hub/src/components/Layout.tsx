import Navbar from "./Navbar";
import Footer from "./Footer";

const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="relative flex min-h-screen flex-col bg-background text-foreground">
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/10 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-muted/20 to-transparent blur-3xl" />
    </div>
    <Navbar />
    <main className="flex-1 px-4 pt-24 pb-16 md:px-8 lg:px-12">{children}</main>
    <Footer />
  </div>
);

export default Layout;
