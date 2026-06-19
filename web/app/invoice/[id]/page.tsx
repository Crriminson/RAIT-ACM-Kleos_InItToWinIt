'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, HelpCircle } from 'lucide-react'
import LanguageToggle from '../../../components/LanguageToggle'
import BottomNav from '../../../components/BottomNav'

const content = {
  en: {
    back: 'Back',
    supplier: 'Supplier',
    invoiceNumber: 'Invoice Number',
    invoiceDate: 'Invoice Date',
    taxableValue: 'Taxable Value',
    taxAmount: 'Tax Amount',
    yourInvoice: 'Your Invoice',
    gstr2b: 'GSTR-2B',
    reasonBanner: 'This invoice matches your GSTR-2B return. No action needed.',
    mismatch: 'GSTIN mismatch with the GSTR-2B return',
    accept: 'Accept',
    hold: 'Hold',
    reject: 'Reject',
    askCA: 'Ask your CA about this',
  },
  hi: {
    back: 'वापस',
    supplier: 'आपूर्तिकर्ता',
    invoiceNumber: 'इनवॉइस नंबर',
    invoiceDate: 'इनवॉइस तारीख',
    taxableValue: 'कर योग्य मूल्य',
    taxAmount: 'कर राशि',
    yourInvoice: 'आपका इनवॉइस',
    gstr2b: 'GSTR-2B',
    reasonBanner: 'यह इनवॉइस आपके GSTR-2B रिटर्न से मेल खाता है। कोई कार्रवाई की आवश्यकता नहीं है।',
    mismatch: 'GSTR-2B रिटर्न के साथ GSTIN असंगति',
    accept: 'स्वीकार करें',
    hold: 'रोकें',
    reject: 'अस्वीकार करें',
    askCA: 'इसके बारे में अपने CA से पूछें',
  },
}

export default function InvoiceDetail({ params }: { params: { id: string } }) {
  const [language, setLanguage] = useState<'en' | 'hi'>('en')
  const [selectedAction, setSelectedAction] = useState<'accept' | 'hold' | 'reject'>('accept')

  const t = content[language]

  // Mock data - in real app would fetch based on params.id
  const invoice = {
    id: params.id,
    supplier: 'Sharma Wholesale Pvt Ltd',
    invoiceNumber: 'INV-2024-001',
    invoiceDate: '2024-06-15',
    status: 'accept' as const,
    reason: t.reasonBanner,
    your: {
      gstin: '07ABCDE1234F1Z5',
      taxableValue: 45000,
      taxAmount: 8100,
    },
    gstr2b: {
      gstin: '07ABCDE1234F1Z5',
      taxableValue: 45000,
      taxAmount: 8100,
    },
    mismatch: {
      gstin: false,
      taxableValue: false,
      taxAmount: false,
    },
  }

  const statusColor = {
    accept: 'bg-accept-bg text-accept-fg',
    hold: 'bg-hold-bg text-hold-fg',
    reject: 'bg-reject-bg text-reject-fg',
  }

  return (
    <main className="min-h-dvh flex flex-col bg-background pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-muted">
        <Link href="/results" className="flex items-center gap-2 text-accent hover:opacity-80">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-label">{t.back}</span>
        </Link>
        <h2 className="text-h2 font-semibold flex-1 ml-4">{invoice.supplier}</h2>
        <LanguageToggle language={language} setLanguage={setLanguage} />
      </div>

      {/* Status Banner */}
      <div className={`${statusColor[invoice.status]} px-6 py-4 m-6 rounded-xl`}>
        <p className="text-sm font-medium">{invoice.reason}</p>
      </div>

      {/* Comparison Section */}
      <div className="px-6 space-y-4 flex-1">
        <div className="card">
          <h3 className="text-label font-semibold mb-4 text-foreground">Invoice Details</h3>
          
          {/* Comparison rows */}
          <div className="space-y-3">
            {/* Invoice Number */}
            <div className="flex justify-between items-center">
              <span className="text-caption text-muted-foreground">{t.invoiceNumber}</span>
              <span className="text-label font-semibold text-foreground">{invoice.invoiceNumber}</span>
            </div>

            {/* Invoice Date */}
            <div className="flex justify-between items-center">
              <span className="text-caption text-muted-foreground">{t.invoiceDate}</span>
              <span className="text-label font-semibold text-foreground">{invoice.invoiceDate}</span>
            </div>

            {/* Taxable Value Comparison */}
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-muted">
              <div>
                <p className="text-caption text-muted-foreground mb-2">{t.yourInvoice}</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">GSTIN</p>
                    <p className="text-sm font-semibold text-foreground">{invoice.your.gstin}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t.taxableValue}</p>
                    <p className={`text-lg font-bold ${invoice.mismatch.taxableValue ? 'text-reject-fg underline decoration-reject-fg' : 'text-foreground'}`}>
                      ₹{invoice.your.taxableValue.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t.taxAmount}</p>
                    <p className={`text-lg font-bold ${invoice.mismatch.taxAmount ? 'text-reject-fg underline decoration-reject-fg' : 'text-foreground'}`}>
                      ₹{invoice.your.taxAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-caption text-muted-foreground mb-2">{t.gstr2b}</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">GSTIN</p>
                    <p className="text-sm font-semibold text-foreground">{invoice.gstr2b.gstin}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t.taxableValue}</p>
                    <p className={`text-lg font-bold ${invoice.mismatch.taxableValue ? 'text-reject-fg underline decoration-reject-fg' : 'text-foreground'}`}>
                      ₹{invoice.gstr2b.taxableValue.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t.taxAmount}</p>
                    <p className={`text-lg font-bold ${invoice.mismatch.taxAmount ? 'text-reject-fg underline decoration-reject-fg' : 'text-foreground'}`}>
                      ₹{invoice.gstr2b.taxAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Image Placeholder */}
        <div className="card bg-gradient-to-br from-muted/20 to-muted/10 aspect-video flex items-center justify-center rounded-xl">
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-muted/30 flex items-center justify-center mx-auto mb-2">
              📄
            </div>
            <p className="text-sm text-muted-foreground">Tap to view original invoice</p>
          </div>
        </div>
      </div>

      {/* Action Controls - Fixed Bottom */}
      <div className="fixed bottom-20 left-0 right-0 bg-card border-t border-muted px-6 py-4 space-y-4">
        <div className="max-w-[440px] mx-auto">
          {/* Override Buttons */}
          <div className="flex gap-2 mb-3">
            {['accept', 'hold', 'reject'].map((action) => (
              <button
                key={action}
                onClick={() => setSelectedAction(action as any)}
                className={`flex-1 px-3 py-2 rounded-lg font-semibold text-sm transition-all ${
                  selectedAction === action
                    ? action === 'accept'
                      ? 'bg-accept-bg text-accept-fg'
                      : action === 'hold'
                      ? 'bg-hold-bg text-hold-fg'
                      : 'bg-reject-bg text-reject-fg'
                    : 'bg-muted/20 text-muted-foreground border border-muted'
                }`}
              >
                {action === 'accept' ? t.accept : action === 'hold' ? t.hold : t.reject}
              </button>
            ))}
          </div>

          {/* Ask CA Link */}
          <button className="w-full px-4 py-2 rounded-lg bg-muted/10 text-accent font-semibold text-sm hover:bg-muted/20 transition-colors flex items-center justify-center gap-2">
            <HelpCircle className="w-4 h-4" />
            {t.askCA}
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="reports" language={language} />
    </main>
  )
}
