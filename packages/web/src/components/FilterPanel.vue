<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// 过滤器状态: 'neutral' | 'include' | 'exclude'
type FilterState = 'neutral' | 'include' | 'exclude'

interface FilterMarks {
  [key: string]: FilterState
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

interface DXCCEntity {
  name: string
  primary: string
  continent: string
}

const emit = defineEmits<{
  apply: [config: FilterConfig]
  close: []
}>()

// 过滤器状态
const freqFilter = ref<FilterMarks>({
  'HF': 'neutral',
  'VHF': 'neutral',
  'UHF': 'neutral',
  'SHF': 'neutral',
  'LF': 'neutral',
  'WARC': 'neutral'
})

const specificFreqFilter = ref<FilterMarks>({})
const specificFreqOptions = ref<string[]>([])

const modeFilter = ref<FilterMarks>({
  'DIGI': 'neutral',
  'CW': 'neutral',
  'PH': 'neutral'
})

const dxFilter = ref<FilterMarks>({
  'QRP': 'neutral',
  'Mobile': 'neutral',
  'Portable': 'neutral',
  'Beacon': 'neutral'
})

const dxccSelected = ref<Set<string>>(new Set())
const dxccEntities = ref<DXCCEntity[]>([])
const dxccSearchQuery = ref('')
const dxccDialog = ref<HTMLDialogElement | null>(null)

// 获取过滤器选项
onMounted(async () => {
  try {
    const response = await fetch('/api/filter-options')
    const data = await response.json()
    
    // 初始化具体频率过滤器
    specificFreqOptions.value = data.specificFreqs || []
    for (const freq of specificFreqOptions.value) {
      specificFreqFilter.value[freq] = 'neutral'
    }
    
    // 存储 DXCC 实体列表
    dxccEntities.value = data.dxccEntities || []
  } catch (e) {
    console.error('Failed to load filter options', e)
  }
})

// 构建过滤器配置
const filterConfig = computed<FilterConfig>(() => {
  const config: FilterConfig = {}
  
  // 处理频率过滤器
  const freqInclude = Object.keys(freqFilter.value).filter(k => freqFilter.value[k] === 'include')
  const freqExclude = Object.keys(freqFilter.value).filter(k => freqFilter.value[k] === 'exclude')
  if (freqInclude.length > 0 || freqExclude.length > 0) {
    config.freqMarks = {}
    if (freqInclude.length > 0) config.freqMarks.include = freqInclude
    if (freqExclude.length > 0) config.freqMarks.exclude = freqExclude
  }
  
  // 处理具体频率过滤器
  const specificInclude = Object.keys(specificFreqFilter.value).filter(k => specificFreqFilter.value[k] === 'include')
  const specificExclude = Object.keys(specificFreqFilter.value).filter(k => specificFreqFilter.value[k] === 'exclude')
  if (specificInclude.length > 0 || specificExclude.length > 0) {
    config.specificFreq = {}
    if (specificInclude.length > 0) config.specificFreq.include = specificInclude
    if (specificExclude.length > 0) config.specificFreq.exclude = specificExclude
  }
  
  // 处理模式过滤器
  const modeInclude = Object.keys(modeFilter.value).filter(k => modeFilter.value[k] === 'include')
  const modeExclude = Object.keys(modeFilter.value).filter(k => modeFilter.value[k] === 'exclude')
  if (modeInclude.length > 0 || modeExclude.length > 0) {
    config.modeMarks = {}
    if (modeInclude.length > 0) config.modeMarks.include = modeInclude
    if (modeExclude.length > 0) config.modeMarks.exclude = modeExclude
  }
  
  // 处理DX过滤器
  const dxInclude = Object.keys(dxFilter.value).filter(k => dxFilter.value[k] === 'include')
  const dxExclude = Object.keys(dxFilter.value).filter(k => dxFilter.value[k] === 'exclude')
  if (dxInclude.length > 0 || dxExclude.length > 0) {
    config.dxMarks = {}
    if (dxInclude.length > 0) config.dxMarks.include = dxInclude
    if (dxExclude.length > 0) config.dxMarks.exclude = dxExclude
  }
  
  // 处理 DXCC 过滤器（只支持包含）
  const dxccInclude = Array.from(dxccSelected.value)
  if (dxccInclude.length > 0) {
    config.dxcc = {
      include: dxccInclude
    }
  }
  
  return config
})

// 过滤后的 DXCC 列表
const filteredDxccEntities = computed(() => {
  const query = dxccSearchQuery.value.toLowerCase()
  if (!query) return dxccEntities.value
  return dxccEntities.value.filter(e => 
    e.name.toLowerCase().includes(query) || 
    e.primary.toLowerCase().includes(query)
  )
})

// 已选择的 DXCC
const selectedDxccEntities = computed(() => {
  return dxccEntities.value.filter(e => dxccSelected.value.has(e.primary))
})

// 切换过滤器状态
function toggleFilterState(filterObj: FilterMarks, key: string) {
  const states: FilterState[] = ['neutral', 'include', 'exclude']
  const currentIndex = states.indexOf(filterObj[key])
  filterObj[key] = states[(currentIndex + 1) % states.length]
}

// 切换 DXCC 选择
function toggleDxcc(entity: DXCCEntity) {
  if (dxccSelected.value.has(entity.primary)) {
    dxccSelected.value.delete(entity.primary)
  } else {
    dxccSelected.value.add(entity.primary)
  }
}

function openDxccDialog() {
  dxccDialog.value?.showModal()
}

function closeDxccDialog() {
  dxccDialog.value?.close()
  dxccSearchQuery.value = ''
}

// 移除 DXCC
function removeDxcc(primary: string) {
  dxccSelected.value.delete(primary)
}

// 清除所有过滤器
function clearAllFilters() {
  Object.keys(freqFilter.value).forEach(k => freqFilter.value[k] = 'neutral')
  Object.keys(specificFreqFilter.value).forEach(k => specificFreqFilter.value[k] = 'neutral')
  Object.keys(modeFilter.value).forEach(k => modeFilter.value[k] = 'neutral')
  Object.keys(dxFilter.value).forEach(k => dxFilter.value[k] = 'neutral')
  dxccSelected.value.clear()
}

// 获取过滤器按钮样式
function getFilterButtonClass(state: FilterState) {
  const baseClass = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer select-none border-2'
  if (state === 'include') {
    return `${baseClass} bg-green-100 border-green-500 text-green-800`
  } else if (state === 'exclude') {
    return `${baseClass} bg-red-100 border-red-500 text-red-800`
  } else {
    return `${baseClass} bg-gray-100 border-gray-300 text-gray-600 hover:border-gray-400`
  }
}

// 获取过滤器按钮图标
function getFilterIcon(state: FilterState) {
  if (state === 'include') return '✓'
  if (state === 'exclude') return '✗'
  return ''
}

// 应用过滤器
function applyFilter() {
  emit('apply', filterConfig.value)
}
</script>

<template>
  <div class="bg-white border border-gray-200 rounded-xl shadow-2xl p-6 flex flex-col max-h-[90vh]">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900">过滤器设置</h2>
      <button
        @click="clearAllFilters"
        class="text-sm text-gray-600 hover:text-gray-900 underline"
      >
        清除全部
      </button>
    </div>
    
