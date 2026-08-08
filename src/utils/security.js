import helmet from "helmet";

export const helmetMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"], // Only allow content from the same origin
            scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://adminlte.io",
            ], // Allow scripts from self (and inline scripts if necessary)
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://fonts.googleapis.com",
                "https://code.ionicframework.com"
            ], // Allow inline styles
            imgSrc: ["'self'", "data:"], // Allow images from self and data URIs
            connectSrc: ["'self'"], // Allow only self for API calls
            fontSrc: [
                "'self'",
                "https://fonts.googleapis.com",
                "https://fonts.gstatic.com",  
                "https://code.ionicframework.com"
            ], // Allow Google Fonts
            frameAncestors: ["'none'"], // Prevents embedding in iframes
            upgradeInsecureRequests: [], // Auto-upgrade HTTP requests to HTTPS
        },
    },
});