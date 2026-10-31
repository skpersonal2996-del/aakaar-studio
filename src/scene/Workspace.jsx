import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { DESK, ROOM } from './views'
import { jute, laptopScreen, phoneScreen } from './textures'
import { Box, Cyl, Glow, Limb, Soft } from './parts'
import { Clickable } from './Interactive'
import { SmallPlant } from './Plants'
import { Designer, Developer } from './Team'
import { SurfaceMaterial } from './SurfaceMaterial'

const TOP = 0.765 // desk surface height
const SEAT = 1.6 // distance of each person from the desk centre

function Desk() {
  const steel = { color: '#141312', metalness: 0.6, roughness: 0.35 }
  return (
    <group>
      <Soft args={[2.7, 0.055, 1.35]} radius={0.012} position={[0, 0.74, 0]}><SurfaceMaterial kind="oak" repeat={[1,2]} rotation={Math.PI/2} normalStrength={.16} roughness={.7} clearcoat={.2} /></Soft>
      {[-0.82, 0.82].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {[-0.52, 0.52].map((z) => (
            <Box key={z} args={[0.05, 0.71, 0.05]} position={[0, 0.355, z]} {...steel} />
          ))}
          <Box args={[0.05, 0.05, 1.1]} position={[0, 0.69, 0]} {...steel} />
          <Box args={[0.07, 0.04, 1.15]} position={[0, 0.02, 0]} {...steel} />
        </group>
      ))}
      <Box args={[1.64, 0.05, 0.05]} position={[0, 0.69, 0]} {...steel} />
    </group>
  )
}

function Chair(props) {
  const mesh = '#1d1d1f'
  return (
    <group {...props}>
      <Soft args={[0.5, 0.08, 0.48]} radius={0.035} position={[0, 0.45, 0.02]}><SurfaceMaterial kind="leather" color="#4d4844" repeat={[2,2]} normalStrength={.18} roughness={.9} /></Soft>
      <Soft args={[0.46, 0.6, 0.06]} radius={0.03} position={[0, 0.86, -0.25]} rotation-x={-0.12}><SurfaceMaterial kind="leather" color="#4d4844" repeat={[2,2]} normalStrength={.18} roughness={.9} /></Soft>
      <group position={[0, .86, -.214]} rotation-x={-.12}>
        <UpholsterySeam width={.40} height={.53} />
      </group>
      <group position={[0, .491, .02]} rotation-x={-Math.PI/2}>
        <UpholsterySeam width={.44} height={.40} />
      </group>
      <Cyl args={[0.028, 0.028, 0.32]} position={[0, 0.25, 0]} color="#2b2b2b" metalness={0.8} roughness={0.3} />
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation-y={(i / 5) * Math.PI * 2}>
          <Box args={[0.04, 0.035, 0.32]} position={[0, 0.08, 0.16]} color="#202020" metalness={0.5} />
          <mesh position={[0, 0.03, 0.31]}>
            <sphereGeometry args={[0.03, 10, 8]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        </group>
      ))}
      {[-0.27, 0.27].map((x) => (
        <group key={x}>
          <Box args={[0.03, 0.22, 0.03]} position={[x, 0.58, -0.05]} color="#202020" />
          <Soft args={[0.06, 0.03, 0.26]} radius={0.012} position={[x, 0.7, 0.0]} color="#202020" />
        </group>
      ))}
    </group>
  )
}

function UpholsterySeam({width, height}) {
  const geometry = useMemo(() => {
    const points = [], radius = .025
    for (const [x,y,start] of [[width/2-radius,height/2-radius,0],[-width/2+radius,height/2-radius,Math.PI/2],[-width/2+radius,-height/2+radius,Math.PI],[width/2-radius,-height/2+radius,Math.PI*1.5]]) {
      for (let i=0;i<=4;i++) {
        const angle=start+i*Math.PI/8
        points.push(new THREE.Vector3(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius,0))
      }
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,true),64,.0011,4,true)
  }, [width,height])
  return <mesh geometry={geometry}><meshStandardMaterial color="#62584e" roughness={.95} /></mesh>
}

