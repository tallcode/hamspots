// DX Cluster 配置
const clusters = [
  { host: 'dxspider.co.uk', port: '7300' },
  { host: 'db0erf.de', port: '8000' },
  { host: 'ar.bg4wom.club', port: '7373' },
  { host: 'www.bg8nud.com', port: '7373' },
]

// 生成 cluster-service 配置
const clusterApps = clusters.map((cluster, index) => ({
  name: `cluster-service-${index + 1}`,
  script: 'src/cluster-service.js',
  instances: 1,
  exec_mode: 'fork',
  env: {
    NODE_ENV: 'production',
    CLUSTER_HOST: cluster.host,
    CLUSTER_PORT: cluster.port,
    CALLSIGN: 'BG5ATV',
  },
}))

module.exports = {
  apps: [
    ...clusterApps,
    {
      name: 'db-service',
      script: 'src/db-service.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'http-service',
      script: 'src/http-service.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