    <!-- 可滚动区域 -->
    <div class="space-y-6 overflow-y-auto pr-2 flex-1 min-h-0">
      <!-- 频率波段过滤器 -->
      <div>
        <h3 class="text-sm font-semibold text-gray-700 mb-3">频率波段</h3>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(state, key) in freqFilter"
            :key="key"
            @click="toggleFilterState(freqFilter, key)"
            :class="getFilterButtonClass(state)"
          >
            <span class="mr-1">{{ getFilterIcon(state) }}</span>
            {{ key }}
          </div>
        </div>
      </div>
      
      <!-- 具体频率过滤器 -->
      <div v-if="specificFreqOptions.length > 0">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">具体频率</h3>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(state, key) in specificFreqFilter"
            :key="key"
            @click="toggleFilterState(specificFreqFilter, key)"
            :class="getFilterButtonClass(state)"
          >
            <span class="mr-1">{{ getFilterIcon(state) }}</span>
            {{ key }}
          </div>
        </div>
      </div>
      
      <!-- 模式过滤器 -->
      <div>
        <h3 class="text-sm font-semibold text-gray-700 mb-3">通信模式</h3>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(state, key) in modeFilter"
            :key="key"
            @click="toggleFilterState(modeFilter, key)"
            :class="getFilterButtonClass(state)"
          >
            <span class="mr-1">{{ getFilterIcon(state) }}</span>
            {{ key }}
          </div>
        </div>
      </div>
      
