import { describe, expect, it } from "vitest";
import { pickRecorderMime, pinchScale, pressAction, recordProgress, shouldStopRecording } from "./camera";

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
    expect(shouldStopRecording(59_999)).toBe(false);
    expect(shouldStopRecording(60_000)).toBe(true);
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
