interface BackgroundProps {
    children: React.ReactNode;
    className?: string;
}

const Background = ({ children, className = "" }: BackgroundProps) => {
    return (
        <div className={`min-h-screen bg-linear-to-br from-background via-muted/30 to-background relative overflow-hidden ${className}`}>
            {/* Ambient Floating Orbs */}
            <div className="absolute inset-0">
                <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-20 right-20 w-72 h-72 bg-ring/15 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-secondary/30 rounded-full blur-3xl animate-pulse delay-500"></div>
            </div>

            {/* Ambient Floating Dots */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-ring/30 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '3s' }}></div>
                <div className="absolute top-3/4 left-1/3 w-1 h-1 bg-primary/30 rounded-full animate-bounce" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
                <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 bg-secondary/40 rounded-full animate-bounce" style={{ animationDelay: '2s', animationDuration: '3.5s' }}></div>
                <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-ring/20 rounded-full animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '4.5s' }}></div>
                <div className="absolute bottom-1/3 left-1/5 w-2 h-2 bg-primary/20 rounded-full animate-bounce" style={{ animationDelay: '1.5s', animationDuration: '3.8s' }}></div>
            </div>

            {/* Ambient Vertical Lines */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-px h-32 bg-linear-to-b from-transparent via-primary/20 to-transparent animate-pulse"></div>
                <div className="absolute top-0 right-1/3 w-px h-24 bg-linear-to-b from-transparent via-ring/20 to-transparent animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute bottom-0 left-1/3 w-px h-28 bg-linear-to-t from-transparent via-secondary/30 to-transparent animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            {/* Subtle Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] text-border/40 bg-size-[50px_50px]"></div>

            {/* Bottom Fade */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background/70 to-transparent pointer-events-none"></div>

            {/* Content */}
            {children}
        </div>
    );
};

export default Background;