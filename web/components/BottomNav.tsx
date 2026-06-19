'use client'

import Link from 'next/link'
import { Home, BarChart3, MessageCircle, User } from 'lucide-react'

interface BottomNavProps {
  activeTab: 'home' | 'reports' | 'ask-ca' | 'profile'
  language: 'en' | 'hi'
}

const tabs = [
  { id: 'home', label: { en: 'Home', hi: 'होम' }, icon: Home, href: '/' },
  { id: 'reports', label: { en: 'Reports', hi: 'रिपोर्टें' }, icon: BarChart3, href: '/reports' },
  { id: 'ask-ca', label: { en: 'Ask CA', hi: 'CA से पूछें' }, icon: MessageCircle, href: '/ask-ca' },
  { id: 'profile', label: { en: 'Profile', hi: 'प्रोफाइल' }, icon: User, href: '/profile' },
]

export default function BottomNav({ activeTab, language }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-muted rounded-t-2xl shadow-lg">
      <div className="max-w-[440px] mx-auto px-6 py-3 flex justify-between items-center">
        {tabs.map(({ id, label, icon: Icon, href }) => {
          const isActive = activeTab === id
          return (
            <Link
              key={id}
              href={href}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all ${
                isActive
                  ? 'bg-accent/10'
                  : 'hover:bg-muted/10'
              }`}
            >
              <div className={`${isActive ? 'text-accent' : 'text-muted-foreground'}`}>
                <Icon className="w-6 h-6" />
              </div>
              <span className={`text-xs font-semibold ${isActive ? 'text-accent' : 'text-muted-foreground'}`}>
                {label[language]}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
