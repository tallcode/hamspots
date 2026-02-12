import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  vue: true,
  rules: {
    'no-console': 'off',
    'new-cap': 'off',
  },
})
