import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

export function ManageSeasons() {
  const [seasons, setSeasons] = useState([])
  const [counts, setCounts] = useState({})
  const [loadErr, setLoadErr] = useState(null)
  const [newSeason, setNewSeason] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoadErr(null)
    const { data: srows, error: sErr } = await supabase
      .from('seasons')
      .select('name')
      .order('name')
    if (sErr) {
      setLoadErr(sErr.message)
      return
    }
    const names = (srows ?? []).map((r) => r.name)
    setSeasons(names)

    const { data: rounds, error: rErr } = await supabase
      .from('rounds')
      .select('season_name')
    if (rErr) {
      setLoadErr(rErr.message)
      return
    }
    const c = {}
    for (const r of rounds ?? []) {
      const k = r.season_name
      c[k] = (c[k] ?? 0) + 1
    }
    setCounts(c)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addSeason(e) {
    e.preventDefault()
    const nm = newSeason.trim()
    if (!nm) return
    setSaving(true)
    const { error } = await supabase.from('seasons').insert({ name: nm })
    setSaving(false)
    if (error) {
      alert(error.message)
      return
    }
    setNewSeason('')
    await load()
    window.dispatchEvent(new CustomEvent('rams:rounds-updated'))
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
        📅 Seasons
      </h2>

      {loadErr ? (
        <p className="mb-3 text-sm text-[#ef5350]">{loadErr}</p>
      ) : null}

      <form
        onSubmit={addSeason}
        className="mb-6 flex flex-wrap items-end gap-2 rounded-md border border-[#333333] bg-[#111111] p-3"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-[#888888]">
            New season name
          </span>
          <input
            value={newSeason}
            onChange={(e) => setNewSeason(e.target.value)}
            className="rounded-md border border-[#444444] bg-[#1A1A1A] px-2 py-2 text-sm text-white"
            placeholder="2027"
          />
        </label>
        <button
          type="submit"
          disabled={saving || !newSeason.trim()}
          className="min-h-[44px] rounded-md bg-[#E8650A] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          Add season
        </button>
      </form>

      <ul className="space-y-2">
        {seasons.map((name) => (
          <li
            key={name}
            className="flex items-center justify-between rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-[#dddddd]"
          >
            <span className="font-bold text-white">{name}</span>
            <span className="text-[#888888]">
              {counts[name] ?? 0} round{(counts[name] ?? 0) === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