function Keyboard() {
  const ref = useRef()
  const keys = useMemo(() => {
    const result=[]
    for(let row=0;row<4;row++) for(let col=0;col<11;col++) result.push([(col-5)*.024,-.069+row*.022,1])
    for(const [x,scale] of [[-.115,1],[-.084,1],[0,5],[.084,1],[.115,1]]) result.push([x,.022,scale])
    return result
  },[])
  useLayoutEffect(() => {
    const matrix=new THREE.Matrix4(), rotation=new THREE.Quaternion()
    keys.forEach(([x,z,width],i) => {
      matrix.compose(new THREE.Vector3(x,.019,z),rotation,new THREE.Vector3(width,1,1))
      ref.current.setMatrixAt(i,matrix)
    })
    ref.current.instanceMatrix.needsUpdate=true
  },[keys])
  return <instancedMesh ref={ref} args={[null,null,keys.length]}>
    <boxGeometry args={[.019,.002,.015]} />
    <meshStandardMaterial color="#202329" roughness={.68} />
  </instancedMesh>
}

function Laptop({ variant, ...props }) {
  const screen = useMemo(() => laptopScreen(variant), [variant])
  const alu = { color: '#c3c6cc', metalness: 0.8, roughness: 0.28 }
  return (
    <group {...props}>
      <Soft args={[0.34, 0.016, 0.235]} radius={0.006} position={[0, 0.008, 0]} {...alu} />
      <Box args={[0.28, 0.002, 0.1]} position={[0, 0.017, -0.035]} color="#2a2b2e" />
      <Keyboard />
      <Soft args={[.11,.0015,.062]} radius={.003} position={[0,.0177,.066]} color="#7b8088" metalness={.7} roughness={.38} />
      <Cyl args={[.005,.005,.31,16]} position={[0,.016,-.111]} rotation-z={Math.PI/2} {...alu} />
      <group position={[0, 0.016, -0.115]} rotation-x={-0.32}>
        <Soft args={[0.34, 0.225, 0.008]} radius={0.004} position={[0, 0.112, 0]} {...alu} />
        <mesh position={[0, 0.114, 0.0045]} userData={{ noShadow: true }}>
          <planeGeometry args={[0.315, 0.2]} />
          <meshBasicMaterial map={screen} color={[1.3, 1.3, 1.3]} toneMapped={false} />
        </mesh>
        {/* glowing logo on the lid */}
        <mesh position={[0, 0.12, -0.0045]} rotation-y={Math.PI} userData={{ noShadow: true }}>
          <circleGeometry args={[0.014, 16]} />
          <meshBasicMaterial color={[2.5, 2.5, 2.5]} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

function Mug({ color, ...props }) {
  return (
    <group {...props}>
      <mesh position={[0,.05,0]}>
        <cylinderGeometry args={[.042,.038,.1,32,1,true]} />
        <meshStandardMaterial color={color} roughness={.32} side={THREE.DoubleSide} />
      </mesh>
      <Cyl args={[.038,.038,.006,24]} position={[0,.003,0]} color={color} roughness={.35} />
      <mesh position={[0,.1,0]} rotation-x={Math.PI/2}>
        <torusGeometry args={[.039,.0035,8,32]} /><meshStandardMaterial color={color} roughness={.32} />
      </mesh>
      <mesh position={[0,.087,0]} rotation-x={-Math.PI/2}>
        <circleGeometry args={[.035,32]} /><meshPhysicalMaterial color="#29150c" roughness={.24} clearcoat={.5} />
      </mesh>
      <mesh position={[0.045, 0.05, 0]}>
        <torusGeometry args={[0.025, 0.008, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
    </group>
  )
}

function Bottle(props) {
  return (
    <group {...props}>
      <Cyl args={[0.035, 0.035, 0.2, 20]} position={[0, 0.1, 0]} color="#e9e6e0" roughness={0.3} metalness={0.3} />
      <Cyl args={[0.025, 0.03, 0.04, 16]} position={[0, 0.22, 0]} color="#1a1a1a" roughness={0.5} />
    </group>
  )
}

function Phone(props) {
  const tex = useMemo(() => phoneScreen(), [])
  return (
    <Clickable id="contact" {...props}>
      <Soft args={[0.08, 0.01, 0.16]} radius={0.004} position={[0, 0.005, 0]} color="#1a1a1c" metalness={0.5} roughness={0.3} />
      <mesh position={[0, 0.0105, 0]} rotation-x={-Math.PI / 2} userData={{ noShadow: true }}>
        <planeGeometry args={[0.072, 0.15]} />
        <meshBasicMaterial map={tex} color={[1.2, 1.2, 1.2]} toneMapped={false} />
      </mesh>
    </Clickable>
  )
}

// Black drum pendants over the desk, glowing from underneath.
function Pendants() {
  const drops = [
    // kept left of centre so they never cover the sign from the main view
    [-1.05, 2.12],
    [-0.4, 2.0],
    [0.25, 2.12],
  ]
  return (
    <group position={[DESK[0], 0, DESK[2]]}>
      {drops.map(([x, y], i) => (
        <group key={i} position={[x, 0, 0]}>
          <Cyl args={[0.004, 0.004, ROOM.H - y]} position={[0, (ROOM.H + y) / 2, 0]} color="#111" roughness={1} />
          <Cyl args={[0.02, 0.02, 0.05]} position={[0, y + 0.02, 0]} color="#151515" metalness={0.5} />
          {/* matte black drum shade, glowing from below */}
          <mesh position={[0, y - 0.09, 0]}>
            <cylinderGeometry args={[0.1, 0.11, 0.17, 36, 1, true]} />
            <meshStandardMaterial color="#141414" roughness={0.55} metalness={0.2} side={THREE.DoubleSide} />
          </mesh>
          <Cyl args={[0.1, 0.1, 0.01, 36]} position={[0, y - 0.005, 0]} color="#141414" roughness={0.55} />
          <mesh position={[0, y - 0.17, 0]} rotation-x={Math.PI / 2} userData={{ noShadow: true }}>
            <circleGeometry args={[0.105, 36]} />
            <meshBasicMaterial color={[5, 3, 1.5]} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      <pointLight position={[-0.4, 1.7, 0]} intensity={4} distance={4} decay={2} color="#ffb067" />
    </group>
  )
}

export function Workspace() {
  const rug = useMemo(() => jute('desk', '#7d6851'), [])
  return (
    <group>
      <mesh position={[DESK[0], 0.013, DESK[2]]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[5.2, 3.0]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <group position={DESK}>
        <Desk />
        <Chair position={[-SEAT - 0.03, 0, 0.15]} rotation-y={Math.PI / 2} />
        <Developer position={[-SEAT, 0, 0.15]} rotation-y={Math.PI / 2} />
        <Chair position={[SEAT + 0.03, 0, -0.12]} rotation-y={-Math.PI / 2} />
        <Designer position={[SEAT, 0, -0.12]} rotation-y={-Math.PI / 2} />

        {/* Vinay's laptop opens Services, Shruti's opens Projects */}
        <Clickable id="services">
          <Laptop variant="design" position={[-1.08, TOP, 0.15]} rotation-y={-Math.PI / 2} />
        </Clickable>
        <Clickable id="projects">
          <Laptop variant="projects" position={[1.08, TOP, -0.12]} rotation-y={Math.PI / 2} />
        </Clickable>

        <SmallPlant position={[0, TOP, -0.05]} seed={17} scale={2.6} />
        <Mug color="#1c1c1e" position={[-0.72, TOP, 0.5]} />
        <Mug color="#f1ece4" position={[0.7, TOP, 0.32]} rotation-y={2} />
        <Bottle position={[0.35, TOP, -0.45]} />
        <Bottle position={[0.48, TOP, -0.38]} scale={0.85} />
        <Phone position={[-0.3, TOP, 0.42]} rotation-y={0.35} />
        {/* books, notebook, pen cup */}
        <Box args={[0.26, 0.04, 0.19]} position={[-0.42, TOP + 0.02, -0.35]} rotation-y={0.15} color="#e4d9c6" />
        <Box args={[0.24, 0.035, 0.18]} position={[-0.42, TOP + 0.058, -0.35]} rotation-y={-0.05} color="#7d2a1d" />
        <Box args={[0.22, 0.03, 0.17]} position={[-0.42, TOP + 0.09, -0.35]} rotation-y={0.08} color="#2f3a2c" />
        <Box args={[0.21, 0.014, 0.29]} position={[0.55, TOP + 0.007, 0.48]} rotation-y={-0.3} color="#c9a46a" roughness={0.8} />
        <group position={[0.22, TOP, 0.25]}>
          <Cyl args={[0.035, 0.035, 0.1, 18]} position={[0, 0.05, 0]} color="#1b1b1b" roughness={0.5} />
          {[-0.4, 0, 0.4].map((r) => (
            <Cyl key={r} args={[0.004, 0.004, 0.15]} position={[r * 0.02, 0.12, 0]} rotation-z={r * 0.3} color={r ? '#f0b429' : '#c4471f'} />
          ))}
        </group>
      </group>
      <Pendants />
    </group>
  )
}
