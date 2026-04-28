import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  downloadJson,
  exportDatabaseJson,
  importDatabaseJson,
} from '../../utils/backup'

export function ManageExport() {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  async function handleExport() {
    setMsg(null)
    setBusy(true)
    try {
      const data = await exportDatabaseJson()
      downloadJson(
        `rockford-rams-backup-${new Date().toISOString().slice(0, 10)}.json`,
        data,
      )
      setMsg('Download started.')
    } catch (e) {
      setMsg(e?.message ?? 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMsg(null)
    const text = await file.text()
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      setMsg('Invalid JSON file.')
      return
    }
    if (
      !confirm(
        'This will DELETE all rounds, scores, players, courses, and seasons and replace them with this backup. Continue?',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await importDatabaseJson(parsed)
      setMsg('Import completed. Reload recommended.')
    } catch (err) {
      setMsg(err?.message ?? 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-4">
      <Link
        to="/"
        className="mb-3 inline-block text-sm text-[#E8650A] hover:underline"
      >
        ← Back to app
      </Link>
      <h2 className="mb-3 border-b-2 border-[#E8650A] pb-2 text-[15px] font-bold text-white">
        💾 Export / Import
      </h2>

      <p className="mb-4 text-sm leading-relaxed text-[#aaaaaa]">
        Download a complete JSON backup of seasons, courses, roster, rounds,
        and scores. Import replaces{' '}
        <strong className="text-[#ef5350]">all</strong> data — use only with
        trusted backup files.
      </p>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={busy}
          className="min-h-[44px] rounded-md bg-[#E8650A] px-5 text-sm font-bold text-white disabled:opacity-50"
          onClick={() => void handleExport()}
        >
          Download JSON backup
        </button>

        <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-md border border-[#444444] bg-[#2a2a2a] px-5 text-sm font-bold text-white hover:bg-[#333333]">
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={busy}
            onChange={(e) => void handleImportFile(e)}
          />
          Upload JSON backup
        </label>
      </div>

      {msg ? (
        <p className="mt-4 text-sm text-[#888888]" role="status">
          {msg}
        </p>
      ) : null}

      <p className="mt-6 text-xs text-[#555555]">
        Excel export is not implemented in this build; use JSON for full
        fidelity.
      </p>
    </div>
  )
}
