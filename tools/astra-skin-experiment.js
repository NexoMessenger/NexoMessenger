import * as THREE from 'three'

// Experimental only: blend re-estimated arm weights gradually with the original
// weights, rather than assigning a single bone at a hard colour threshold.
export function experimentArmWeights(root) {
  root.updateMatrixWorld(true)
  const main = root.getObjectByName('node_0')
  const image = main.material.map.image
  const canvas = document.createElement('canvas')
  canvas.width = image.width; canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  const joints = main.skeleton.bones.map(b => b.getWorldPosition(new THREE.Vector3()))
  const segment = (p, a, b) => {
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z
    const t=THREE.MathUtils.clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz),0,1)
    return [Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy,p.z-a.z-t*dz),t]
  }
  let changed = 0
  for (const mesh of [main, root.getObjectByName('Original_hand_restored')]) {
    mesh.skeleton.update()
    const geo=mesh.geometry, P=geo.attributes.position,I=geo.attributes.skinIndex,W=geo.attributes.skinWeight, U=geo.attributes.uv
    const v=new THREE.Vector3()
    for(let n=0;n<P.count;n++) {
      mesh.getVertexPosition(n,v)
      if(Math.abs(v.x)<.07 || v.y<.15 || v.y>.39) continue
      const x=THREE.MathUtils.clamp(Math.floor(U.getX(n)*canvas.width),0,canvas.width-1)
      const y=THREE.MathUtils.clamp(Math.floor(U.getY(n)*canvas.height),0,canvas.height-1)
      const j=(y*canvas.width+x)*4, lum=(pixels[j]+pixels[j+1]+pixels[j+2])/3
      const ids=v.x>0?[7,1,3]:[19,23,24]
      const [d0,t0]=segment(v,joints[ids[0]],joints[ids[1]])
      const [d1,t1]=segment(v,joints[ids[1]],joints[ids[2]])
      let factor=THREE.MathUtils.smoothstep(lum,90,210) * (1-THREE.MathUtils.smoothstep(Math.min(d0,d1),.025,.065)) * THREE.MathUtils.smoothstep(Math.abs(v.x),.07,.1)
      if(factor<.001)continue
      const weights=new Map()
      for(let k=0;k<4;k++){let index=I.getComponent(n,k),weight=W.getComponent(n,k)*(1-factor);weights.set(index,(weights.get(index)||0)+weight)}
      const add=(index,weight)=>weights.set(index,(weights.get(index)||0)+weight*factor)
      if(d0<d1){const blend=THREE.MathUtils.smoothstep(t0,.60,1);add(ids[0],1-blend);add(ids[1],blend)}
      else {const blend=THREE.MathUtils.smoothstep(t1,.60,1);add(ids[1],1-blend);add(ids[2],blend)}
      const top=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4);while(top.length<4)top.push([0,0]);const sum=top.reduce((s,v)=>s+v[1],0)||1
      I.setXYZW(n,...top.map(v=>v[0]));W.setXYZW(n,...top.map(v=>v[1]/sum));changed++
    }
    I.needsUpdate=true; W.needsUpdate=true
  }
  return changed
}

// Experimental hair/head separation, applied only to the lab copy. This relies
// on colour and position and is not safe for the production model.
export function experimentHairWeights(root) {
  root.updateMatrixWorld(true)
  const main=root.getObjectByName('node_0'), image=main.material.map.image
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0)
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data
  const p=new THREE.Vector3();let changed=0
  for(const mesh of [main,root.getObjectByName('Original_hand_restored')]) {
    mesh.skeleton.update()
    const pos=mesh.geometry.attributes.position,uv=mesh.geometry.attributes.uv,idx=mesh.geometry.attributes.skinIndex,weight=mesh.geometry.attributes.skinWeight
    for(let i=0;i<pos.count;i++) {
      mesh.getVertexPosition(i,p)
      if(p.y<.27 || p.y>.43 || Math.abs(p.x)>.23 || Math.abs(p.x)<.04)continue
      let arm=0
      for(let k=0;k<4;k++)if([1,3,5,6,7,19,20,21,23,24].includes(idx.getComponent(i,k)))arm+=weight.getComponent(i,k)
      if(arm<.01)continue
      const x=THREE.MathUtils.clamp(Math.floor(uv.getX(i)*canvas.width),0,canvas.width-1)
      const y=THREE.MathUtils.clamp(Math.floor(uv.getY(i)*canvas.height),0,canvas.height-1)
      const j=(y*canvas.width+x)*4, lum=(rgba[j]+rgba[j+1]+rgba[j+2])/3
      let amount=(1-THREE.MathUtils.smoothstep(lum,30,110))*THREE.MathUtils.smoothstep(p.y,.27,.30)
      if(amount<.001)continue
      const weights=new Map()
      for(let k=0;k<4;k++){const id=idx.getComponent(i,k),w=weight.getComponent(i,k)*(1-amount);weights.set(id,(weights.get(id)||0)+w)}
      weights.set(14,(weights.get(14)||0)+amount)
      const top=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4);while(top.length<4)top.push([0,0]);const sum=top.reduce((s,v)=>s+v[1],0)||1
      idx.setXYZW(i,...top.map(v=>v[0]));weight.setXYZW(i,...top.map(v=>v[1]/sum));changed++
    }
    idx.needsUpdate=true;weight.needsUpdate=true
  }
  return changed
}

