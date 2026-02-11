<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useIntervalFn, useTimeoutFn } from '@vueuse/core'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/zh-cn'

dayjs.extend(utc)
dayjs.locale('zh-cn')

interface Spot {
  de: string
  freq: string
  dx: string
  comment: string
  time: number
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
const enableFlash = ref(false)
const currentTime = ref(Date.now()) // 校准后的当前时间(服务器时间)
let timeDiff = 0 // 服务器时间与本地时间的差值(毫秒)

// 每30秒更新一次校准后的当前时间
useIntervalFn(() => {
  currentTime.value = Date.now() + timeDiff
}, 10*1000)

function formatTime(ts: number) {
  if (!ts) return '-'
  
  // currentTime.value已是校准后的时间，直接使用
  const diff = Math.abs(currentTime.value - ts)
  
  // 如果在1小时内，显示相对时间
  if (diff>=0 && diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / 60000)
    if (minutes === 0) {
      return '刚刚'
    }
    return `${minutes} 分钟前`
  }
  
  // 超过1小时，显示UTC时间，并根据日期决定显示格式
  const now = dayjs(currentTime.value).utc()
  const time = dayjs(ts).utc()
  if (now.format('YYYY-MM-DD') === time.format('YYYY-MM-DD')) {
    // 同一天，只显示时间
    return time.format('HH:mm')
  } else if (now.year() === time.year()) {
    // 同一年但不同天，显示月-日 时间
    return time.format('MM-DD HH:mm')
  } else {
    // 不同年，显示年-月-日 时间
    return time.format('YYYY-MM-DD HH:mm')
  }
}

function addSpot(spot: Spot, flash = true) {
  if (flash) {
    spot.isFlash = true
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

function getBadgeClass(type: string) {
  const baseClass = 'inline-flex items-center px-2 py-0.5 rounded-full font-semibold text-[11px] tracking-wide ml-1'
  const colorMap: Record<string, string> = {
    'HF': 'bg-blue-100 text-blue-800',
    'VHF': 'bg-amber-100 text-amber-800',
    'UHF': 'bg-pink-100 text-pink-800',
    'SHF': 'bg-purple-100 text-purple-800',
    'LF': 'bg-indigo-100 text-indigo-800',
    'WARC': 'bg-yellow-100 text-yellow-800',
    'dxcc': 'bg-yellow-100 text-yellow-800',
    'QRP': 'bg-green-100 text-green-800',
    'Mobile': 'bg-orange-100 text-orange-800',
    'Portable': 'bg-violet-100 text-violet-800',
    'Beacon': 'bg-red-100 text-red-800',
    'DIGI': 'bg-cyan-100 text-cyan-800',
    'CW': 'bg-emerald-100 text-emerald-800',
    'PH': 'bg-orange-100 text-orange-800',
  }
  return `${baseClass} ${colorMap[type] || 'bg-blue-100 text-blue-800'}`
}



let es: EventSource | null = null

onMounted(() => {
  es = new EventSource('/sse/spots')
  // es.addEventListener('open', () => {
  //   console.log('EventSource opened')
  // })
  es.addEventListener('connected', (evt) => {
    connected.value = true
    // 接收服务器时间并计算时间差
    try {
      const data = JSON.parse(evt.data)
      if (data.serverTime) {
        const clientTime = Date.now()
        timeDiff = data.serverTime - clientTime
        console.log('时间校准:', timeDiff, 'ms')
        // 立即更新校准后的当前时间
        currentTime.value = Date.now() + timeDiff
      }
    } catch (e) {
      console.warn('Failed to parse server time', e)
    }
    // 5秒后激活闪烁功能
    useTimeoutFn(() => {
      enableFlash.value = true
    }, 5000)
  })
  es.addEventListener('error', () => {
    connected.value = false
    enableFlash.value = false
    console.error('EventSource error')
  })
  es.addEventListener('spot', (evt) => {
    try {
      const spot = JSON.parse(evt.data)
      addSpot(spot, enableFlash.value)
    } catch (e) {
      console.error('Invalid spot data', e, evt.data)
    }
  })
})
</script>

<template>
  <div class="max-w-7xl mx-auto my-8 px-5 pb-12">
    <!-- Header -->
    <header class="flex items-center justify-between gap-4 mb-4 px-1">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900">DX Summit</h1>
      <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">
        <span 
          class="w-2 h-2 rounded-full transition-all" 
          :class="connected ? 'bg-green-600 shadow-[0_0_0_4px_rgba(220,252,231,1)]' : 'bg-gray-400'"
        ></span>
        <span>{{ connected ? '已连接' : '已断开' }}</span>
      </div>
    </header>
    
    <!-- Toolbar -->
    <div class="flex gap-3 items-center text-xs text-gray-500 px-1 mb-3">
      <span>{{ lastUpdate }}</span>
    </div>
    
    <!-- Table Card -->
    <div class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="bg-gray-50">
              <th class="text-left font-semibold text-gray-700 border-b border-gray-200 px-3.5 py-3 sticky top-0 bg-gray-50 z-10">Spotter</th>
              <th class="text-left font-semibold text-gray-700 border-b border-gray-200 px-3.5 py-3 sticky top-0 bg-gray-50 z-10">Freq.</th>
              <th class="text-left font-semibold text-gray-700 border-b border-gray-200 px-3.5 py-3 sticky top-0 bg-gray-50 z-10">DX</th>
              <th class="text-left font-semibold text-gray-700 border-b border-gray-200 px-3.5 py-3 sticky top-0 bg-gray-50 z-10">Time</th>
              <th class="text-left font-semibold text-gray-700 border-b border-gray-200 px-3.5 py-3 sticky top-0 bg-gray-50 z-10">Info</th>
              <th class="text-left font-semibold text-gray-700 border-b border-gray-200 px-3.5 py-3 sticky top-0 bg-gray-50 z-10">DXCC</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="spots.length === 0">
              <td class="text-center py-10 text-gray-500" colspan="6">等待数据…</td>
            </tr>
            <tr 
              v-for="spot in spots" 
              :key="spot._id || spot.time + spot.dx" 
              class="transition-all duration-500 hover:bg-gray-50"
              :class="{ 'animate-flash': spot.isFlash }"
            >
              <td class="px-3.5 py-3 border-b border-gray-200 align-top">{{ spot.de }}</td>
              <td class="px-3.5 py-3 border-b border-gray-200 align-top">
                {{ spot.freq }}
                <span 
                  v-for="m in spot.marks?.modeMarks" 
                  :key="m" 
                  :class="getBadgeClass(m)"
                >{{ m }}</span>
                <span 
                  v-for="m in spot.marks?.freqMarks" 
                  :key="m" 
                  :class="getBadgeClass(m)"
                >{{ m }}</span>
              </td>
              <td class="px-3.5 py-3 border-b border-gray-200 align-top">
                <strong class="font-semibold text-gray-900">{{ spot.dx }}</strong>
                <span 
                  v-if="spot.dxcc" 
                  :class="getBadgeClass('dxcc')"
                >{{ spot.dxcc.primary }}</span>
                <span 
                  v-for="m in spot.marks?.dxMarks" 
                  :key="m" 
                  :class="getBadgeClass(m)"
                >{{ m }}</span>
              </td>
              <td class="px-3.5 py-3 border-b border-gray-200 align-top text-gray-500">
                {{ formatTime(spot.time) }}
              </td>
              <td class="px-3.5 py-3 border-b border-gray-200 align-top">{{ spot.comment }}</td>
              <td class="px-3.5 py-3 border-b border-gray-200 align-top">{{ spot.dxcc ? spot.dxcc.name : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>


