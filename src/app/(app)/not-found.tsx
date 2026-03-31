import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-sm text-muted-foreground">
        {"The page you're looking for doesn't exist."}
      </p>
      <Link
        href="/chat"
        className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
      >
        Go home
      </Link>
    </div>
  );
}
