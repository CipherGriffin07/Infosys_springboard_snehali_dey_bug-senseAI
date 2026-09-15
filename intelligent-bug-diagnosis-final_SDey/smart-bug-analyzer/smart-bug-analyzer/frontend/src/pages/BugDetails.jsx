import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import client from '../api/client'
import SeverityBadge from '../components/SeverityBadge.jsx'
import StatusBadge from '../components/StatusBadge.jsx'

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']

const EVENT_LABELS = {
  created: 'Bug reported',
  status_changed: 'Status changed',
  resolution_notes_updated: 'Resolution notes updated',
  stack_trace_updated: 'Stack trace updated',
  comment_added: 'Comment added',
  attachment_added: 'Attachment added',
  ai_analysis_run: 'AI analysis run',
}

export default function BugDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [bug, setBug] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [savingStatus, setSavingStatus] = useState(false)

  const [commentBody, setCommentBody] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await client.get(`/bugs/${id}`)
      setBug(data)
      setResolutionNotes(data.resolution_notes || '')
    } catch (err) {
      setError('Bug not found, or you no longer have access to it.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const updateBug = async (patch) => {
    setSavingStatus(true)
    try {
      await client.patch(`/bugs/${id}`, patch)
      await load()
    } catch (err) {
      setError('Could not update this bug.')
    } finally {
      setSavingStatus(false)
    }
  }

  const submitComment = async (e) => {
    e.preventDefault()
    if (!commentBody.trim()) return
    setPostingComment(true)
    try {
      await client.post(`/bugs/${id}/comments`, { body: commentBody })
      setCommentBody('')
      await load()
    } catch (err) {
      setError('Could not post your comment.')
    } finally {
      setPostingComment(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      await client.post(`/bugs/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await load()
    } catch (err) {
      setUploadError(err.response?.data?.detail || 'Could not upload this file.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const [applyingOcrId, setApplyingOcrId] = useState(null)
  const [ocrDrafts, setOcrDrafts] = useState({}) // attachment.id -> editable draft text

  const applyOcrText = async (attachment) => {
    const draftText = ocrDrafts[attachment.id] ?? attachment.extracted_text
    setApplyingOcrId(attachment.id)
    try {
      const nextStackTrace = bug.stack_trace
        ? `${bug.stack_trace}\n\n${draftText}`
        : draftText
      await client.patch(`/bugs/${id}`, { stack_trace: nextStackTrace })
      await load()
    } catch (err) {
      setUploadError('Could not add that text to the stack trace.')
    } finally {
      setApplyingOcrId(null)
    }
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    setAnalysisError(null)
    try {
      await client.post(`/bugs/${id}/analyze`)
      await load()
    } catch (err) {
      setAnalysisError(err.response?.data?.detail || 'AI analysis failed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const [downloadingReport, setDownloadingReport] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  const downloadReport = async () => {
    setDownloadingReport(true)
    setDownloadError(null)
    try {
      const response = await client.get(`/bugs/${id}/report`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `bug_${id}_report.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError('Could not generate the PDF report. Please try again.')
    } finally {
      setDownloadingReport(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500 py-10 text-center">Loading bug details…</div>
  }

  if (error && !bug) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-sm text-alert-critical mb-4">{error}</p>
        <Link to="/bugs" className="btn-secondary inline-flex">Back to Bug History</Link>
      </div>
    )
  }

  const analysis = bug.analysis

  return (
    <div className="max-w-[1500px] space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-xs font-medium text-slate-600 transition-colors hover:text-violet-300"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-3.5 w-3.5">
          <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
        </svg>
        Back to cases
      </button>

      {error && (
        <div className="rounded-2xl border border-red-400/15 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-violet-400/10 bg-gradient-to-br from-violet-500/[0.08] via-[#0b0f1d] to-cyan-400/[0.035]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-500/[0.08] blur-3xl" />

        <div className="relative p-6 lg:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-violet-400/15 bg-violet-500/[0.08] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-violet-300">
                  CASE #{bug.id}
                </span>
                {bug.project && <span className="glass-chip">{bug.project}</span>}
                {bug.module && <span className="glass-chip">{bug.module}</span>}
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-white lg:text-3xl">
                {bug.title}
              </h2>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <SeverityBadge severity={bug.severity} />
                <span className="badge border border-white/[0.06] bg-white/[0.03] font-mono text-slate-300">
                  {bug.priority}
                </span>
                <StatusBadge status={bug.status} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadReport}
                disabled={downloadingReport}
                className="btn-secondary text-xs"
              >
                {downloadingReport ? 'Generating report…' : 'Download PDF'}
              </button>

              <button
                className="btn-primary text-xs"
                onClick={runAnalysis}
                disabled={analyzing}
              >
                {analyzing ? 'Agents analyzing…' : analysis ? 'Re-run AI analysis' : 'Run AI diagnosis'}
              </button>
            </div>
          </div>

          {downloadError && <p className="mt-3 text-xs text-red-300">{downloadError}</p>}

          <div className="mt-6 grid gap-3 border-t border-white/[0.05] pt-5 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">Reporter</p>
              <p className="mt-1 text-xs font-medium text-slate-300">{bug.reporter.full_name}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">Category</p>
              <p className="mt-1 text-xs font-medium text-slate-300">{bug.category || 'Uncategorized'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">Created</p>
              <p className="mt-1 text-xs font-medium text-slate-300">{new Date(bug.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">Last Updated</p>
              <p className="mt-1 text-xs font-medium text-slate-300">{new Date(bug.updated_at).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <div className="space-y-6">
          <section className="panel p-6">
            <p className="section-eyebrow">Incident Context</p>
            <h3 className="mt-1.5 text-base font-semibold text-slate-200">Description</h3>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-400">
              {bug.description}
            </p>
          </section>

          {bug.stack_trace && (
            <section className="panel overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-4">
                <div>
                  <p className="section-eyebrow">Runtime Evidence</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-200">Stack Trace / Error Log</h3>
                </div>
                <span className="rounded-full border border-cyan-400/10 bg-cyan-400/[0.04] px-2.5 py-1 font-mono text-[9px] text-cyan-300">
                  parser-ready
                </span>
              </div>

              <div className="terminal-panel m-5 overflow-hidden">
                <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-600">runtime.log</span>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-4 font-mono text-xs leading-6 text-slate-400">
{bug.stack_trace}
                </pre>
              </div>
            </section>
          )}

          <section className="panel overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-white/[0.05] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="section-eyebrow">AI Investigation</p>
                <h3 className="mt-1.5 text-base font-semibold text-slate-100">
                  Multi-Agent Diagnostic Report
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Five specialized agents combine runtime evidence with historical intelligence.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                  {analysis ? 'Analysis available' : 'Agents ready'}
                </span>
              </div>
            </div>

            <div className="p-6">
              {analysisError && (
                <div className="mb-4 rounded-xl border border-red-400/15 bg-red-500/[0.06] px-4 py-3 text-xs text-red-300">
                  {analysisError}
                </div>
              )}

              {!analysis ? (
                <div className="rounded-2xl border border-dashed border-violet-400/15 bg-violet-500/[0.025] px-6 py-10 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/15 bg-violet-500/[0.07]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5 text-violet-300">
                      <path strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.5 4.3L18 9l-4.5 1.7L12 15l-1.5-4.3L6 9l4.5-1.7L12 3Z" />
                      <path strokeWidth="1.6" strokeLinecap="round" d="M18 15v6M15 18h6" />
                    </svg>
                  </div>
                  <h4 className="mt-4 text-sm font-semibold text-slate-200">Case ready for AI investigation</h4>
                  <p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-slate-600">
                    Run Triage, Log Intelligence, Similarity Detection, Root Cause, and Remediation to generate a structured diagnostic report.
                  </p>
                  <button className="btn-primary mt-5" onClick={runAnalysis} disabled={analyzing}>
                    {analyzing ? 'Running agents…' : 'Launch 5-agent analysis'}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="relative overflow-hidden rounded-2xl border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.08] via-transparent to-cyan-400/[0.04] p-5">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
                          AI Risk Intelligence
                        </p>
                        <h4 className="mt-1.5 text-lg font-semibold text-white">Overall Bug Risk</h4>
                        <p className="mt-1 max-w-xl text-xs leading-5 text-slate-600">
                          Combined from severity, priority, root-cause confidence, recurrence, failure type, and localization evidence.
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-full"
                          style={{
                            background: `conic-gradient(rgb(124 92 255) ${Math.max(0, Math.min(100, analysis.risk_score ?? 0)) * 3.6}deg, rgba(255,255,255,0.05) 0deg)`
                          }}
                        >
                          <div className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full bg-[#0d1120]">
                            <span className="text-2xl font-bold text-white">{analysis.risk_score ?? 0}</span>
                            <span className="text-[9px] uppercase tracking-[0.12em] text-slate-600">of 100</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[9px] uppercase tracking-[0.14em] text-slate-600">Risk Level</p>
                          <span className={`mt-1.5 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                            analysis.risk_level === 'Critical'
                              ? 'border-red-400/20 bg-red-500/10 text-red-300'
                              : analysis.risk_level === 'High'
                                ? 'border-orange-400/20 bg-orange-500/10 text-orange-300'
                                : analysis.risk_level === 'Medium'
                                  ? 'border-amber-400/20 bg-amber-500/10 text-amber-300'
                                  : 'border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-300'
                          }`}>
                            {analysis.risk_level || 'Minimal'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {analysis.risk_summary && (
                      <p className="mt-5 border-t border-white/[0.05] pt-4 text-xs leading-6 text-slate-400">
                        {analysis.risk_summary}
                      </p>
                    )}

                    {analysis.risk_factors?.length > 0 && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {analysis.risk_factors.map((factor, index) => (
                          <div key={`${factor.label}-${index}`} className="rounded-xl border border-white/[0.05] bg-black/15 px-3.5 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-medium text-slate-300">{factor.label}</span>
                              <span className="font-mono text-xs font-semibold text-violet-300">+{factor.points}</span>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-5 text-slate-600">{factor.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="agent-card">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/10 bg-violet-500/[0.07] font-mono text-[10px] font-bold text-violet-300">01</span>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">Agent Result</p>
                            <h4 className="text-sm font-semibold text-slate-200">Triage</h4>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-violet-300">{analysis.triage_confidence}% confidence</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={analysis.predicted_severity} />
                        <span className="badge border border-white/[0.06] bg-white/[0.03] font-mono text-slate-300">{analysis.predicted_priority}</span>
                        <span className="badge border border-amber-400/10 bg-amber-400/[0.06] text-amber-300">{analysis.predicted_category}</span>
                      </div>

                      {analysis.triage_reasoning && (
                        <p className="mt-3 text-xs leading-6 text-slate-500">{analysis.triage_reasoning}</p>
                      )}
                    </div>

                    <div className="agent-card">
                      <div className="mb-4 flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/10 bg-cyan-400/[0.06] font-mono text-[10px] font-bold text-cyan-300">02</span>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">Agent Result</p>
                          <h4 className="text-sm font-semibold text-slate-200">Log Intelligence</h4>
                        </div>
                      </div>

                      {analysis.exception_type ? (
                        <div className="space-y-2 text-xs text-slate-500">
                          <div className="rounded-lg border border-white/[0.05] bg-black/15 px-3 py-2.5">
                            <span className="text-slate-600">Exception </span>
                            <span className="font-mono text-cyan-300">{analysis.exception_type}</span>
                          </div>
                          {analysis.failure_file && (
                            <div className="rounded-lg border border-white/[0.05] bg-black/15 px-3 py-2.5">
                              <span className="text-slate-600">Failure point </span>
                              <span className="font-mono text-slate-300">
                                {analysis.failure_file}{analysis.failure_line ? `:${analysis.failure_line}` : ''}{analysis.failure_function ? ` in ${analysis.failure_function}()` : ''}
                              </span>
                            </div>
                          )}
                          <p className="pt-1 leading-6">{analysis.log_summary}</p>
                        </div>
                      ) : (
                        <p className="text-xs leading-6 text-slate-500">{analysis.log_summary}</p>
                      )}
                    </div>
                  </div>

                  <div className="agent-card">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/10 bg-violet-500/[0.07] font-mono text-[10px] font-bold text-violet-300">03</span>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">Agent Result</p>
                          <h4 className="text-sm font-semibold text-slate-200">Historical Similarity</h4>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-600">{analysis.duplicates.length} matches</span>
                    </div>

                    {analysis.duplicates.length === 0 ? (
                      <p className="text-xs text-slate-500">No similar cases were found in the current knowledge base.</p>
                    ) : (
                      <div className="space-y-2">
                        {analysis.duplicates.map((d) => (
                          <Link
                            key={d.bug_id}
                            to={`/bugs/${d.bug_id}`}
                            className="flex flex-col gap-2 rounded-xl border border-white/[0.05] bg-black/10 px-3.5 py-3 transition-colors hover:border-violet-400/15 hover:bg-violet-500/[0.025] sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-slate-300">#{d.bug_id} — {d.title}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <StatusBadge status={d.status} />
                              <span className="font-mono text-[10px] text-violet-300">{d.similarity.toFixed(0)}% match</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="agent-card">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/10 bg-cyan-400/[0.06] font-mono text-[10px] font-bold text-cyan-300">04</span>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">Agent Result</p>
                            <h4 className="text-sm font-semibold text-slate-200">Root Cause</h4>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-cyan-300">{analysis.root_cause_confidence}% confidence</span>
                      </div>
                      <p className="whitespace-pre-wrap text-xs leading-6 text-slate-500">{analysis.root_cause_text}</p>
                    </div>

                    <div className="agent-card">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/10 bg-violet-500/[0.07] font-mono text-[10px] font-bold text-violet-300">05</span>
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">Agent Result</p>
                            <h4 className="text-sm font-semibold text-slate-200">Remediation</h4>
                          </div>
                        </div>
                        <span className="rounded-full border border-white/[0.05] bg-white/[0.025] px-2.5 py-1 text-[9px] text-slate-500">
                          est. {analysis.estimated_fix_time}
                        </span>
                      </div>

                      <p className="text-xs leading-6 text-slate-400">{analysis.suggested_fix}</p>

                      {analysis.best_practices.length > 0 && (
                        <div className="mt-4 border-t border-white/[0.05] pt-3">
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">Best Practices</p>
                          <ul className="mt-2 space-y-1.5 text-xs text-slate-500">
                            {analysis.best_practices.map((bp, i) => <li key={i}>• {bp}</li>)}
                          </ul>
                        </div>
                      )}

                      {analysis.prevention_tips.length > 0 && (
                        <div className="mt-4 border-t border-white/[0.05] pt-3">
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">Prevention</p>
                          <ul className="mt-2 space-y-1.5 text-xs text-slate-500">
                            {analysis.prevention_tips.map((tip, i) => <li key={i}>• {tip}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="panel p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Case Control</p>
            <h3 className="mt-1.5 text-sm font-semibold text-slate-200">Lifecycle Status</h3>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  disabled={savingStatus || bug.status === s}
                  onClick={() => updateBug({ status: s })}
                  className={`rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${
                    bug.status === s
                      ? 'border-violet-400/20 bg-violet-500/10 text-violet-200'
                      : 'border-white/[0.05] bg-white/[0.02] text-slate-500 hover:border-violet-400/10 hover:text-slate-300 disabled:opacity-70'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-white/[0.05] pt-4">
              <label className="label" htmlFor="resolutionNotes">Resolution Knowledge</label>
              <textarea
                id="resolutionNotes"
                rows={4}
                className="input-field resize-none"
                placeholder="Record the verified root cause and successful fix for future historical learning."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
              <button
                className="btn-secondary mt-2 w-full"
                disabled={savingStatus}
                onClick={() => updateBug({ resolution_notes: resolutionNotes })}
              >
                Save resolution knowledge
              </button>
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Evidence</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-200">Attachments</h3>
              </div>
              <span className="rounded-full border border-white/[0.05] bg-white/[0.025] px-2 py-1 font-mono text-[9px] text-slate-500">
                {bug.attachments.length}
              </span>
            </div>

            {uploadError && (
              <div className="mt-3 rounded-xl border border-red-400/15 bg-red-500/[0.06] px-3 py-2.5 text-xs text-red-300">
                {uploadError}
              </div>
            )}

            {bug.attachments.length === 0 ? (
              <p className="mt-4 text-xs text-slate-600">No supporting files attached.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {bug.attachments.map((a) => (
                  <div key={a.id} className="rounded-xl border border-white/[0.05] bg-white/[0.018] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-slate-400">{a.filename}</span>
                      <span className="shrink-0 font-mono text-[9px] text-slate-600">{(a.size_bytes / 1024).toFixed(1)} KB</span>
                    </div>

                    {a.extracted_text && (
                      <div className="mt-3 border-t border-white/[0.05] pt-3">
                        <p className="mb-2 text-[9px] uppercase tracking-[0.12em] text-slate-600">OCR Extract</p>
                        <textarea
                          className="input-field mb-2 resize-none font-mono text-[10px]"
                          rows={Math.min(6, a.extracted_text.split('\n').length + 1)}
                          value={ocrDrafts[a.id] ?? a.extracted_text}
                          onChange={(e) => setOcrDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        />
                        <button
                          className="text-[10px] font-semibold text-cyan-300 hover:text-cyan-200 disabled:opacity-50"
                          onClick={() => applyOcrText(a)}
                          disabled={applyingOcrId === a.id}
                        >
                          {applyingOcrId === a.id ? 'Adding…' : '+ Add OCR to runtime evidence'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <label className="btn-secondary mt-4 inline-flex w-full cursor-pointer text-xs">
              {uploading ? 'Uploading…' : '+ Attach evidence'}
              <input
                type="file"
                className="hidden"
                accept=".txt,.log,.json,.xml,.csv,.png,.jpg,.jpeg,.zip"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
            <p className="mt-2 text-[9px] leading-4 text-slate-700">
              TXT, LOG, JSON, XML, CSV, PNG, JPG, ZIP · Max 20 MB
            </p>
          </section>

          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Collaboration</p>
                <h3 className="mt-1 text-sm font-semibold text-slate-200">Comments</h3>
              </div>
              <span className="font-mono text-[10px] text-slate-600">{bug.comments.length}</span>
            </div>

            {bug.comments.length === 0 ? (
              <p className="mt-4 text-xs text-slate-600">No investigation notes yet.</p>
            ) : (
              <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
                {bug.comments.map((c) => (
                  <div key={c.id} className="rounded-xl border border-white/[0.05] bg-white/[0.018] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-300">{c.author.full_name}</span>
                      <span className="text-[9px] text-slate-700">{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">{c.body}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={submitComment} className="mt-4">
              <textarea
                rows={3}
                className="input-field resize-none"
                placeholder="Add an investigation note…"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
              />
              <button type="submit" className="btn-primary mt-2 w-full" disabled={postingComment || !commentBody.trim()}>
                {postingComment ? 'Posting…' : 'Post note'}
              </button>
            </form>
          </section>

          <section className="panel p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">Audit Trail</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-200">Case Timeline</h3>

            <div className="mt-4 space-y-4">
              {bug.events.map((e, index) => (
                <div key={e.id} className="relative flex gap-3">
                  {index < bug.events.length - 1 && (
                    <span className="absolute left-[5px] top-4 h-[calc(100%+8px)] w-px bg-white/[0.05]" />
                  )}
                  <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#0d1120] bg-violet-400 shadow-[0_0_8px_rgba(124,92,255,0.5)]" />
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      {EVENT_LABELS[e.event_type] || e.event_type}
                    </p>
                    {e.actor && <p className="mt-0.5 text-[10px] text-slate-600">by {e.actor.full_name}</p>}
                    {e.detail && <p className="mt-1 text-[10px] leading-4 text-slate-600">{e.detail}</p>}
                    <p className="mt-1 text-[9px] text-slate-700">{new Date(e.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
