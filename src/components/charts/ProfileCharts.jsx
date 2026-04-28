import { Line, Bar } from 'react-chartjs-2'
import '../../chartSetup'

const ORANGE = '#E8650A'
const GRID = '#2a2a2a'
const LABEL = '#888888'

function chartOpts(legendDisplay = false, legendDataset = false) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: legendDataset
        ? {
            display: true,
            labels: { color: LABEL, font: { size: 9 }, boxWidth: 12 },
          }
        : { display: legendDisplay },
    },
    scales: {
      x: {
        ticks: { color: LABEL, font: { size: 9 } },
        grid: { color: GRID },
        border: { color: GRID },
      },
      y: {
        ticks: { color: LABEL, font: { size: 9 } },
        grid: { color: GRID },
        border: { color: GRID },
        beginAtZero: false,
      },
    },
  }
}

function barOpts() {
  const o = chartOpts(false)
  o.scales.y.beginAtZero = true
  return o
}

export function ProfileCharts({ labels, playerRounds }) {
  const scores = playerRounds.map((r) => r.score)
  const diffs = playerRounds.map((r) =>
    r.diff != null ? Number.parseFloat(r.diff.toFixed(2)) : null,
  )

  const scoreData =
    scores.length > 0
      ? {
          labels,
          datasets: [
            {
              label: 'Score',
              data: scores,
              borderColor: ORANGE,
              backgroundColor: 'rgba(232,101,10,0.12)',
              tension: 0.3,
              pointBackgroundColor: ORANGE,
              pointRadius: 4,
              fill: true,
              spanGaps: false,
            },
          ],
        }
      : null

  const diffData =
    diffs.some((d) => d != null)
      ? {
          labels,
          datasets: [
            {
              label: 'Diff',
              data: diffs,
              borderColor: '#64b5f6',
              backgroundColor: 'rgba(100,181,246,0.1)',
              tension: 0.3,
              pointBackgroundColor: '#64b5f6',
              pointRadius: 4,
              fill: true,
              spanGaps: true,
            },
          ],
        }
      : null

  const puttsDataArr = playerRounds.map((r) =>
    r.ds?.putts != null ? r.ds.putts : null,
  )
  const puttsData =
    puttsDataArr.some((v) => v != null)
      ? {
          labels,
          datasets: [
            {
              label: 'Putts',
              data: puttsDataArr,
              borderColor: '#ffffff',
              backgroundColor: 'rgba(255,255,255,0.08)',
              tension: 0.3,
              pointBackgroundColor: '#ffffff',
              pointRadius: 4,
              fill: true,
              spanGaps: true,
            },
          ],
        }
      : null

  const girDataArr = playerRounds.map((r) =>
    r.ds?.gir != null ? r.ds.gir : null,
  )
  const firDataArr = playerRounds.map((r) =>
    r.ds?.fir != null ? r.ds.fir : null,
  )
  const girFirHas =
    girDataArr.some((v) => v != null) || firDataArr.some((v) => v != null)

  const girFirData = girFirHas
    ? {
        labels,
        datasets: [
          {
            label: 'GIR',
            data: girDataArr,
            borderColor: ORANGE,
            backgroundColor: 'transparent',
            tension: 0.3,
            pointBackgroundColor: ORANGE,
            pointRadius: 4,
            spanGaps: true,
          },
          {
            label: 'FIR',
            data: firDataArr,
            borderColor: '#4caf50',
            backgroundColor: 'transparent',
            tension: 0.3,
            pointBackgroundColor: '#4caf50',
            pointRadius: 4,
            borderDash: [4, 3],
            spanGaps: true,
          },
        ],
      }
    : null

  const withDs = playerRounds.filter((r) => r.ds)
  const distKeys = [
    'eagles',
    'birdies',
    'pars',
    'bogeys',
    'doubles',
    'other',
  ]
  const distLabels = ['Eagles', 'Birdies', 'Pars', 'Bogeys', 'Doubles', 'Other']
  const distColors = [
    '#FFD700',
    '#4caf50',
    ORANGE,
    '#ef5350',
    '#9c27b0',
    '#607d8b',
  ]

  function avgHoleStat(key) {
    const vals = withDs.map((r) => r.ds[key]).filter((v) => v != null)
    if (!vals.length) return 0
    return Number.parseFloat(
      (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
    )
  }

  const distData =
    withDs.length > 0
      ? {
          labels: distLabels,
          datasets: [
            {
              label: 'Avg per round',
              data: distKeys.map((k) => avgHoleStat(k)),
              backgroundColor: distColors,
              borderRadius: 4,
            },
          ],
        }
      : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-3">
          <div className="mb-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#aaaaaa]">
            Score per round
          </div>
          <div className="relative h-[180px]">
            {scoreData ? (
              <Line data={scoreData} options={chartOpts()} />
            ) : (
              <p className="py-10 text-center text-xs text-[#444444]">
                No scores in filter
              </p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-3">
          <div className="mb-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#aaaaaa]">
            Putts per round
          </div>
          <div className="relative h-[180px]">
            {puttsData ? (
              <Line data={puttsData} options={chartOpts()} />
            ) : (
              <p className="py-10 text-center text-xs text-[#444444]">
                No putts data yet
              </p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-3">
          <div className="mb-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#aaaaaa]">
            GIR &amp; FIR per round
          </div>
          <div className="relative h-[180px]">
            {girFirData ? (
              <Line data={girFirData} options={chartOpts(false, true)} />
            ) : (
              <p className="py-10 text-center text-xs text-[#444444]">
                No GIR/FIR data yet
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-3">
          <div className="mb-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#aaaaaa]">
            Score distribution (avg holes per round)
          </div>
          <div className="relative h-[220px]">
            {distData ? (
              <Bar data={distData} options={barOpts()} />
            ) : (
              <div className="py-10 text-center text-xs text-[#444444]">
                No hole breakdown data yet
                <div className="mt-1 text-[10px] text-[#555555]">
                  Enter Eagles/Birdies etc. on conf/non-conf rounds
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-[#2a2a2a] bg-[#1A1A1A] p-3">
          <div className="mb-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#aaaaaa]">
            Differential trend
          </div>
          <div className="relative h-[220px]">
            {diffData ? (
              <Line data={diffData} options={chartOpts()} />
            ) : (
              <p className="py-10 text-center text-xs text-[#444444]">
                No differential data
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
