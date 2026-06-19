'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, X, ChevronRight } from 'lucide-react'
import BottomNav from '../../components/BottomNav'
import LanguageToggle from '../../components/LanguageToggle'

interface Invoice {
  id: string
  supplier: string
  invoiceNumber: string
  date: string
  amount: number
  status: 'accept' | 'hold' | 'reject'
  reason: string
}

const mockInvoices: Invoice[] = [
  {
    id: '1',
    supplier: 'Sharma Wholesale Pvt Ltd',
    invoiceNumber: 'INV-2024-001',
    date: '2024-06-15',
    amount: 45000,
    status: 'accept',
    reason: 'Matches perfectly',
  },
  {
    id: '2',
    supplier: 'Delhi Distributors',
    invoiceNumber: 'INV-2024-045',
    date: '2024-06-12',
    amount: 32500,
    status: 'hold',
    reason: 'GSTIN mismatch with 2B',
  },
  {
    id: '3',
    supplier: 'Quick Supply Co',
    invoiceNumber: 'INV-2024-089',
    date: '2024-06-10',
    amount: 18900,
    status: 'reject',
    reason: 'Filed late by supplier',
  },
]

const content = {
  en: {
    title: 'Your invoices, reviewed',
    acceptCount: 'Accept',
    holdCount: 'Hold',
    rejectCount: 'Reject',
    reasonLabel: 'Reason',
    overrideTitle: 'Override',
    bottomSummary: 'ITC at risk / ITC safe',
    proceed: 'Proceed to filing',
  },
  hi: {
    title: 'आपके इनवॉइस, समीक्षित',
    acceptCount: 'स्वीकार',
    holdCount: 'रोकें',
    rejectCount: 'अस्वीकार',
    reasonLabel: 'कारण',
    overrideTitle: 'ओवरराइड',
    bottomSummary: 'जोखिम में ITC / सुरक्षित ITC',
    proceed: 'फाइलिंग के लिए आगे बढ़ें',
  },
}

export default function Results() {
  const [language, setLanguage] = useState<'en' | 'hi'>('en')
  const [invoices, setInvoices] = useState(mockInvoices)

  const t = content[language]

  const acceptCount = invoices.filter(i => i.status === 'accept').length
  const holdCount = invoices.filter(i => i.status === 'hold').length
  const rejectCount = invoices.filter(i => i.status === 'reject').length

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'accept':
        return 'status-accept'
      case 'hold':
        return 'status-hold'
      case 'reject':
        return 'status-reject'
      default:
        return ''
    }
  }

  const getStatusLabel = (status: string) => {
    const labels = {
      en: { accept: 'Accept', hold: 'Hold', reject: 'Reject' },
      hi: { accept: 'स्वीकार', hold: 'रोकें', reject: 'अस्वीकार' },
    }
    return labels[language][status as keyof typeof labels['en']] || status
  }

  return (
    <main className="min-h-dvh flex flex-col bg-background pb-24">
      {/* Header */}
      <div className="pt-6 px-6 pb-4">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-h1 font-bold">{t.title}</h1>
          </div>
          <LanguageToggle language={language} setLanguage={setLanguage} />
        </div>

        {/* Summary chips */}
        <div className="flex gap-2 overflow-x-auto pb-4">
          <div className="status-badge status-accept whitespace-nowrap">
            <span>{acceptCount}</span>
            <span className="text-caption">{t.acceptCount}</span>
          </div>
          <div className="status-badge status-hold whitespace-nowrap">
            <span>{holdCount}</span>
            <span className="text-caption">{t.holdCount}</span>
          </div>
          <div className="status-badge status-reject whitespace-nowrap">
            <span>{rejectCount}</span>
            <span className="text-caption">{t.rejectCount}</span>
          </div>
        </div>
      </div>

      {/* Invoice Cards */}
      <div className="flex-1 px-6 space-y-4">
        {invoices.map((invoice) => (
          <Link key={invoice.id} href={`/invoice/${invoice.id}`}>
            <div className="card hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-2">
                    <h3 className="text-label font-semibold text-foreground truncate">
                      {invoice.supplier}
                    </h3>
                    <span className={`status-badge ${getStatusClass(invoice.status)} text-xs whitespace-nowrap`}>
                      {getStatusLabel(invoice.status)}
                    </span>
                  </div>
                  <p className="text-caption text-muted-foreground mb-2">
                    {invoice.invoiceNumber} • {invoice.date}
                  </p>
                  <p className="text-caption text-muted-foreground">{invoice.reason}</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <div className="text-right">
                    <p className="text-h2 font-bold text-foreground">
                      ₹{(invoice.amount / 100000).toFixed(1)}L
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 rounded-lg bg-accept-bg hover:bg-accept-fg/10 text-accept-fg">
                      <Check className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-lg bg-reject-bg hover:bg-reject-fg/10 text-reject-fg">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-3">
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom summary bar */}
      <div className="fixed bottom-20 left-0 right-0 bg-card border-t border-muted px-6 py-4">
        <div className="max-w-[440px] mx-auto">
          <p className="text-caption text-muted-foreground mb-3">{t.bottomSummary}</p>
          <button className="w-full button-primary">
            {t.proceed}
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="reports" language={language} />
    </main>
  )
}
