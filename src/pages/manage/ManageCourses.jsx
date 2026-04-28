import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

export function ManageCourses() {
  const [courses, setCourses] = useState([])
  const [loadErr, setLoadErr] = useState(null)
  const [name, setName] = useState('')
  const [fullName, setFullName] = useState('')
  const [rating, setRating] = useState('')
  const [slope, setSlope] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoadErr(null)
    const { data, error } = await supabase
      .from('courses')
      .select('id,name,full_name,rating,slope')
      .order('name')
    if (error) {
      setLoadErr(error.message)
      return
    }
    setCourses(data ?? [])
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function addCourse(e) {
    e.preventDefault()
    const r = parseFloat(rating)
    const s = parseInt(slope, 10)
    if (!name.trim() || !fullName.trim() || Number.isNaN(r) || Number.isNaN(s)) {
      alert('Fill short name, full name, rating, and slope.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('courses').insert({
      name: name.trim(),
      full_name: fullName.trim(),
      rating: r,
      slope: s,
    })
    setSaving(false)
    if (error) {
      alert(error.message)
      return
    }
    setName('')
    setFullName('')
    setRating('')
    setSlope('')
    await load()
    window.dispatchEvent(new CustomEvent('rams:rounds-updated'))
  }

  async function removeCourse(id) {
    if (!confirm('Remove this course from the catalog?')) return
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
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
        ⛳ Courses
      </h2>

      {loadErr ? (
        <p className="mb-3 text-sm text-[#ef5350]">{loadErr}</p>
      ) : null}

      <form
        onSubmit={addCourse}
        className="mb-6 grid gap-2 rounded-md border border-[#333333] bg-[#111111] p-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-[#888888]">
            Short name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-[#444444] bg-[#1A1A1A] px-2 py-2 text-sm text-white"
            placeholder="Arrowhead"
            required
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] font-bold uppercase text-[#888888]">
            Full name
          </span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="rounded-md border border-[#444444] bg-[#1A1A1A] px-2 py-2 text-sm text-white"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-[#888888]">
            Rating (18h)
          </span>
          <input
            type="number"
            step="0.1"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="rounded-md border border-[#444444] bg-[#1A1A1A] px-2 py-2 text-sm text-white"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase text-[#888888]">
            Slope
          </span>
          <input
            type="number"
            value={slope}
            onChange={(e) => setSlope(e.target.value)}
            className="rounded-md border border-[#444444] bg-[#1A1A1A] px-2 py-2 text-sm text-white"
            required
          />
        </label>
        <div className="flex items-end lg:col-span-5">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] rounded-md bg-[#E8650A] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            Add course
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="border-b border-[#333333] py-2 text-left text-[11px] font-bold text-white">
                Course
              </th>
              <th className="border-b border-[#333333] py-2 text-center text-[11px] font-bold text-white">
                Rating
              </th>
              <th className="border-b border-[#333333] py-2 text-center text-[11px] font-bold text-white">
                Slope
              </th>
              <th className="border-b border-[#333333] py-2 text-right text-[11px] font-bold text-white">
                Remove
              </th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.id} className="even:bg-[#1f1f1f]">
                <td className="border-b border-[#252525] py-2 text-[#dddddd]">
                  {c.full_name ?? c.name}
                </td>
                <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                  {c.rating}
                </td>
                <td className="border-b border-[#252525] py-2 text-center text-[#dddddd]">
                  {c.slope}
                </td>
                <td className="border-b border-[#252525] py-2 text-right">
                  <button
                    type="button"
                    className="rounded border border-[#ef5350] px-2 py-1 text-[10px] font-bold text-[#ef5350]"
                    onClick={() => removeCourse(c.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
