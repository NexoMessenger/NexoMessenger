import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { makeRaisedLeg, applyRaisedLeg } from '../tools/astra-leg-ik-experiment.js'

test('experimental two-bone leg reaches a reachable target and preserves ankle orientation', () => {
  const root = new THREE.Group()
  const hip = new THREE.Bone(); hip.name = 'joint_18'; hip.position.set(-.04, .02, 0)
  const knee = new THREE.Bone(); knee.name = 'joint_17'; knee.position.set(-.05, -.2, 0)
  const ankle = new THREE.Bone(); ankle.name = 'joint_22'; ankle.position.set(-.08, -.23, 0)
  root.add(hip); hip.add(knee); knee.add(ankle); root.updateMatrixWorld(true)
  const target = new THREE.Vector3(-.22, .03, -.08)
  const solution = makeRaisedLeg(root, target)
  applyRaisedLeg(solution, 1); root.updateMatrixWorld(true)
  const pos = ankle.getWorldPosition(new THREE.Vector3())
  assert.ok(pos.distanceTo(target) < 1e-6)
  const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(ankle.getWorldQuaternion(new THREE.Quaternion()))
  assert.ok(direction.distanceTo(new THREE.Vector3(0,1,0)) < 1e-6)
})
