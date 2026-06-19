'use client'

import { useState } from 'react'
import Link from 'next/link'
import { UploadIcon, ImageIcon, CheckCircleIcon } from 'lucide-react'
import Header from '../components/Header'
import BottomNav from '../components/BottomNav'
import LanguageToggle from '../components/LanguageToggle'

export default function Home() {
  const [language, setLanguage] = useState<'en' | 'hi'>('en')
  const [step1Complete, setStep1Complete] = useState(false)
  const [step2Complete, setStep2Complete] = useState(false)
  const [gstr2bFileName, setGstr2bFileName] = useState<string | null>(null)
  const [invoiceCount, setInvoiceCount] = useState(0)

  const content = {
    en: {
      greeting: 'Namaste, Sharma Kirana Store 👋',
      subtitle: 'Upload your documents to get started',
      step1Title: 'Upload your GSTR-2B',
      step1Hint: 'CSV or Excel',
      step2Title: 'Add your invoice photos or PDFs',
      step2Hint: 'Support multiple files',
      scanButton: 'Scan with camera',
      checkButton: 'Check my invoices',
      missingStep: 'Complete both steps to continue',
    },
    hi: {
      greeting: 'नमस्ते, शर्मा किराना स्टोर 👋',
      subtitle: 'शुरू करने के लिए अपने दस्तावेज़ अपलोड करें',
      step1Title: 'अपना GSTR-2B अपलोड करें',
      step1Hint: 'CSV या Excel',
      step2Title: 'अपने इनवॉइस फ़ोटो या PDF जोड़ें',
      step2Hint: 'कई फ़ाइलों का समर्थन करें',
      scanButton: 'कैमरे से स्कैन करें',
      checkButton: 'मेरे इनवॉइस जांचें',
      missingStep: 'जारी रखने के लिए दोनों चरण पूरे करें',
    },
  }

  const t = content[language]

  const handleGstr2bUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setGstr2bFileName(file.name)
      setStep1Complete(true)
    }
  }

  const handleInvoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setInvoiceCount(files.length)
      setStep2Complete(true)
    }
  }

  const isComplete = step1Complete && step2Complete

  return (
    <main className="min-h-dvh flex flex-col bg-background pb-24">
      {/* Header with decorative blob */}
      <div className="relative pt-6 px-6">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-3xl" style={{ background: '#b8a587' }} />
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-display mb-2">{t.greeting}</h1>
              <p className="text-muted-foreground text-sm">{t.subtitle}</p>
            </div>
            <LanguageToggle language={language} setLanguage={setLanguage} />
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="px-6 mb-8">
        <div className="flex gap-2">
          <div className={`flex-1 h-1 rounded-full transition-colors ${step1Complete ? 'bg-accent' : 'bg-muted'}`} />
          <div className={`flex-1 h-1 rounded-full transition-colors ${step2Complete ? 'bg-accent' : 'bg-muted'}`} />
        </div>
        <div className="flex justify-between mt-2 text-caption text-muted-foreground">
          <span>Step 1</span>
          <span>Step 2</span>
        </div>
      </div>

      {/* Steps Container */}
      <div className="flex-1 px-6 space-y-6">
        {/* Step 1: GSTR-2B Upload */}
        <div className="card border-2 border-dashed border-muted hover:border-accent transition-colors">
          <label className="cursor-pointer block">
            {step1Complete ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircleIcon className="w-12 h-12 text-accent" />
                <span className="font-semibold text-foreground">{gstr2bFileName}</span>
                <span className="text-caption text-muted-foreground">{t.step1Hint}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <UploadIcon className="w-10 h-10 text-muted-foreground" />
                <div>
                  <h3 className="text-h2 font-semibold text-foreground">{t.step1Title}</h3>
                  <p className="text-caption text-muted-foreground mt-1">{t.step1Hint}</p>
                </div>
              </div>
            )}
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleGstr2bUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Step 2: Invoice Upload */}
        <div className="card border-2 border-dashed border-muted hover:border-accent transition-colors">
          <label className="cursor-pointer block">
            {step2Complete ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <CheckCircleIcon className="w-12 h-12 text-accent" />
                <span className="font-semibold text-foreground">{invoiceCount} {language === 'en' ? 'files' : 'फ़ाइलें'}</span>
                <span className="text-caption text-muted-foreground">{t.step2Hint}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <ImageIcon className="w-10 h-10 text-muted-foreground" />
                <div>
                  <h3 className="text-h2 font-semibold text-foreground">{t.step2Title}</h3>
                  <p className="text-caption text-muted-foreground mt-1">{t.step2Hint}</p>
                </div>
              </div>
            )}
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleInvoiceUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Scan Button */}
        <button className="w-full px-6 py-3 rounded-full bg-muted/20 text-foreground font-semibold text-sm border border-muted hover:bg-muted/30 transition-colors flex items-center justify-center gap-2">
          <span>📷</span>
          {t.scanButton}
        </button>
      </div>

      {/* CTA Section */}
      <div className="px-6 mt-8 pb-6">
        {!isComplete && (
          <p className="text-center text-caption text-muted-foreground mb-4">{t.missingStep}</p>
        )}
        <Link
          href={isComplete ? '/results' : '#'}
          onClick={(e) => !isComplete && e.preventDefault()}
          className={`block w-full py-3 rounded-full font-semibold text-center text-sm transition-all ${
            isComplete
              ? 'button-primary cursor-pointer'
              : 'bg-muted/30 text-muted-foreground cursor-not-allowed'
          }`}
        >
          {t.checkButton}
        </Link>
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="home" language={language} />
    </main>
  )
}
