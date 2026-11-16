const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({ window: {} });
for (const filename of ['constellation_data.js', 'constellation_facts.js', 'constellation_distances.js']) {
  const source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  vm.runInContext(source, context, { filename });
}
const { constellationSky: sky, constellationFacts: facts, constellationDistances: distances } = context.window;

test('every figure has valid connected stars', () => {
  const starsByFigure = sky.labels.map(() => new Set());
  for (const [a, b, labels] of sky.lines) {
    assert.ok(sky.stars[a] && sky.stars[b], 'figure line references missing stars');
    assert.ok(labels.length, 'figure line has no label');
    for (const label of labels) {
      assert.ok(starsByFigure[label], 'figure line references a missing label');
      starsByFigure[label].add(a);
      starsByFigure[label].add(b);
    }
  }
  for (const [index, [name]] of sky.labels.entries()) {
    assert.ok(starsByFigure[index].size >= 2, name + ' has no connected figure');
  }
});

test('every figure has a historical note and a valid example-star distance', () => {
  const names = new Set(sky.labels.map(([name]) => name));
  assert.equal(names.size, sky.labels.length, 'figure labels must be unique');
  for (const name of names) {
    assert.ok(facts[name]?.history, name + ' has no historical note');
    const distance = distances[name];
    assert.ok(distance && distance.length === 3, name + ' has no example-star distance');
    const [hip, lightYears, uncertainty] = distance;
    assert.ok(Number.isInteger(hip) && hip > 0, name + ' has an invalid HIP identifier');
    assert.ok(Number.isFinite(lightYears) && lightYears > 0, name + ' has an invalid distance');
    assert.ok(Number.isFinite(uncertainty) && uncertainty > 0, name + ' has an invalid uncertainty');
  }
  for (const name of [...Object.keys(facts), ...Object.keys(distances)]) {
    assert.ok(names.has(name), name + ' has no matching figure');
  }
});
