import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-static";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-mono text-zinc-100">
      <Nav />
      <Hero />
      <WhatTriageDoes />
      <HowItWorks />
      <WhatSetsApart />
      <BuiltWith />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="border-b border-zinc-800 bg-[#0a0a0a]/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium tracking-[0.3em] text-zinc-100">
            TRIAGE
          </span>
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-600">
            v1.0
          </span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/Arushi2121/Triage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            GitHub
          </a>
          <Link
            href="/dashboard/login"
            className="text-[10px] tracking-[0.2em] uppercase text-zinc-400 hover:text-emerald-400 transition-colors border border-zinc-800 hover:border-emerald-800 px-4 py-2"
          >
            Sign In →
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
        <div className="lg:col-span-2">
          <p className="text-[10px] tracking-[0.25em] uppercase text-zinc-500 mb-4">
            Issue Orchestration Protocol
          </p>
          <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-zinc-100 leading-tight">
            AI triage for your backlog.
            <br />
            <span className="text-emerald-400">Humans stay in charge.</span>
          </h1>
          <p className="mt-6 text-base text-zinc-400 leading-relaxed max-w-lg">
            Triage classifies GitHub issues and pull requests, detects duplicates using vector similarity, and drafts responses in Slack for maintainer review. Every AI-generated draft is approved, edited, or skipped by a human before it posts.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/login"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-6 py-3 text-sm font-medium text-white transition-colors"
            >
              Sign In
              <span className="text-emerald-100">→</span>
            </Link>
            <a
              href="https://github.com/Arushi2121/Triage"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-zinc-800 hover:border-zinc-600 px-6 py-3 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              View on GitHub
              <span className="text-zinc-500">↗</span>
            </a>
          </div>
          <div className="mt-10 flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500">
              Production · triage-orcin.vercel.app
            </span>
          </div>
        </div>

        <div className="lg:col-span-3 relative border border-zinc-800 bg-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="border-b border-zinc-800 px-4 py-2 flex items-center gap-2 bg-black/40">
            <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-600">
              slack · #all-arushi-dev-workspace
            </span>
          </div>
          <div className="relative">
            <Image
              src="/screenshots/hero-slack-card.png"
              alt="Triage Slack card showing classified bug with drafted response and Approve/Edit/Skip buttons"
              width={1400}
              height={800}
              priority
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function WhatTriageDoes() {
  return (
    <section className="border-b border-zinc-800">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-block w-8 h-px bg-emerald-500"></span>
          <p className="text-xs tracking-[0.2em] uppercase text-zinc-400">
            What Triage Does
          </p>
        </div>
        <p className="text-lg text-zinc-300 leading-relaxed">
          Triage is a Slack-native agent for open-source maintainers drowning in inbound issues and pull requests. It classifies incoming items via LLM, catches duplicates through vector similarity, drafts responses for maintainer review, and surfaces cross-issue patterns across the backlog. Delivered where maintainers already work — Slack — with a Model Context Protocol server exposing the same data to any AI client.
        </p>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Ingest & Classify",
      caption:
        "GitHub webhook fires on issue open. Gemini classifies the item as bug, feature, question, docs, or spam.",
      flow: "Webhook  →  Classify (Gemini)  →  [ type ]",
    },
    {
      number: "02",
      title: "Embed & Match",
      caption:
        "The issue text is embedded and stored in pgvector. Cosine similarity against the backlog surfaces duplicates automatically.",
      flow: "Embed  →  pgvector  →  Similarity ≥ 0.85  →  Flag",
    },
    {
      number: "03",
      title: "Draft & Deliver",
      caption:
        "Decision engine routes by classification. Non-urgent bugs and features get a Gemini-drafted response, sent to Slack as a card.",
      flow: "Route  →  Draft (Gemini)  →  Slack card",
    },
    {
      number: "04",
      title: "Human Decides",
      caption:
        "Maintainer reviews in Slack. Approve posts to GitHub with attribution. Edit refines first, then posts. Skip discards.",
      flow: "Approve → GitHub  |  Edit → GitHub  |  Skip → drop",
    },
  ];

  return (
    <section className="border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-center gap-3 mb-10">
          <span className="inline-block w-8 h-px bg-emerald-500"></span>
          <p className="text-xs tracking-[0.2em] uppercase text-zinc-400">
            How It Works
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-zinc-950 border border-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] p-6"
            >
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-[10px] tracking-[0.2em] uppercase text-emerald-500">
                  Step {step.number}
                </span>
                <h3 className="text-base font-medium text-zinc-100">
                  {step.title}
                </h3>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                {step.caption}
              </p>
              <div className="border-t border-zinc-800 pt-4">
                <pre className="text-[11px] leading-relaxed text-zinc-500 whitespace-pre-wrap font-mono">
                  {step.flow}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhatSetsApart() {
  return (
    <section className="border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-center gap-3 mb-10">
          <span className="inline-block w-8 h-px bg-emerald-500"></span>
          <p className="text-xs tracking-[0.2em] uppercase text-zinc-400">
            What Sets Triage Apart
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-4">
            <FeatureCard
              label="Feature 01"
              title="Human-in-the-loop drafts"
              body="Triage classifies incoming issues and generates a proposed response, then posts it to Slack as a card with Approve, Edit, and Skip buttons. Every draft is reviewed by a maintainer before it reaches GitHub."
              image="/screenshots/hero-slack-card.png"
              imageAlt="Slack card with draft response and three action buttons"
              imageAspect="landscape"
            />

            <FeatureCard
              label="Feature 03"
              title="Cross-issue pattern detection"
              body="LLM-generated clustering surfaces themes across the backlog — recurring bug categories, documentation gaps, workflow friction. Drill into any pattern to see the contributing issues."
              image="/screenshots/dashboard-patterns.png"
              imageAlt="Patterns page showing table of detected themes"
              imageAspect="landscape"
              secondaryImage="/screenshots/dashboard-patterns-drawer.png"
              secondaryImageAlt="Pattern drawer showing full detail and contributing issues"
            />

            <FeatureCard
              label="Feature 05"
              title="MCP server integration"
              body="A remote MCP endpoint exposes list_patterns, search_similar_issues, and get_digest to any Model Context Protocol client — Claude Desktop, Cursor, MCP Inspector, or anything spec-compliant."
              image="/screenshots/mcp-inspector-tools.png"
              imageAlt="MCP Inspector showing three registered tools"
              imageAspect="landscape"
              secondaryImage="/screenshots/mcp-inspector-result.png"
              secondaryImageAlt="MCP Inspector showing tool invocation result with real pattern data"
            />
          </div>

          {/* RIGHT COLUMN */}
          <div className="flex flex-col gap-4">
            <FeatureCard
              label="Feature 02"
              title="Semantic duplicate detection"
              body="Every incoming issue is embedded and matched against the backlog via cosine similarity. When it clears threshold, Triage posts a Slack card flagging the potential duplicate with the source issue linked — maintainers close it or override in one click."
              image="/screenshots/duplicate-detection.png"
              imageAlt="Slack card flagging a potential duplicate with linked source issue"
              imageAspect="landscape"
            />

            <FeatureCard
              label="Feature 04"
              title="On-demand digests"
              body="Run /triage-digest in Slack for a periodic backlog summary — counts by type, PR volume, patterns detected, duplicates caught. Backed by the same pipeline that drives the dashboard."
              image="/screenshots/slack-digest.png"
              imageAlt="Slack rich digest message with metrics and patterns"
              imageAspect="portrait"
            />

            <FeatureCard
              label="Feature 06"
              title="Dashboard"
              body="A dedicated web surface at /dashboard mirrors what maintainers see in Slack — key metrics, latest digest, recent activity — plus history, filters, and drilldown across patterns and the full backlog."
              image="/screenshots/dashboard-overview.png"
              imageAlt="Dashboard overview page with metrics, latest digest, and recent activity"
              imageAspect="landscape"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  label,
  title,
  body,
  image,
  imageAlt,
  imageAspect,
  secondaryImage,
  secondaryImageAlt,
}: {
  label: string;
  title: string;
  body: string;
  image: string;
  imageAlt: string;
  imageAspect: "landscape" | "portrait";
  secondaryImage?: string;
  secondaryImageAlt?: string;
}) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] flex flex-col">
      <div className="p-6 flex-1">
        <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 mb-3">
          {label}
        </p>
        <h3 className="text-lg font-medium text-zinc-100 mb-3">
          {title}
        </h3>
        <p className="text-sm text-zinc-400 leading-relaxed">
          {body}
        </p>
      </div>

      <div className="border-t border-zinc-800 bg-black/40 p-4 space-y-3">
        <div className="border border-zinc-800 overflow-hidden">
          <Image
            src={image}
            alt={imageAlt}
            width={1400}
            height={imageAspect === "landscape" ? 800 : 1400}
            className="w-full h-auto"
          />
        </div>
        {secondaryImage && secondaryImageAlt && (
          <div className="border border-zinc-800 overflow-hidden">
            <Image
              src={secondaryImage}
              alt={secondaryImageAlt}
              width={1400}
              height={800}
              className="w-full h-auto"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function BuiltWith() {
  const stack = [
    "Next.js",
    "TypeScript",
    "React",
    "Tailwind CSS",
    "Node.js",
    "Vercel",
    "Supabase",
    "PostgreSQL",
    "pgvector",
    "Google Gemini",
    "Slack Bolt SDK",
    "GitHub Webhooks",
    "Model Context Protocol",
    "JSON-RPC 2.0",
  ];

  return (
    <section className="border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="flex items-center gap-3 mb-8">
          <span className="inline-block w-8 h-px bg-emerald-500"></span>
          <p className="text-xs tracking-[0.2em] uppercase text-zinc-400">
            Built With
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {stack.map((tech) => (
            <span
              key={tech}
              className="border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-black/40">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="text-lg tracking-[0.3em] text-zinc-100">TRIAGE</p>
            <p className="mt-2 text-[10px] tracking-[0.2em] uppercase text-zinc-600">
              Issue Orchestration Protocol v1.0
            </p>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <a
              href="https://github.com/Arushi2121/Triage"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              github.com/Arushi2121/Triage
            </a>
            <p className="text-[10px] tracking-[0.2em] uppercase text-zinc-600">
              Slack Agent Builder Challenge · 2026
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
