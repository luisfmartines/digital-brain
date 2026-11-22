import styles from './habits.module.css'

export const heatClass = (lv: number) => (lv < 0 ? styles.lvOff : styles[`lv${lv}`])