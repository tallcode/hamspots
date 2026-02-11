<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface Spot {
  de: string
  freq: string
  dx: string
  comment: string
  time: number
  timeDisplay?: string
  dxcc?: {
    name: string
    primary: string
  }
  marks?: {
    freqMarks?: string[]
    dxMarks?: string[]
    modeMarks?: string[]
  }
  _id?: string
  isFlash?: boolean
}

const MAX_ROWS = 200
const spots = ref<Spot[]>([])
const connected = ref(false)
const lastUpdate = ref('尚无数据')

function formatTime(ts: number) {
  if (!ts) return '-'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())} ${d.toLocaleString('en-US', { month: 'short' })}`
}

function addSpot(spot: Spot, flash = true) {
  if (flash) {
    spot.isFlash = true
    // Remove flash after animation
    setTimeout(() => {
      spot.isFlash = false
    }, 2000)
  }
  spots.value.unshift(spot)
  if (spots.value.length > MAX_ROWS) {
    spots.value.pop()
  }
  lastUpdate.value = `最近更新 ${new Date().toISOString().split('.')[0].replace('T', ' ')}(UTC)`
}

async function loadHistory() {
  try {
    const res = await fetch('/api/spots')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const payload = await res.json()
    const list = Array.isArray(payload.data) ? payload.data : []
    spots.value = list.map((s: any) => ({ ...s, isFlash: false }))
    if (spots.value.length > 0) {
      lastUpdate.value = `最近更新 ${new Date().toISOString().split('.')[0].replace('T', ' ')}(UTC)`
    }
  } catch (e) {
    console.error('Failed to load history', e)
  }
}

let es: EventSource | null = null

onMounted(() => {
  loadHistory()
  es = new EventSource('/sse/spots')
  es.addEventListener('open', () => {
    console.log('EventSource opened')
    // 原生 open 事件可能延迟，所以主要依赖服务器的 connected 事件
  })
  es.addEventListener('connected', () => {
    // 收到服务器确认消息，立即显示已连接
    connected.value = true
    console.log('Connected to SSE stream')
  })
  es.addEventListener('error', () => {
    connected.value = false
    console.error('EventSource error')
  })
  es.addEventListener('new-spot', (evt) => {
    try {
      const spot = JSON.parse(evt.data)
      addSpot(spot)
    } catch (e) {
      console.error('Invalid spot data', e, evt.data)
    }
  })
})

onUnmounted(() => {
  if (es) es.close()
})
</script>

<template>
  <div class="wrap">
    <header>
      <h1>DX Summit</h1>
      <div class="status">
        <span class="dot" :class="{ live: connected }"></span>
        <span>{{ connected ? '已连接' : '已断开' }}</span>
      </div>
    </header>
    <div class="toolbar">
      <span>共 <strong>{{ spots.length }}</strong> 条</span>
      <span class="muted">{{ lastUpdate }}</span>
    </div>
    <div class="card mt-3">
      <table>
        <thead>
          <tr>
            <th>Spotter</th>
            <th>Freq.</th>
            <th>DX</th>
            <th>Time</th>
            <th>Info</th>
            <th>DXCC</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="spots.length === 0">
            <td class="empty" colspan="6">等待数据…</td>
          </tr>
          <tr v-for="spot in spots" :key="spot._id || spot.time + spot.dx" :class="{ flash: spot.isFlash }">
            <td>{{ spot.de }}</td>
            <td>
              {{ spot.freq }}
              <span v-for="m in spot.marks?.modeMarks" :key="m" :class="['badge', m]">{{ m }}</span>
              <span v-for="m in spot.marks?.freqMarks" :key="m" :class="['badge', m]">{{ m }}</span>
            </td>
            <td>
              <strong>{{ spot.dx }}</strong>
              <span v-if="spot.dxcc" class="badge dxcc">{{ spot.dxcc.primary }}</span>
              <span v-for="m in spot.marks?.dxMarks" :key="m" :class="['badge', m]">{{ m }}</span>
            </td>
            <td class="muted">{{ spot.timeDisplay || formatTime(spot.time) }}</td>
            <td>{{ spot.comment }}</td>
            <td>{{ spot.dxcc ? spot.dxcc.name : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 1200px;
  margin: 32px auto 48px;
  padding: 0 20px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding: 0 4px;
}
h1 {
  font-size: 22px;
  margin: 0;
  letter-spacing: 0.2px;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--muted);
  font-size: 12px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
}
.dot.live { background: #16a34a; box-shadow: 0 0 0 4px #dcfce7; }
.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
thead th {
  text-align: left;
  font-weight: 600;
  background: #f9fafb;
  color: #374151;
  border-bottom: 1px solid var(--border);
  padding: 12px 14px;
  position: sticky;
  top: 0;
  z-index: 1;
}
tbody td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
tbody tr {
  transition: background-color 0.5s;
}
tbody tr:hover { background: var(--row-hover); }

@keyframes flash-animation {
  0% { background-color: var(--highlight); }
  100% { background-color: transparent; }
}
.flash {
  animation: flash-animation 2s ease-out;
}
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-weak);
  color: var(--accent);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.2px;
  margin-left: 4px;
}
.badge.HF { background: #dbeafe; color: #1e40af; }
.badge.VHF { background: #fef3c7; color: #92400e; }
.badge.UHF { background: #fce7f3; color: #9f1239; }
.badge.SHF { background: #f3e8ff; color: #6b21a8; }
.badge.LF { background: #e0e7ff; color: #3730a3; }
.badge.WARC { background: #fef9c3; color: #854d0e; }
.badge.dxcc { background: #fef9c3; color: #734822; }
.badge.QRP { background: #dcfce7; color: #166534; }
.badge.Mobile { background: #ffedd5; color: #9a3412; }
.badge.Portable { background: #ddd6fe; color: #5b21b6; }
.badge.Beacon { background: #fecaca; color: #991b1b; }
.badge.DIGI { background: #cffafe; color: #155e75; }
.badge.CW { background: #d1fae5; color: #065f46; }
.badge.PH { background: #fed7aa; color: #9a3412; }
.muted { color: var(--muted); }
.empty {
  text-align: center;
  padding: 40px 16px;
  color: var(--muted);
}
.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  color: var(--muted);
  font-size: 12px;
  padding: 0 4px;
}
</style>
