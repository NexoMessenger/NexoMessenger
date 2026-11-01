import * as THREE from 'three'
// Two-bone IK test for the lab. Do not use this on the production model.
export function createArmTargets(root) {
  root.updateMatrixWorld(true)
  return [[7,1,3],[19,23,24]].map(([s,e,w]) => {
    const shoulder=root.getObjectByName(`joint_${s}`), elbow=root.getObjectByName(`joint_${e}`), wrist=root.getObjectByName(`joint_${w}`)
    const S=shoulder.getWorldPosition(new THREE.Vector3()), E=elbow.getWorldPosition(new THREE.Vector3()), W=wrist.getWorldPosition(new THREE.Vector3())
    const side=Math.sign(S.x), target=new THREE.Vector3(side*.035,.095,-.145)
    const upper=E.clone().sub(S), lower=W.clone().sub(E), L1=upper.length(), L2=lower.length()
    const delta=target.clone().sub(S), dist=Math.min(delta.length(),L1+L2-.0001), u=delta.clone().normalize()
    const pole=new THREE.Vector3(side,0,0), perpendicular=pole.addScaledVector(u,-pole.dot(u)).normalize()
    const along=(L1*L1-L2*L2+dist*dist)/(2*dist), height=Math.sqrt(Math.max(0,L1*L1-along*along))
    const desiredElbow=S.clone().addScaledVector(u,along).addScaledVector(perpendicular,height)
    const qShoulder=new THREE.Quaternion().setFromUnitVectors(upper.normalize(),desiredElbow.clone().sub(S).normalize())
    const desiredLower=target.clone().sub(desiredElbow).normalize().applyQuaternion(qShoulder.clone().invert())
    const qElbow=new THREE.Quaternion().setFromUnitVectors(lower.normalize(),desiredLower)
    return {shoulder,elbow,qShoulder,qElbow}
  })
}
export function applyArmTargets(targets, t) {
  for(const {shoulder,elbow,qShoulder,qElbow} of targets) {
    shoulder.quaternion.identity().slerp(qShoulder,t)
    elbow.quaternion.identity().slerp(qElbow,t)
  }
}
