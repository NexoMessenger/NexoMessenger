import test from 'node:test'
import assert from 'node:assert/strict'
import { sampleMesh, countStretchedEdges } from '../tools/astra-rig-diagnostics.js'

test('diagnostic samples posed vertices after updating the root and skeleton', () => {
  let updates = 0, skeletonUpdates = 0
  const root = { parent: null, updateMatrixWorld(force) { assert.equal(force, true); updates++ } }
  const mesh = {
    parent: root,
    geometry: { attributes: { position: { count: 3 } } },
    skeleton: { update() { skeletonUpdates++ } },
    getVertexPosition(i, out) { return out.set(i, i * 2, i * 3) },
  }
  assert.deepEqual([...sampleMesh(mesh)], [0,0,0, 1,2,3, 2,4,6])
  assert.equal(updates, 1); assert.equal(skeletonUpdates, 1)
})

test('edge diagnostic counts large deformations but ignores tiny edges', () => {
  const indices = [0,1,2]
  const mesh = { geometry: { index: { count: 3, getX: i => indices[i] } } }
  const base = new Float32Array([0,0,0, 1,0,0, 0,1,0])
  const pose = new Float32Array([0,0,0, 6,0,0, 0,1,0])
  const result = countStretchedEdges(mesh, base, pose)
  assert.equal(result.considered, 3)
  assert.equal(result.over2, 2); assert.equal(result.over3, 2); assert.equal(result.over5, 1)
  assert.throws(() => countStretchedEdges(mesh, base, new Float32Array(2)), /Incompatible/)
  const tiny = new Float32Array([0,0,0, .00001,0,0, 0,1,0])
  assert.equal(countStretchedEdges(mesh,tiny,tiny).considered, 2)
})
