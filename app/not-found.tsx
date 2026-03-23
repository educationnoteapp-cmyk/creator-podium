import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-10">
          <Logo size={28} />
          <span className="font-bold text-text-main text-lg">Creator Podium</span>
        </Link>

        <div className="mb-6">
          <p className="text-xs text-muted font-mono mb-2 tracking-widest uppercase">Error 404</p>
          <h1 className="text-6xl font-bold text-primary mb-1">404</h1>
          <div className="inline-block bg-surface border border-border rounded-lg px-4 py-2 mt-3">
            <code className="text-sm text-muted font-mono">
              <span className="text-red-400">TypeError</span>
              <span className="text-text-main">: page</span>
              <span className="text-amber-400">.tsx</span>
              <span className="text-text-main"> not found</span>
            </code>
          </div>
        </div>

        <p className="text-muted text-sm mb-8 leading-relaxed">
          This page doesn&apos;t exist or the link is broken.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/"
            className="bg-primary hover:bg-primary/90 text-white font-medium px-5 py-2.5 rounded-xl transition-colors text-sm">
            Go Home
          </Link>
        </div>

        <p className="text-xs text-muted/50 mt-10 font-mono">
          {'// if (page === undefined) throw new Error(\'404\')'}
        </p>
      </div>
    </div>
  )
}
