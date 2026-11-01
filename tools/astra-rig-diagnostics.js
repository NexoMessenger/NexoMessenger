import * as THREE from 'three'

// Standalone laboratory helper. Stretch measurements are only a warning;
// appearance and movement still have to be inspected frame by frame.
export function sampleMesh(mesh) {
  let root = mesh
  while (root.parent) root = root.parent
  root.updateMatrixWorld(true)
  mesh.skeleton.update()
  const count = mesh.geometry.attributes.position.count
  const positions = new Float32Array(count * 3)
  const v = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    mesh.getVertexPosition(i, v)
    positions[i*3] = v.x; positions[i*3+1] = v.y; positions[i*3+2] = v.z
  }
  return positions
}

export function countStretchedEdges(mesh, baseline, posed, minimumLength = 0.001) {
  if (baseline.length !== posed.length) throw new Error('Incompatible pose samples')
  const indices = mesh.geometry.index
  if (!indices) throw new Error('Expected indexed mesh')
  const distance = (p, a, b) => Math.hypot(p[a*3]-p[b*3], p[a*3+1]-p[b*3+1], p[a*3+2]-p[b*3+2])
  let considered=0, over2=0, over3=0, over5=0
  for (let i=0;i<indices.count;i+=3) {
    const triangle = [indices.getX(i), indices.getX(i+1), indices.getX(i+2)]
    for(let k=0;k<3;k++) {
      const a=triangle[k], b=triangle[(k+1)%3], length=distance(baseline,a,b)
      if(length<minimumLength) continue
      const ratio=distance(posed,a,b)/length
      considered++; if(ratio>2)over2++; if(ratio>3)over3++; if(ratio>5)over5++
    }
  }
  return { considered, over2, over3, over5 }
}
