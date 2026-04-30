import Google from "@auth/core/providers/google";
import GitHub from "@auth/core/providers/github";
import Apple from "@auth/core/providers/apple";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
    providers: [Google, GitHub, Apple, Password, Anonymous],
    callbacks: {
        async redirect({ redirectTo }) {
            // eslint-disable-next-line no-process-env
            const siteUrl = (process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "").replace(/\/$/, "");
            if (redirectTo.startsWith("/") || redirectTo.startsWith("?")) {
                return siteUrl ? `${siteUrl}${redirectTo}` : redirectTo;
            }
            if (siteUrl && redirectTo.startsWith(siteUrl)) {
                return redirectTo;
            }
            // Allow native app schemes (exp://, myapp://, etc.) for mobile OAuth
            const match = redirectTo.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
            if (match && !["http", "https"].includes(match[1].toLowerCase())) {
                return redirectTo;
            }
            return siteUrl || redirectTo;
        },
    },
});
