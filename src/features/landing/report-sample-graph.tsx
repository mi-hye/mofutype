import Image from "next/image";

import styles from "./report-sample-graph.module.css";

const NODES = [
  { id: "a", name: "Aさん", profile: "INFJ・うさぎ", image: "/zodiac/rabbit.png", selected: true },
  { id: "b", name: "Bさん", profile: "ENTP・うま", image: "/zodiac/horse.png", selected: true },
  { id: "c", name: "Cさん", profile: "ISFJ・ひつじ", image: "/zodiac/sheep.png", selected: false },
  { id: "d", name: "Dさん", profile: "INTJ・いぬ", image: "/zodiac/dog.png", selected: false },
] as const;

export function ReportSampleGraph() {
  return (
    <figure className={styles.graph} aria-label="AさんとBさんのサンプル">
      <svg className={styles.lines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className={styles.lineSoft} d="M17 53 L50 18 L83 47" />
        <path className={styles.lineSoft} d="M17 53 L50 83 L83 47" />
        <path className={styles.lineSoft} d="M50 18 L50 83" />
        <path className={styles.lineActiveGlow} d="M17 53 C38 34 62 66 83 47" />
        <path className={styles.lineActive} d="M17 53 C38 34 62 66 83 47" />
      </svg>

      {NODES.map((node) => (
        <div
          className={styles.node}
          data-node={node.id}
          data-selected={node.selected ? "true" : "false"}
          key={node.id}
        >
          <span className={styles.avatar}>
            <Image src={node.image} alt="" width={88} height={88} />
          </span>
          <strong>{node.name}</strong>
          <small>{node.profile}</small>
        </div>
      ))}

      <span className={styles.pairBadge}>A × B</span>
      <figcaption className={styles.caption}>SELECTED RELATION</figcaption>
    </figure>
  );
}
