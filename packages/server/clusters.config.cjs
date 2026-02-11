const clusters = [
  // 'BG5ATV@dxspider.co.uk:7300',
  'BG5ATV@db0erf.de:8000',
  // 'BG5ATV@ar.bg4wom.club:7373',
  'BG5ATV@www.bg8nud.com:7373',
]

module.exports = clusters.map((entry) => {
  const [callsign, hostPort] = entry.split('@')
  const [host, port] = hostPort.split(':')
  return { callsign, host, port: Number(port) }
})
