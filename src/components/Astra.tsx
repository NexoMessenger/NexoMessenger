import astraImage from '../assets/bot/astra-original.png'

/** The supplied image is used unchanged; animation moves the whole image. */
export default function Astra({ greeting = false }: { greeting?: boolean }) {
  return <img className={`astra-figure${greeting ? ' astra-figure-greeting' : ''}`} src={astraImage} alt="Astra" />
}
