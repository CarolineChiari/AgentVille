// Boot stub — replaced by the real boot sequence in Phase 2.
const canvas = document.getElementById('world')
const ctx = canvas.getContext('2d')
function resize() {
  canvas.width = Math.floor(innerWidth * devicePixelRatio)
  canvas.height = Math.floor(innerHeight * devicePixelRatio)
  ctx.fillStyle = '#6fae4c'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
}
addEventListener('resize', resize)
resize()
