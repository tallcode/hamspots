const clusters = require('./clusters.config.cjs')

module.exports = {
  apps: [
    ...clusters.map((cluster, i) => ({
      name: `cluster-${i + 1}`,
      script: 'dist/cluster.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        CLUSTER_HOST: cluster.host,
        CLUSTER_PORT: String(cluster.port),
        CALLSIGN: cluster.callsign,
      },
    })),
    {
      name: 'db',
      script: 'dist/db.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'http',
      script: 'dist/http.js',
      instances: 2,
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production' },
    },
  ],
}