// Topology diffusion prototype: neighbouring vertices receive similar influences.
// Kept outside production because hair and hands can be fused in the source mesh.
export function experimentSmoothWeights(root, passes = 8, region = "arms") {
  let modified=0
  for(const mesh of [root.getObjectByName('node_0'),root.getObjectByName('Original_hand_restored')]) {
    mesh.skeleton.update()
    const g=mesh.geometry, pos=g.attributes.position, indices=g.index, ids=g.attributes.skinIndex,weights=g.attributes.skinWeight, n=pos.count, bones=mesh.skeleton.bones.length
    const active=new Uint8Array(n), vector=new THREE.Vector3()
    for(let i=0;i<n;i++){mesh.getVertexPosition(i,vector);if(region === "legs" ? (vector.y>-.5 && vector.y<.03 && vector.x<-.01) : (vector.y>.16 && vector.y<.43 && Math.abs(vector.x)<.25)) active[i]=1}
    const degrees=new Uint32Array(n)
    for(let i=0;i<indices.count;i+=3){const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);if(active[a]&&active[b]){degrees[a]++;degrees[b]++}if(active[b]&&active[c]){degrees[b]++;degrees[c]++}if(active[c]&&active[a]){degrees[c]++;degrees[a]++}}
    const offsets=new Uint32Array(n+1);for(let i=0;i<n;i++)offsets[i+1]=offsets[i]+degrees[i]
    const neighbors=new Uint32Array(offsets[n]),cursor=offsets.slice(0,n)
    for(let i=0;i<indices.count;i+=3){const a=indices.getX(i),b=indices.getX(i+1),c=indices.getX(i+2);if(active[a]&&active[b]){neighbors[cursor[a]++]=b;neighbors[cursor[b]++]=a}if(active[b]&&active[c]){neighbors[cursor[b]++]=c;neighbors[cursor[c]++]=b}if(active[c]&&active[a]){neighbors[cursor[c]++]=a;neighbors[cursor[a]++]=c}}
    let values=new Float32Array(n*bones)
    for(let i=0;i<n;i++)if(active[i])for(let k=0;k<4;k++)values[i*bones+ids.getComponent(i,k)]+=weights.getComponent(i,k)
    for(let pass=0;pass<passes;pass++){
      const next=values.slice()
      for(let i=0;i<n;i++)if(active[i]&&degrees[i])for(let bone=0;bone<bones;bone++){
        let sum=0;for(let j=offsets[i];j<offsets[i+1];j++)sum+=values[neighbors[j]*bones+bone]
        next[i*bones+bone]=values[i*bones+bone]*.45+sum/degrees[i]*.55
      }
      values=next
    }
    for(let i=0;i<n;i++)if(active[i]){
      let top=[];for(let b=0;b<bones;b++)if(values[i*bones+b]>.00001)top.push([b,values[i*bones+b]])
      top.sort((a,b)=>b[1]-a[1]);top=top.slice(0,4);while(top.length<4)top.push([0,0]);const sum=top.reduce((a,b)=>a+b[1],0)||1
      ids.setXYZW(i,...top.map(v=>v[0]));weights.setXYZW(i,...top.map(v=>v[1]/sum));modified++
    }
    ids.needsUpdate=true;weights.needsUpdate=true
  }
  return modified
}
