import type { NextConfig } from "next";

// Security headers applied to every route. This app renders per-request (auth-gated, live data), so
// there's no SSG constraint driving a permissive CSP — script-src stays 'self' + 'unsafe-inline' only
// because Next's inline bootstrap + our small inline theme script need it; everything else is locked
// down. Dev additionally needs 'unsafe-eval' + ws: for React Fast Refresh / HMR.
const isProd = process.env.NODE_ENV === "production";

const csp = [
	"default-src 'self'",
	`script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob:",
	"font-src 'self' data:",
	`connect-src 'self'${isProd ? "" : " ws: wss:"}`,
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
	...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
	{ key: "Content-Security-Policy", value: csp },
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
	...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
	// This app never uses next/image (no photo uploads — see docs/DEVPLAN.md's non-goals). `sharp`
	// ships native .node bindings per-platform that esbuild can't bundle into a Cloudflare Worker (V8
	// isolate, no native binary loading). `images.unoptimized` alone stops it from being CALLED at
	// runtime but doesn't stop Next's build from still trying to BUNDLE it — `serverExternalPackages`
	// is what actually keeps esbuild from touching it (marks it external instead of inlining it).
	images: { unoptimized: true },
	serverExternalPackages: ["sharp"],
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
