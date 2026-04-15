import { Coffee, ExternalLink, Github, Heart, Instagram, MessageSquare } from 'lucide-react'

const KOMETA_PROJECTS = [
  {
    name: 'KometaManga',
    status: 'Live',
    description:
      'Manga metadata manager and auto-downloader. Browse sources, follow series, and keep your library organized.',
    statusColor: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/20',
  },
  {
    name: 'KometaReader',
    status: 'Coming soon',
    description:
      'A streamlined manga reader companion that works alongside your Komga library.',
    statusColor: 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/20',
  },
  {
    name: 'KometaWatcher',
    status: 'Planned',
    description:
      'Anime tracking and notification system to complement your manga workflow.',
    statusColor: 'bg-ink-800/80 text-ink-300 ring-1 ring-ink-700/60',
  },
]

export function AboutPage() {
  return (
    <div className="animate-page-in space-y-10 pb-12">
      {/* Header */}
      <section>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.28em] text-ink-400">
          <Heart className="h-3.5 w-3.5 text-purple-400" />
          About
        </div>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
          KometaHub
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-ink-300">
          A suite of tools for manga and anime enthusiasts. Built with care, designed for power users.
        </p>
      </section>

      {/* Projects */}
      <section className="space-y-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
          Projects
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {KOMETA_PROJECTS.map((project) => (
            <div
              key={project.name}
              className="rounded-[24px] border border-white/10 bg-[#070b16]/90 p-5 shadow-[0_16px_60px_rgba(0,0,0,0.32)]"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-white">{project.name}</h3>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${project.statusColor}`}
                >
                  {project.status}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-ink-400">{project.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About Me */}
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#070b16]/90 p-6 shadow-[0_16px_60px_rgba(0,0,0,0.32)] sm:p-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
          About me
        </h2>
        <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-display text-2xl font-semibold text-white">iCosiSenpai</p>
            <p className="mt-2 text-sm leading-7 text-ink-300">
              Solo developer behind KometaHub. Building tools I wish existed when managing my own manga and anime collection.
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="https://www.instagram.com/icosisenpai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-ink-300 transition-colors hover:bg-white/10 hover:text-white"
              title="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
            <a
              href="https://github.com/iCosiSenpai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-ink-300 transition-colors hover:bg-white/10 hover:text-white"
              title="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Donations */}
      <section className="space-y-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink-500">
          Support the project
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <a
            href="https://buymeacoffee.com/icosisenpai"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 rounded-[24px] border border-white/10 bg-[#070b16]/90 p-5 transition-colors hover:bg-white/5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400">
              <Coffee className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-white group-hover:text-amber-300 transition-colors">
                Buy Me a Coffee
              </p>
              <p className="text-sm text-ink-400">One-time or recurring support</p>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-ink-600 group-hover:text-ink-400" />
          </a>
          <a
            href="https://paypal.me/AlessioCosi"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-4 rounded-[24px] border border-white/10 bg-[#070b16]/90 p-5 transition-colors hover:bg-white/5"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
              <Heart className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-white group-hover:text-blue-300 transition-colors">
                PayPal
              </p>
              <p className="text-sm text-ink-400">Direct donation via PayPal</p>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-ink-600 group-hover:text-ink-400" />
          </a>
        </div>
      </section>

      {/* Feedback */}
      <section className="rounded-[24px] border border-white/10 bg-[#070b16]/90 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-white">Feedback & Bug Reports</p>
              <p className="text-sm text-ink-400">Found a bug or have a suggestion? Open an issue on GitHub.</p>
            </div>
          </div>
          <a
            href="https://github.com/iCosiSenpai/KometaManga/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-ink-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" />
            Open an issue
          </a>
        </div>
      </section>

      {/* Credits */}
      <section className="text-center text-sm text-ink-500">
        <p>
          Based on{' '}
          <a
            href="https://github.com/Snd-R/Komf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-400 hover:text-accent-400 transition-colors"
          >
            Komf by Snd-R
          </a>
        </p>
      </section>
    </div>
  )
}
