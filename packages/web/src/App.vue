<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useIntervalFn, useTimeoutFn, useMediaQuery } from '@vueuse/core'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import 'dayjs/locale/zh-cn'
import FilterPanel from './components/FilterPanel.vue'

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
  },
  audit?: {
    hiddenComment: boolean
  }
  _id?: string
  isFlash?: boolean
}

interface FilterConfig {
  freqMarks?: {
    include?: string[]
    exclude?: string[]
  }
  specificFreq?: {
    include?: string[]
    exclude?: string[]
  }
  dxMarks?: {
    include?: string[]
    exclude?: string[]
  }
  modeMarks?: {
    include?: string[]
    exclude?: string[]
  }
  dxcc?: {
    include?: string[]  // 只支持包含
  }
}

const MAX_ROWS = 200
const spots = ref<Spot[]>([])
const connected = ref(false)
const lastUpdate = ref('尚无数据')
const enableFlash = ref(false)
const currentTime = ref(Date.now()) // 校准后的当前时间(服务器时间)
let timeDiff = 0 // 服务器时间与本地时间的差值(毫秒)

// 过滤器相关状态
const filterDialog = ref<HTMLDialogElement | null>(null)
const currentFilterConfig = ref<FilterConfig>({})
const isMdAndAbove = useMediaQuery('(min-width: 768px)')

// 检查是否有激活的过滤器
function hasActiveFilter() {
  return Object.keys(currentFilterConfig.value).length > 0
}

// 打开过滤器对话框
function openFilter() {
  filterDialog.value?.showModal()
}

// 关闭过滤器对话框
function closeFilter() {
  filterDialog.value?.close()
}

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

  // 小于md屏幕，只显示HH:mm
  if (!isMdAndAbove.value) {
    return dayjs(ts).utc().format('HH:mm')
  }
  
  // md及以上屏幕，使用原有逻辑
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

function getBadgeClass(type: string, location: 'freq' | 'dx' = 'dx') {
  // 频率列badge在1024px以下隐藏，DX列badge在768px以下隐藏
  const responsiveClass = location === 'freq' ? 'hidden lg:inline-flex' : 'hidden md:inline-flex'
  const baseClass = `${responsiveClass} items-center px-2 py-0.5 rounded-full font-semibold text-[11px] tracking-wide ml-1 select-none`
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

// 创建SSE连接
function connectSSE() {
  // 关闭现有连接
  if (es) {
    es.close()
    es = null
  }
  
  // 清空现有spots
  spots.value = []
  connected.value = false
  enableFlash.value = false
  lastUpdate.value = ''
  
  // 构建URL
  let url = '/sse/spots'
  const config = currentFilterConfig.value
  if (Object.keys(config).length > 0) {
    const encoded = btoa(JSON.stringify(config))
    url += `?filter=${encodeURIComponent(encoded)}`
  }
  
  // 创建新连接
  es = new EventSource(url)
  
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
    lastUpdate.value = '连接已断开'
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
}

// 应用过滤器（重新连接SSE）
function applyFilter(config: FilterConfig) {
  currentFilterConfig.value = config
  connectSSE()
  closeFilter()
}

onMounted(() => {
  connectSSE()
})
</script>

<template>
  <div class="max-w-7xl mx-auto my-8 px-5 pb-12">
    <!-- Header -->
    <header class="flex items-center justify-between gap-4 mb-4 px-1">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900">DX Summit</h1>
      <div class="flex items-center gap-3">
        <!-- Filter Button -->
        <button
          @click="openFilter"
          class="inline-flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full text-xs font-medium transition-all hover:bg-gray-50"
          :class="hasActiveFilter() ? 'border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>过滤器</span>
          <span v-if="hasActiveFilter()" class="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-blue-600 rounded-full">!</span>
        </button>
        
        <!-- Connection Status -->
        <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600">
          <span 
            class="w-2 h-2 rounded-full transition-all" 
            :class="connected ? 'bg-green-600 shadow-[0_0_0_4px_rgba(220,252,231,1)]' : 'bg-gray-400'"
          ></span>
          <span>{{ connected ? '已连接' : '已断开' }}</span>
        </div>
      </div>
    </header>
    
    <!-- Filter Panel Dialog -->
    <dialog 
      ref="filterDialog"
      class="max-w-3xl w-[90vw] rounded-xl p-0 backdrop:bg-black/50 m-auto"
      @click.self="closeFilter"
    >
      <FilterPanel 
        @apply="applyFilter"
        @close="closeFilter"
      />
    </dialog>
    
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
              <th class="text-left font-semibold text-gray-700 border-b border-gray-200 px-2 py-1.5 md:px-3.5 md:py-3 sticky top-0 bg-gray-50 z-10">Spotter</th>
              <th class="text-left font-semibold text-gray-700 border-b border-gray-200 px-2 py-1.5 md:px-3.5 md:py-3 sticky top-0 bg-gray-50 z-10">Freq.</th>
              <th class="text-left font-semibold text-gray-700 border-b border-gray-200 px-2 py-1.5 md:px-3.5 md:py-3 sticky top-0 bg-gray-50 z-10">DX</th>
              <th class="text-left font-semibold text-gray-700 border-b border-gray-200 px-2 py-1.5 md:px-3.5 md:py-3 sticky top-0 bg-gray-50 z-10">Time</th>
              <th class="hidden sm:table-cell text-left font-semibold text-gray-700 border-b border-gray-200 px-2 py-1.5 md:px-3.5 md:py-3 sticky top-0 bg-gray-50 z-10">Info</th>
              <th class="hidden md:table-cell text-left font-semibold text-gray-700 border-b border-gray-200 px-2 py-1.5 md:px-3.5 md:py-3 sticky top-0 bg-gray-50 z-10">DXCC</th>
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
              <td class="px-2 py-1.5 md:px-3.5 md:py-3 border-b border-gray-200 align-top whitespace-nowrap">{{ spot.de }}</td>
              <td class="px-2 py-1.5 md:px-3.5 md:py-3 border-b border-gray-200 align-top whitespace-nowrap">
                {{ spot.freq }}
                <span 
                  v-for="m in spot.marks?.modeMarks" 
                  :key="m" 
                  :class="getBadgeClass(m, 'freq')"
                >{{ m }}</span>
                <span 
                  v-for="m in spot.marks?.freqMarks" 
                  :key="m" 
                  :class="getBadgeClass(m, 'freq')"
                >{{ m }}</span>
              </td>
              <td class="px-2 py-1.5 md:px-3.5 md:py-3 border-b border-gray-200 align-top">
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
              <td class="px-2 py-1.5 md:px-3.5 md:py-3 border-b border-gray-200 align-top text-gray-500 whitespace-nowrap">
                {{ formatTime(spot.time) }}
              </td>
              <td class="hidden sm:table-cell px-2 py-1.5 md:px-3.5 md:py-3 border-b border-gray-200 align-top">{{ spot.audit?.hiddenComment ? '***' : spot.comment }}</td>
              <td class="hidden md:table-cell px-2 py-1.5 md:px-3.5 md:py-3 border-b border-gray-200 align-top whitespace-nowrap">{{ spot.dxcc ? spot.dxcc.name : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

