import * as THREE from 'three'

// Separate lab-only experiment: position an ankle near the top of the bar.
// This does not change the production model or application.
export function makeRaisedLeg(root, target = new THREE.Vector3(-.20, .02, -.10), pole = new THREE.Vector3(-.7, 1, -.2)) {
  root.updateMatrixWorld(true)
  const hip = root.getObjectByName('joint_18'), knee = root.getObjectByName('joint_17'), ankle = root.getObjectByName('joint_22')
  const H = hip.getWorldPosition(new THREE.Vector3()), K = knee.getWorldPosition(new THREE.Vector3()), A = ankle.getWorldPosition(new THREE.Vector3())
  const u0 = K.clone().sub(H), l0 = A.clone().sub(K), l1=u0.length(),l2=l0.length()
  const d=target.clone().sub(H), len=Math.min(Math.max(d.length(),Math.abs(l1-l2)+.0001),l1+l2-.0001), direction=d.normalize()
  const pv=pole.clone().addScaledVector(direction,-pole.dot(direction)).normalize()
  const along=(l1*l1-l2*l2+len*len)/(2*len), h=Math.sqrt(Math.max(0,l1*l1-along*along))
  const desiredKnee=H.clone().addScaledVector(direction,along).addScaledVector(pv,h)
  const qHip=new THREE.Quaternion().setFromUnitVectors(u0.normalize(),desiredKnee.clone().sub(H).normalize())
  const desiredLower=target.clone().sub(desiredKnee).normalize().applyQuaternion(qHip.clone().invert())
  const qKnee=new THREE.Quaternion().setFromUnitVectors(l0.normalize(),desiredLower)
  const qAnkle=qHip.clone().multiply(qKnee).invert()
  return {hip,knee,ankle,qHip,qKnee,qAnkle}
}
export function applyRaisedLeg(leg, t) {
  leg.hip.quaternion.slerp(leg.qHip,t)
  leg.knee.quaternion.slerp(leg.qKnee,t)
  leg.ankle.quaternion.identity().slerp(leg.qAnkle,t)
}
