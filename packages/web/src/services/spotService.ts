import { reactive } from 'vue'

export interface Spot {
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
  audit?: {
    hiddenComment: boolean
  }
  _id?: string
  isFlash?: boolean
}

export interface FilterConfig {
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
    include?: string[]
  }
}

export interface ConnectionState {
  connected: boolean
  statusText: string
  timeDiff: number
  retryCount: number
}

export class SpotService {
  private es: EventSource | null = null
  private reconnectTimer: number | undefined
  private currentFilterConfig: FilterConfig = {}
  private onMessageCallback: ((spot: Spot) => void) | null = null
  private readonly MAX_RETRIES = 2
  private readonly RETRY_DELAY = 2000
  private readonly OFFLINE_DELAY = 10000

  private offlineTimer: number | undefined

  // Exposed state
  public readonly state = reactive<ConnectionState>({
    connected: false,
    statusText: '尚无数据',
    timeDiff: 0,
    retryCount: 0,
  })

  constructor() {
    this.setupNetworkListeners()
  }

  public setOnMessage(callback: (spot: Spot) => void) {
    this.onMessageCallback = callback
  }

  public connect(config: FilterConfig = {}, keepState = false) {
    this.currentFilterConfig = config

    // Cleanup previous connection
    this.closeConnection()

    if (!keepState) {
      this.state.connected = false
      this.state.retryCount = 0
      this.state.statusText = ''
    }
    else {
      this.state.statusText = '重新连接中...'
    }

    const url = this.buildUrl(config)

    try {
      this.es = new EventSource(url)
      this.setupEventSourceListeners()
    }
    catch (e) {
      console.error('Failed to create EventSource', e)
      this.handleConnectionError()
    }
  }

  public manualReconnect() {
    this.state.retryCount = 0
    this.connect(this.currentFilterConfig, true)
  }

  public disconnect() {
    this.closeConnection()
    this.state.connected = false
    this.state.statusText = '已断开'
  }

  private closeConnection() {
    if (this.es) {
      this.es.close()
      this.es = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
  }

  private buildUrl(config: FilterConfig): string {
    const baseUrl = '/sse/spots'
    if (Object.keys(config).length === 0)
      return baseUrl

    try {
      const encoded = btoa(JSON.stringify(config))
      return `${baseUrl}?filter=${encodeURIComponent(encoded)}`
    }
    catch (e) {
      console.error('Failed to encode filter config', e)
      return baseUrl
    }
  }

  private handleConnectionError() {
    this.state.connected = false
    this.closeConnection() // Ensure clean slate before retry

    if (this.state.retryCount < this.MAX_RETRIES) {
      this.state.retryCount++
      this.state.statusText = `连接断开，正在尝试重连 (${this.state.retryCount}/${this.MAX_RETRIES})...`

      this.reconnectTimer = window.setTimeout(() => {
        this.connect(this.currentFilterConfig, true)
      }, this.RETRY_DELAY)
    }
    else {
      this.state.statusText = '连接已断开，请检查网络后手动重试'
    }
  }

  private setupEventSourceListeners() {
    if (!this.es)
      return

    this.es.addEventListener('connected', (evt: MessageEvent) => {
      this.state.connected = true
      this.state.retryCount = 0
      this.state.statusText = '' // Connected success

      try {
        const data = JSON.parse(evt.data)
        if (data.serverTime) {
          this.state.timeDiff = data.serverTime - Date.now()
          console.log('时间校准:', this.state.timeDiff, 'ms')
        }
      }
      catch (e) {
        console.warn('Failed to parse server time', e)
      }
    })

    this.es.addEventListener('error', (e) => {
      console.error('EventSource error', e)
      // If readyState is CLOSED, it might be a permanent error or manual close,
      // but here we treat it as a dropped connection that needs retry logic.
      if (this.es?.readyState === EventSource.CLOSED) {
        // If it was closed manually, we wouldn't be here (listeners removed? no es object?)
        // Actually, if we set es=null in disconnect, we shouldn't get events.
        // So checking readyState is good.
      }
      this.handleConnectionError()
    })

    this.es.addEventListener('spot', (evt: MessageEvent) => {
      try {
        const spot = JSON.parse(evt.data)
        if (this.onMessageCallback) {
          this.onMessageCallback(spot)
        }
      }
      catch (e) {
        console.error('Invalid spot data', e, evt.data)
      }
    })
  }

  private setupNetworkListeners() {
    window.addEventListener('offline', () => {
      clearTimeout(this.offlineTimer)
      this.offlineTimer = window.setTimeout(() => {
        this.disconnect()
        this.state.statusText = '网络已断开'
      }, this.OFFLINE_DELAY)
    })

    window.addEventListener('online', () => {
      clearTimeout(this.offlineTimer)
      if (document.visibilityState === 'visible' && !this.state.connected) {
        this.manualReconnect()
      }
    })

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (this.offlineTimer && navigator.onLine) {
          clearTimeout(this.offlineTimer)
          this.offlineTimer = undefined
        }
        if (!this.state.connected && navigator.onLine) {
          this.manualReconnect()
        }
      }
    })
  }
}

export const spotService = new SpotService()
