import { StyleSheet, Text, View } from "react-native";

/**
 * Architecture diagram showing the cloud path vs on-device path.
 * Renders as a styled component rather than an image so it looks
 * crisp at any screen size on both web and native.
 *
 * Per `docs/privacy-posture.md` and `docs/edge-ai-qvac.md` §12 #6,
 * this diagram must be visible on the public marketing site.
 */
export function ArchitectureDiagram() {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>How your data travels</Text>

      {/* Cloud Path */}
      <View style={styles.pathCard}>
        <View style={styles.pathHeader}>
          <View style={[styles.dot, styles.cloudDot]} />
          <Text style={styles.pathTitle}>Cloud path (the old way)</Text>
        </View>
        <View style={styles.flowRow}>
          <Node icon="📱" label="Your phone" />
          <Arrow />
          <Node icon="☁️" label="3rd-party LLM" />
          <Arrow />
          <Node icon="🎙" label="3rd-party voice" />
        </View>
        <View style={styles.dangerRow}>
          <Text style={styles.dangerText}>
            Your onboarding answers, check-ins, and transmissions leave your device on
            every single ritual.
          </Text>
        </View>
      </View>

      {/* On-Device Path */}
      <View style={[styles.pathCard, styles.localCard]}>
        <View style={styles.pathHeader}>
          <View style={[styles.dot, styles.localDot]} />
          <Text style={styles.pathTitle}>On-device path (Future Selves, now)</Text>
        </View>
        <View style={styles.flowRow}>
          <Node icon="📱" label="Your phone" />
          <Arrow />
          <View style={styles.localStack}>
            <LocalNode icon="🧠" label="Local LLM" sub="QVAC ~0.7 GB" />
            <LocalNode icon="🎙" label="Local TTS" sub="Chatterbox / ONNX" />
            <LocalNode icon="🎤" label="Local STT" sub="Parakeet / Whisper" />
          </View>
        </View>
        <View style={styles.safeRow}>
          <Text style={styles.safeText}>
            No bytes leave the device. The app works with Wi-Fi and cellular fully
            disabled.
          </Text>
        </View>
      </View>
    </View>
  );
}

function Node({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.node}>
      <Text style={styles.nodeIcon}>{icon}</Text>
      <Text style={styles.nodeLabel}>{label}</Text>
    </View>
  );
}

function LocalNode({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <View style={styles.localNode}>
      <Text style={styles.nodeIcon}>{icon}</Text>
      <View style={styles.localNodeBody}>
        <Text style={styles.nodeLabel}>{label}</Text>
        <Text style={styles.nodeSub}>{sub}</Text>
      </View>
    </View>
  );
}

function Arrow() {
  return <Text style={styles.arrow}>→</Text>;
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    padding: 4,
    width: "100%",
    maxWidth: 600,
  },
  sectionLabel: {
    color: "#AEB6D4",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  pathCard: {
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,100,100,0.15)",
  },
  localCard: {
    borderColor: "rgba(74,222,128,0.2)",
    backgroundColor: "rgba(74,222,128,0.04)",
  },
  pathHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cloudDot: {
    backgroundColor: "#FF6B6B",
  },
  localDot: {
    backgroundColor: "#4ADE80",
  },
  pathTitle: {
    color: "#F8F0DE",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  flowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  node: {
    alignItems: "center",
    gap: 4,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    minWidth: 90,
  },
  nodeIcon: {
    fontSize: 22,
  },
  nodeLabel: {
    color: "#C8D4E8",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  localStack: {
    gap: 4,
  },
  localNode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: "rgba(74,222,128,0.08)",
  },
  localNodeBody: {
    gap: 1,
  },
  nodeSub: {
    color: "#7E86A6",
    fontSize: 9,
    fontWeight: "600",
  },
  arrow: {
    color: "#5A6180",
    fontSize: 18,
  },
  dangerRow: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,100,100,0.08)",
  },
  dangerText: {
    color: "#FF9A9A",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  safeRow: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(74,222,128,0.08)",
  },
  safeText: {
    color: "#6EE7B7",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
