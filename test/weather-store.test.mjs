import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WEATHER_TTL_MS, cleanPlace, createWeatherStore } from '../server/weather.mjs'

const reply = (body) => ({ ok: true, status: 200, json: async () => body })
function fakeFetch(calls, { found = [{ name: 'Lyon', admin1: 'Auvergne-Rhône-Alpes', country: 'France', latitude: 45.75, longitude: 4.85 }], code = 61 } = {}) {
  return async (url) => {
    calls.push(String(url))
    return String(url).includes('geocoding') ? reply({ results: found }) : reply({ current: { weather_code: code } })
  }
}

test('a place is trimmed, and anything that is not a name is refused', () => {
  assert.equal(cleanPlace('  Lyon,   France '), 'Lyon, France')
  assert.equal(cleanPlace("Saint-Jean-de-Luz"), 'Saint-Jean-de-Luz')
  assert.equal(cleanPlace('Zürich'), 'Zürich')
  for (const bad of ['', '   ', 'a&b=c', 'http://x.y', '<b>', '...', ',,,', '()', ' - ', 'x'.repeat(81), 42, null]) assert.equal(cleanPlace(bad), '')
})

test('the store geocodes the place, asks for its weather, and answers from memory for an hour', async () => {
  const calls = []
  let t = 1000
  const store = createWeatherStore({ fetch: fakeFetch(calls), now: () => t })
  assert.deepEqual(await store.get('Lyon'), { ok: true, place: 'Lyon, Auvergne-Rhône-Alpes, France', code: 61 })
  assert.equal(calls.length, 2)
  assert.match(calls[0], /name=Lyon/)
  assert.match(calls[1], /latitude=45.75.*longitude=4.85|longitude=4.85.*latitude=45.75/)
  await store.get('lyon')
  assert.equal(calls.length, 2, 'cached')
  t += WEATHER_TTL_MS + 1
  await store.get('Lyon')
  assert.equal(calls.length, 4, 'asked again after the hour')
})

test('the text after a comma picks among namesakes', async () => {
  const found = [{ name: 'Paris', country: 'France', latitude: 48.85, longitude: 2.35 }, { name: 'Paris', admin1: 'Texas', country: 'United States', latitude: 33.66, longitude: -95.55 }]
  const calls = []
  await createWeatherStore({ fetch: fakeFetch(calls, { found }) }).get('Paris, Texas')
  assert.match(calls[1], /latitude=33.66/)
})

test('an unknown place, a bad answer and a dead network are all plain errors and are not cached', async () => {
  const none = await createWeatherStore({ fetch: fakeFetch([], { found: [] }) }).get('Nowhereville')
  assert.equal(none.ok, false)
  assert.match(none.error, /Nowhereville/)
  assert.equal((await createWeatherStore({ fetch: fakeFetch([], { code: 'x' }) }).get('Lyon')).ok, false)
  let n = 0
  const store = createWeatherStore({ fetch: async () => (n++, Promise.reject(new Error('offline'))) })
  assert.equal((await store.get('Lyon')).ok, false)
  await store.get('Lyon')
  assert.equal(n, 2)
  assert.equal((await store.get('<x>')).ok, false)
})
