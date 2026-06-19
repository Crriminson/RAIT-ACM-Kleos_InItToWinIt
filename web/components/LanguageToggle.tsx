interface LanguageToggleProps {
  language: 'en' | 'hi'
  setLanguage: (lang: 'en' | 'hi') => void
}

export default function LanguageToggle({ language, setLanguage }: LanguageToggleProps) {
  return (
    <div className="flex gap-1 bg-muted/20 rounded-full p-1 border border-muted">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
          language === 'en'
            ? 'bg-accent text-white'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('hi')}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
          language === 'hi'
            ? 'bg-accent text-white'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        HI
      </button>
    </div>
  )
}
