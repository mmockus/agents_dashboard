import { Sparkles, ExternalLink } from 'lucide-react'

const USAGE_URL = 'https://aistudio.google.com/rate-limit?timeRange=last-28-days'

function GoogleAIUsage() {
  return (
    <div className="bg-carbon/60 border border-steel/50 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate/30 border-b border-steel/30">
        <Sparkles className="w-3.5 h-3.5 text-gemini" />
        <span className="font-mono text-xs text-silver uppercase tracking-wider">
          Google AI Usage
        </span>
      </div>
      <div className="p-4">
        <a
          href={USAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 font-mono text-xs text-gemini hover:text-gemini/80 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View usage in AI Studio
        </a>
      </div>
    </div>
  )
}

export default GoogleAIUsage
