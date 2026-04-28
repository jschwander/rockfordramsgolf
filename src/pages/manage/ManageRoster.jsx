import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { playerDisplayName } from '../../utils/players'

export function ManageRoster() {
  const [seasons, setSeasons] = useState([])
  const [seasonFilter, setSeasonFilter] = useState('2026')
  const [players, setPlayers] = useState([])
  const [loadErr, setLoadErr] = useState(null)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [grade, setGrade] = useState('')
  const [saving, setSaving] = useState(false)

  const [editPlayer, setEditPlayer] = useState(null)
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')
  const [editGrade, setEditGrade] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const load = useCallback(async () => {
    setLoadErr(null)
    const [sRes, pRes] = await Promise.all([
      supabase.from('seasons').select('name').order('name'),
      supabase
        .from('players')
        .select(
          'id,first_name,last_name,grade,season_name,active,display_order',
        )
        .order('display_order'),
    ])
    if (sRes.error) {
      setLoadErr(sRes.error.message)
      return
    }
    if (pRes.error) {
      setLoadErr(pRes.error.message)
      return
    }
    const names = (sRes.data ?? []).map((r) => r.name)
    setSeasons(names)
    setPlayers(pRes.data ?? [])
    setSeasonFilter((prev) =>
      names.includes(prev) ? prev : names[0] ?? '2026',
    )
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(
    () => players.filter((p) => p.season_name === seasonFilter),
    [players, seasonFilter],
  )

  async function addPlayer(e) {
    e.preventDefault()
    if (!first.trim()) return
    setSaving(true)
    const maxOrder = filtered.length
      ? Math.max(...filtered.map((p) => p.display_order ?? 0))
      : 0
    const { error } = await supabase.from('players').insert({
      season_name: seasonFilter,
      first_name: first.trim(),
      last_name: last.trim(),
      grade: grade.trim(),
      active: true,
      display_order: maxOrder + 1,
    })
    setSaving(false)
    if (error) {
      alert(error.message)
      return
    }
    setFirst('')
    setLast('')
    setGrade('')
    await load()
    window.dispatchEvent(new CustomEvent('rams:rounds-updated'))
  }

  async function toggleActive(p) {
    const { error } = await supabase
      .from('players')
      .update({ active: !p.active })
      .eq('id', p.id)
    if (error) {
      alert(error.message)
      return
    }
    await load()
    window.dispatchEvent(new CustomEvent('rams:rounds-updated'))
  }

  async function removePlayer(p) {
    if (!confirm(`Remove ${playerDisplayName(p)} from the roster?`)) return
    const { error } = await supabase.from('players').delete().eq('id', p.id)
    if (error) {
      alert(error.message)
      return
    }
    await load()
    window.dispatchEvent(new CustomEvent('rams:rounds-updated'))
  }

  function openEdit(p) {
    setEditPlayer(p)
    setEditFirst(p.first_name ?? '')
    setEditLast(p.last_name ?? '')
    setEditGrade(p.grade ?? '')
  }

  function closeEdit() {
    setEditPlayer(null)
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editPlayer || !editFirst.trim()) return
    setSavingEdit(true)
    const { error } = await supabase
      .from('players')
      .update({
        first_name: editFirst.trim(),
        last_name: editLast.trim(),
        grade: editGrade.trim(),
      })
      .eq('id', editPlayer.id)
    setSavingEdit(false)
    if (error) {
      alert(error.message)
      return
    }
    await load()
    window.dispatchEvent(new CustomEvent('rams:rounds-updated'))
    closeEdit()
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
        👥 Roster
      </h2>

      {loadErr ? (
        <p className="mb-3 text-sm text-[#ef5350]">{loadErr}</p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#888888]">
          Season:
        </span>
        {seasons.map((s) => (
          <button
            key={s}
            type="button"
            className={[
              'rounded-full border px-3 py-1 text-xs font-bold',
              seasonFilter === s
                ? 'border-[#E8650A] bg-[#E8650A] text-white'
                : 'border-[#333333] text-[#aaaaaa] hover:bg-[#2a2a2a]',
            ].join(' ')}
            onClick={() => setSeasonFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={addPlayer}
        className="mb-6 flex flex-wrap items-end gap-2 rounded-md border border-[#333333] bg-[#111111] p-3"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-[#888888]">
            First name
          </span>
          <input
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            className="rounded-md border border-[#444444] bg-[#1A1A1A] px-2 py-2 text-sm text-white"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-[#888888]">
            Last name
          </span>
          <input
            value={last}
            onChange={(e) => setLast(e.target.value)}
            className="rounded-md border border-[#444444] bg-[#1A1A1A] px-2 py-2 text-sm text-white"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-[#888888]">
            Grade
          </span>
          <input
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="rounded-md border border-[#444444] bg-[#1A1A1A] px-2 py-2 text-sm text-white"
            placeholder="Junior"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] rounded-md bg-[#E8650A] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          Add player
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border-b border-[#333333] py-2 text-left text-[11px] font-bold text-white">
                Name
              </th>
              <th className="border-b border-[#333333] py-2 text-left text-[11px] font-bold text-white">
                Grade
              </th>
              <th className="border-b border-[#333333] py-2 text-center text-[11px] font-bold text-white">
                Active
              </th>
              <th className="border-b border-[#333333] py-2 text-right text-[11px] font-bold text-white">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="even:bg-[#1f1f1f]">
                <td className="border-b border-[#252525] py-2 text-[#dddddd]">
                  {playerDisplayName(p)}
                </td>
                <td className="border-b border-[#252525] py-2 text-[#dddddd]">
                  {p.grade || '—'}
                </td>
                <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                  {p.active ? 'Yes' : 'No'}
                </td>
                <td className="border-b border-[#252525] py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    title="Edit"
                    aria-label="Edit player"
                    className="mr-2 rounded border border-[#333333] px-2 py-1 text-[11px] font-bold text-[#aaaaaa] hover:bg-[#2a2a2a]"
                    onClick={() => openEdit(p)}
                  >
                    ✏
                  </button>
                  <button
                    type="button"
                    title={p.active ? 'Deactivate' : 'Activate'}
                    aria-label={p.active ? 'Deactivate' : 'Activate'}
                    className="mr-2 rounded border border-[#333333] px-2 py-1 text-[11px] font-bold text-[#aaaaaa] hover:bg-[#2a2a2a]"
                    onClick={() => toggleActive(p)}
                  >
                    —
                  </button>
                  <button
                    type="button"
                    title="Remove"
                    aria-label="Remove player"
                    className="rounded border border-[#ef5350] px-2 py-1 text-[11px] font-bold text-[#ef5350] hover:bg-[#2a1515]"
                    onClick={() => removePlayer(p)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editPlayer ? (
        <div
          className="fixed inset-0 z-[250] flex items-start justify-center overflow-y-auto bg-black/75 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-player-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEdit) closeEdit()
          }}
        >
          <form
            className="my-auto w-full max-w-[400px] rounded-xl border border-[#333333] bg-[#1A1A1A] p-6"
            onSubmit={saveEdit}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="edit-player-title"
              className="mb-4 border-b-2 border-[#E8650A] pb-2.5 text-[15px] font-bold text-white"
            >
              Edit player
            </h3>
            <div className="mb-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
                  First name
                </span>
                <input
                  value={editFirst}
                  onChange={(e) => setEditFirst(e.target.value)}
                  className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
                  required
                  autoFocus
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
                  Last name
                </span>
                <input
                  value={editLast}
                  onChange={(e) => setEditLast(e.target.value)}
                  className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#888888]">
                  Grade
                </span>
                <input
                  value={editGrade}
                  onChange={(e) => setEditGrade(e.target.value)}
                  className="rounded-md border border-[#333333] bg-[#111111] px-3 py-2 text-sm text-white focus:border-[#E8650A] focus:outline-none"
                  placeholder="Junior"
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-[#333333] bg-transparent px-4 py-2 text-sm font-bold text-[#aaaaaa] hover:bg-[#2a2a2a]"
                disabled={savingEdit}
                onClick={closeEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="min-h-[44px] rounded-md bg-[#E8650A] px-5 text-sm font-bold text-white hover:bg-[#B84E07] disabled:opacity-50"
              >
                {savingEdit ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
