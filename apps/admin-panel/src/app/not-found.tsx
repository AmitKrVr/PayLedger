import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="flex flex-col items-center justify-center gap-6 text-center max-w-md">
                <div className="flex flex-col items-center gap-4">
                    <div className="rounded-full bg-muted p-6">
                        <FileQuestion className="size-12 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-6xl font-bold tracking-tight text-foreground">404</h1>
                        <h2 className="text-2xl font-semibold text-foreground">Page Not Found</h2>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                            The page you are looking for doesn&apos;t exist or has been moved.
                        </p>
                    </div>
                </div>
                <Button variant="default" size="lg">
                    <Link href="/">Go to Home</Link>
                </Button>
            </div>
        </div>
    );
};

export default NotFound;