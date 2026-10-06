/** A path as a person would say it: under their home directory it starts with `~`. */
export function tilde(p, home) {
  if (!p || !home) return p || ''
  const rest = p.startsWith(home) ? p.slice(home.length) : null
  // `/Users/mere` is not inside `/Users/me`, so what follows has to be a separator.
  return rest !== null && (rest === '' || /^[\\/]/.test(rest)) ? `~${rest}` : p
}
