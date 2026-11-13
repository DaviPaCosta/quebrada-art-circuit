import { describe, expect, it } from "vitest";
import { clipTooShort, pickRecorderMime, pinchScale, pressAction, recordProgress, shouldStopRecording } from "./camera";

describe("botão da câmera", () => {
  it("toque rápido é foto, segurar é vídeo", () => {
    expect(pressAction(120)).toBe("foto");
    expect(pressAction(299)).toBe("foto");
    expect(pressAction(300)).toBe("video");
    expect(pressAction(5000)).toBe("video");
  });
  it("anel mostra o tempo até 60 segundos e para sozinho", () => {
    expect(recordProgress(0)).toBe(0);
    expect(recordProgress(30_000)).toBe(0.5);
    expect(recordProgress(90_000)).toBe(1);
    // Para um pouco antes de 60 s para o arquivo nunca passar do limite.
    expect(shouldStopRecording(59_400)).toBe(false);
    expect(shouldStopRecording(59_500)).toBe(true);
  });
  it("gravação curtíssima não vira vídeo", () => {
    expect(clipTooShort(400)).toBe(true);
    expect(clipTooShort(999)).toBe(true);
    expect(clipTooShort(1000)).toBe(false);
  });
  it("escolhe o formato de gravação suportado", () => {
    expect(pickRecorderMime((t) => t === "video/webm")).toBe("video/webm");
    expect(pickRecorderMime((t) => t.startsWith("video/mp4"))).toMatch(/^video\/mp4/);
    expect(pickRecorderMime(() => false)).toBeUndefined();
  });
});

describe("pinça nas fotos", () => {
  it("amplia conforme os dedos abrem, entre 1x e 4x", () => {
    expect(pinchScale(100, 200)).toBe(2);
    expect(pinchScale(100, 50)).toBe(1);
    expect(pinchScale(100, 900)).toBe(4);
    expect(pinchScale(0, 100)).toBe(1);
  });
});
