import { StyleSheet, Platform } from "react-native";

// const { width } = Dimensions.get("window");

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#F8F0DE",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#AEB6D4",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 24,
  },
  inputContainer: {
    gap: 16,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 20,
    color: "#F8F0DE",
    fontSize: 18,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  button: {
    borderRadius: 16,
    overflow: "hidden",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  gradient: {
    padding: 18,
    alignItems: "center",
  },
  buttonText: {
    color: "#080A17",
    fontSize: 18,
    fontWeight: "700",
  },
  loadingContainer: {
    alignItems: "center",
    gap: 24,
  },
  stepText: {
    color: "#F8F0DE",
    fontSize: 18,
    fontWeight: "600",
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F7D38B",
  },
  resultCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 24,
    padding: 24,
    gap: 20,
    marginTop: 20,
  },
  emotionalCore: {
    fontSize: 20,
    fontWeight: "700",
    color: "#F7D38B",
    fontStyle: "italic",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  transcript: {
    fontSize: 22,
    lineHeight: 32,
    color: "#F8F0DE",
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
  },
  mediaPlaceholder: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  mediaText: {
    color: "#666",
    fontSize: 14,
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  critiqueBox: {
    backgroundColor: "rgba(247, 211, 139, 0.05)",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#F7D38B",
  },
  critiqueTitle: {
    color: "#F7D38B",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  critiqueText: {
    color: "#AEB6D4",
    fontSize: 15,
    lineHeight: 22,
  },
  shareButton: {
    backgroundColor: "#F8F0DE",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  shareButtonText: {
    color: "#080A17",
    fontSize: 18,
    fontWeight: "700",
  },
  resetButton: {
    padding: 12,
    alignItems: "center",
  },
  resetButtonText: {
    color: "#666",
    fontSize: 16,
  },
  errorText: {
    color: "#FF9A9A",
    textAlign: "center",
    marginTop: 20,
  },
});