      <!-- DX标记过滤器 -->
      <div>
        <h3 class="text-sm font-semibold text-gray-700 mb-3">DX 标记</h3>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="(state, key) in dxFilter"
            :key="key"
            @click="toggleFilterState(dxFilter, key)"
            :class="getFilterButtonClass(state)"
          >
            <span class="mr-1">{{ getFilterIcon(state) }}</span>
            {{ key }}
          </div>
        </div>
      </div>

      <!-- DXCC 过滤器 -->
      <div>
        <h3 class="text-sm font-semibold text-gray-700 mb-3">DXCC 实体</h3>
        
        <!-- 已选择的 DXCC -->
        <div v-if="selectedDxccEntities.length > 0" class="flex flex-wrap gap-2 mb-3">
          <div
            v-for="entity in selectedDxccEntities"
            :key="entity.primary"
            class="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium border-2 bg-blue-100 border-blue-500 text-blue-800"
          >
            {{ entity.name }}
            <span class="ml-1 text-xs opacity-60">({{ entity.primary }})</span>
            <button
              @click="removeDxcc(entity.primary)"
              class="ml-2 text-base opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
        
        <!-- 打开 DXCC 选择弹窗的按钮 -->
        <button
          @click="openDxccDialog"
          class="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 text-left flex items-center gap-2 transition-colors"
        >
          <span class="text-lg leading-none">+</span>
          添加 DXCC 实体...
        </button>
      </div>
    </div>
    
    <!-- 底部按钮 -->
    <div class="flex gap-3 mt-6 pt-4 border-t border-gray-200">
      <button
        @click="applyFilter"
        class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        应用过滤器
      </button>
      <button
        @click="emit('close')"
        class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
      >
        取消
      </button>
    </div>

    <!-- DXCC 选择弹窗 -->
    <dialog
      ref="dxccDialog"
      class="max-w-2xl w-full rounded-xl p-0 backdrop:bg-black/50 m-auto shadow-2xl"
      @click.self="closeDxccDialog"
    >
      <div class="flex flex-col h-[70vh]">
        <div class="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">选择 DXCC 实体</h3>
          <button @click="closeDxccDialog" class="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
        </div>
        
        <div class="p-4 border-b border-gray-200 bg-gray-50">
          <input
            v-model="dxccSearchQuery"
            type="text"
            placeholder="搜索 DXCC 实体或前缀..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autofocus
          >
        </div>
        
        <div class="flex-1 overflow-y-auto p-2">
          <div v-if="filteredDxccEntities.length === 0" class="text-center py-8 text-gray-500">
            未找到匹配的 DXCC 实体
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div
              v-for="entity in filteredDxccEntities.slice(0, 100)"
              :key="entity.primary"
              @click="toggleDxcc(entity)"
              class="px-3 py-2 rounded-lg cursor-pointer border transition-all flex items-center justify-between"
              :class="dxccSelected.has(entity.primary) 
                ? 'bg-blue-50 border-blue-500 text-blue-900' 
                : 'bg-white border-transparent hover:bg-gray-100 text-gray-700'"
            >
              <div>
                <div class="font-medium">{{ entity.name }}</div>
                <div class="text-xs opacity-70">{{ entity.primary }} · {{ entity.continent }}</div>
              </div>
              <div v-if="dxccSelected.has(entity.primary)" class="text-blue-600">
                ✓
              </div>
            </div>
          </div>
          <div v-if="filteredDxccEntities.length > 100" class="text-center py-4 text-xs text-gray-500">
            仅显示前 100 个结果，请完善搜索关键词
          </div>
        </div>
        
        <div class="p-4 border-t border-gray-200 flex justify-end">
          <button
            @click="closeDxccDialog"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </dialog>
  </div>
</template>
