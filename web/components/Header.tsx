interface HeaderProps {
  title?: string
  subtitle?: string
}

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="w-full bg-gradient-to-b from-background to-transparent">
      <div className="px-6 py-4">
        {title && <h1 className="text-display mb-2">{title}</h1>}
        {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
      </div>
    </header>
  )
}
