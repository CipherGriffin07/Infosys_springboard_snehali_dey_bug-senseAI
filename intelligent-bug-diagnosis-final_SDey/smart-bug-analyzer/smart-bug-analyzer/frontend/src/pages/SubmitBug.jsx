import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'

const SEVERITIES = ['Critical', 'High', 'Medium', 'Low']
const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
const CATEGORIES = ['Frontend', 'Backend', 'Database', 'Infra', 'API', 'Mobile', 'Security', 'Other']
const LANGUAGES = ['Auto Detect', 'Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'Go', 'Rust', 'SQL', 'Other']

const SAMPLE_BUG = {
  title: 'ZeroDivisionError in calculation service',
  description:
    'The calculation service crashes when the denominator is zero. The failure occurs while executing the divide function.',
  stack_trace: `Traceback (most recent call last):
  File "calculator.py", line 24, in divide
    return a / b
ZeroDivisionError: division by zero`,
  category: 'Backend',
  module: 'calculation-service',
  project: 'BugSense Demo',
  severity: 'High',
  priority: 'P1',
  language: 'Python',
  sourceCode: `def divide(a, b):
    return a / b

print(divide(10, 0))`,
}

export default function SubmitBug() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [mode, setMode] = useState('report')
  const [form, setForm] = useState({
    title: '',
    description: '',
    stack_trace: '',
    category: 'Backend',
    module: '',
    project: '',
    severity: 'Medium',
    priority: 'P2',
  })

  const [language, setLanguage] = useState('Auto Detect')
  const [sourceCode, setSourceCode] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileContent, setFileContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const update = (key) => (e) =>
    setForm((current) => ({
      ...current,
      [key]: e.target.value,
    }))

  const inputSummary = useMemo(() => {
    const items = []

    if (form.description.trim()) items.push('description')
    if (form.stack_trace.trim()) items.push('logs')
    if (sourceCode.trim()) items.push('source code')
    if (selectedFile) items.push('file')

    return items.length ? items.join(' + ') : 'waiting for input'
  }, [form.description, form.stack_trace, sourceCode, selectedFile])

  const handleSample = () => {
    setMode('code')
    setForm({
      title: SAMPLE_BUG.title,
      description: SAMPLE_BUG.description,
      stack_trace: SAMPLE_BUG.stack_trace,
      category: SAMPLE_BUG.category,
      module: SAMPLE_BUG.module,
      project: SAMPLE_BUG.project,
      severity: SAMPLE_BUG.severity,
      priority: SAMPLE_BUG.priority,
    })
    setLanguage(SAMPLE_BUG.language)
    setSourceCode(SAMPLE_BUG.sourceCode)
    setSelectedFile(null)
    setFileContent('')
    setError(null)
  }

  const handleClear = () => {
    setMode('report')
    setForm({
      title: '',
      description: '',
      stack_trace: '',
      category: 'Backend',
      module: '',
      project: '',
      severity: 'Medium',
      priority: 'P2',
    })
    setLanguage('Auto Detect')
    setSourceCode('')
    setSelectedFile(null)
    setFileContent('')
    setError(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      setSelectedFile(null)
      setFileContent('')
      return
    }

    const allowedExtensions = ['txt', 'log', 'json', 'xml', 'csv', 'py', 'js', 'jsx', 'ts', 'tsx', 'java', 'c', 'cpp']
    const extension = file.name.split('.').pop()?.toLowerCase()

    if (!allowedExtensions.includes(extension)) {
      setError(
        'For this analysis form, upload a text/code file such as .txt, .log, .json, .py, .js, .java, .c or .cpp.'
      )
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Please choose a file smaller than 5 MB.')
      event.target.value = ''
      return
    }

    try {
      const text = await file.text()
      setSelectedFile(file)
      setFileContent(text)
      setError(null)
    } catch {
      setError('Could not read this file. Please paste its contents manually.')
      event.target.value = ''
    }
  }

  const buildDescription = () => {
    const parts = [form.description.trim()]

    if (mode === 'code' && sourceCode.trim()) {
      parts.push(
        `Programming Language: ${language}`,
        `Source Code:\n${sourceCode.trim()}`
      )
    }

    if (selectedFile && fileContent.trim()) {
      parts.push(
        `Uploaded File: ${selectedFile.name}`,
        `Uploaded File Content:\n${fileContent.trim()}`
      )
    }

    return parts.filter(Boolean).join('\n\n')
  }

  const buildStackTrace = () => {
    const parts = []

    if (form.stack_trace.trim()) {
      parts.push(form.stack_trace.trim())
    }

    if (mode === 'code' && sourceCode.trim()) {
      parts.push(`--- SOURCE CODE ---\n${sourceCode.trim()}`)
    }

    return parts.join('\n\n')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    if (!form.title.trim()) {
      setError('Please enter a bug title.')
      return
    }

    if (!form.description.trim() && !sourceCode.trim() && !fileContent.trim()) {
      setError('Please provide a bug description, source code, or an input file.')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        title: form.title.trim(),
        description: buildDescription(),
        stack_trace: buildStackTrace() || undefined,
        category: form.category,
        module: form.module.trim() || undefined,
        project: form.project.trim() || undefined,
        severity: form.severity,
        priority: form.priority,
      }

      const { data } = await client.post('/bugs', payload)

      navigate(`/bugs/${data.id}`)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not create this diagnosis. Please make sure the backend is running and try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-[1500px]">
      <div className="mb-7 overflow-hidden rounded-3xl border border-violet-400/10 bg-gradient-to-br from-violet-500/[0.08] via-[#0b0f1d] to-cyan-400/[0.035]">
        <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
          <div className="p-6 lg:p-7">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-400/15 bg-violet-500/[0.08] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-violet-300">
                Diagnostic Lab
              </span>

              <span className="flex items-center gap-1.5 rounded-full border border-cyan-400/10 bg-cyan-400/[0.045] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
                5 Agents Ready
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Launch a new diagnosis
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Feed BugSense AI a report, source file, stack trace, or raw code.
              The case is stored first, then the multi-agent engine performs
              triage, log analysis, duplicate search, root-cause analysis, and remediation.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="glass-chip">Source-aware</span>
              <span className="glass-chip">Historical matching</span>
              <span className="glass-chip">Risk scoring</span>
              <span className="glass-chip">Root-cause grounding</span>
            </div>
          </div>

          <div className="border-t border-white/[0.05] bg-white/[0.015] p-6 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
              Session Controls
            </p>

            <p className="mt-2 text-sm text-slate-400">
              Use the sample to demo the complete diagnosis flow instantly.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSample}
                disabled={submitting}
              >
                Load demo case
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleClear}
                disabled={submitting}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-400/15 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="panel overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-white/[0.05] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="section-eyebrow">01 / Intake</p>
                  <h2 className="mt-1.5 text-base font-semibold text-slate-100">
                    Diagnostic Input
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Select the type of evidence you want to analyze.
                  </p>
                </div>

                <div className="inline-flex rounded-xl border border-white/[0.06] bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => setMode('report')}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      mode === 'report'
                        ? 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/15'
                        : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-200'
                    }`}
                  >
                    Bug Report
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('code')}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                      mode === 'code'
                        ? 'bg-cyan-400/[0.10] text-cyan-200 ring-1 ring-cyan-400/15'
                        : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-200'
                    }`}
                  >
                    Source Code
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div>
                  <label className="label" htmlFor="title">
                    Case title
                  </label>
                  <input
                    id="title"
                    className="input-field"
                    placeholder="e.g. Checkout crashes when payment API times out"
                    value={form.title}
                    onChange={update('title')}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="description">
                    Incident description
                  </label>
                  <textarea
                    id="description"
                    rows={5}
                    className="input-field resize-none"
                    placeholder="Describe what happened, the expected behaviour, reproduction steps, and relevant context."
                    value={form.description}
                    onChange={update('description')}
                  />
                </div>

                {mode === 'code' && (
                  <div className="terminal-panel overflow-hidden">
                    <div className="flex flex-col gap-3 border-b border-white/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                        <span className="ml-2 text-[10px] font-mono uppercase tracking-[0.12em] text-slate-600">
                          source.input
                        </span>
                      </div>

                      <select
                        id="language"
                        className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 outline-none"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        {LANGUAGES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>

                    <textarea
                      id="sourceCode"
                      rows={15}
                      spellCheck={false}
                      className="w-full resize-y bg-transparent px-4 py-4 font-mono text-xs leading-6 text-slate-300 outline-none placeholder:text-slate-700"
                      placeholder={`def divide(a, b):
    return a / b

print(divide(10, 0))`}
                      value={sourceCode}
                      onChange={(e) => setSourceCode(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="label" htmlFor="stack_trace">
                    Runtime evidence
                  </label>

                  <div className="terminal-panel overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-slate-600">
                        error.log
                      </span>

                      <span className="text-[10px] font-mono text-cyan-400/70">
                        parser-ready
                      </span>
                    </div>

                    <textarea
                      id="stack_trace"
                      rows={9}
                      spellCheck={false}
                      className="w-full resize-y bg-transparent px-4 py-4 font-mono text-xs leading-6 text-slate-300 outline-none placeholder:text-slate-700"
                      placeholder={`Traceback (most recent call last):
  File "service.py", line 42, in process
    ...
RuntimeError: example failure`}
                      value={form.stack_trace}
                      onChange={update('stack_trace')}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="project">
                      Project
                    </label>
                    <input
                      id="project"
                      className="input-field"
                      placeholder="e.g. Storefront"
                      value={form.project}
                      onChange={update('project')}
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="module">
                      Component / module
                    </label>
                    <input
                      id="module"
                      className="input-field"
                      placeholder="e.g. payment-service"
                      value={form.module}
                      onChange={update('module')}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="panel p-6">
              <div className="mb-5">
                <p className="section-eyebrow">02 / Evidence</p>
                <h2 className="mt-1.5 text-base font-semibold text-slate-100">
                  Supporting File
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Attach a text, log, JSON, or source file to enrich the diagnostic context.
                </p>
              </div>

              <label
                htmlFor="bug-file"
                className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-violet-400/15 bg-violet-500/[0.025] px-6 py-9 text-center transition-all hover:border-violet-400/30 hover:bg-violet-500/[0.05]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/[0.08] text-violet-300 transition-transform group-hover:-translate-y-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                    <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 16V4M7 9l5-5 5 5" />
                    <path strokeWidth="1.6" strokeLinecap="round" d="M5 20h14" />
                  </svg>
                </div>

                <p className="text-sm font-medium text-slate-200">
                  {selectedFile ? selectedFile.name : 'Drop diagnostic evidence here'}
                </p>

                <p className="mt-1.5 text-xs text-slate-600">
                  TXT, LOG, JSON, XML, CSV, PY, JS, TS, JAVA, C, CPP · Max 5 MB
                </p>

                {selectedFile && (
                  <span className="mt-3 rounded-full border border-cyan-400/10 bg-cyan-400/[0.05] px-2.5 py-1 text-[10px] font-semibold text-cyan-300">
                    {(selectedFile.size / 1024).toFixed(1)} KB loaded
                  </span>
                )}
              </label>

              <input
                ref={fileInputRef}
                id="bug-file"
                type="file"
                className="hidden"
                onChange={handleFile}
                accept=".txt,.log,.json,.xml,.csv,.py,.js,.jsx,.ts,.tsx,.java,.c,.cpp"
              />
            </section>

            <section className="panel p-6">
              <div className="mb-5">
                <p className="section-eyebrow">03 / Context</p>
                <h2 className="mt-1.5 text-base font-semibold text-slate-100">
                  Initial Classification
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Provide your first assessment. The AI pipeline will generate its own classification after analysis.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="category">
                    Category
                  </label>
                  <select
                    id="category"
                    className="input-field"
                    value={form.category}
                    onChange={update('category')}
                  >
                    {CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="severity">
                    Severity
                  </label>
                  <select
                    id="severity"
                    className="input-field"
                    value={form.severity}
                    onChange={update('severity')}
                  >
                    {SEVERITIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="priority">
                    Priority
                  </label>
                  <select
                    id="priority"
                    className="input-field"
                    value={form.priority}
                    onChange={update('priority')}
                  >
                    {PRIORITIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-3 pb-4">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary min-w-[190px]"
              >
                {submitting ? 'Creating case…' : 'Create diagnostic case'}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/dashboard')}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </div>

          <aside className="space-y-5">
            <section className="panel overflow-hidden">
              <div className="border-b border-white/[0.05] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                  Pipeline Preview
                </p>

                <div className="mt-2 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-100">
                    Multi-Agent Engine
                  </h3>

                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    Ready
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="relative space-y-2.5">
                  {[
                    ['01', 'Triage Agent', 'Severity, priority & category', 'violet'],
                    ['02', 'Log Intelligence', 'Exception & failure point', 'cyan'],
                    ['03', 'Similarity Agent', 'Historical duplicate search', 'violet'],
                    ['04', 'Root Cause Agent', 'Grounded cause & confidence', 'cyan'],
                    ['05', 'Remediation Agent', 'Fix, prevention & effort', 'violet'],
                  ].map(([number, title, description, tone], index) => (
                    <div
                      key={number}
                      className="relative flex gap-3 rounded-xl border border-white/[0.05] bg-white/[0.018] p-3.5"
                    >
                      {index < 4 && (
                        <span className="absolute left-[29px] top-[49px] h-[14px] w-px bg-gradient-to-b from-violet-400/20 to-transparent" />
                      )}

                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-[10px] font-semibold ${
                          tone === 'cyan'
                            ? 'border-cyan-400/10 bg-cyan-400/[0.05] text-cyan-300'
                            : 'border-violet-400/10 bg-violet-500/[0.06] text-violet-300'
                        }`}
                      >
                        {number}
                      </div>

                      <div>
                        <p className="text-sm font-medium text-slate-300">{title}</p>
                        <p className="mt-0.5 text-[11px] leading-5 text-slate-600">{description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="panel p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
                Intake Monitor
              </p>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
                  <span className="text-xs text-slate-600">Mode</span>
                  <span className="text-xs font-medium text-slate-300">
                    {mode === 'report' ? 'Bug Report' : 'Source Code'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3">
                  <span className="text-xs text-slate-600">Language</span>
                  <span className="text-xs font-medium text-slate-300">{language}</span>
                </div>

                <div className="rounded-xl border border-violet-400/10 bg-violet-500/[0.035] px-3.5 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">
                    Detected Evidence
                  </p>
                  <p className="mt-1.5 text-sm font-medium capitalize text-violet-300">
                    {inputSummary}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-400/10 bg-gradient-to-br from-cyan-400/[0.05] to-violet-500/[0.035] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/10 bg-cyan-400/[0.05]">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4 text-cyan-300">
                    <ellipse cx="12" cy="5" rx="7" ry="3" strokeWidth="1.6" />
                    <path strokeWidth="1.6" d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
                  </svg>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">
                    Historical Intelligence
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Resolved cases can be reused as evidence for similarity matching,
                    root-cause grounding, and future fix recommendations.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </form>
    </div>
  )
}
