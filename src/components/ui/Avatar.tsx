import styles from './Avatar.module.css'

interface Props {
  url?: string | null
  name?: string | null
  size?: number
  ring?: boolean
}

export default function Avatar({ url, name, size = 36, ring }: Props) {
  const initial = (name?.trim()[0] ?? '?').toUpperCase()
  return (
    <span
      className={`${styles.avatar} ${ring ? styles.ring : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {url ? <img src={url} alt="" /> : initial}
    </span>
  )
}