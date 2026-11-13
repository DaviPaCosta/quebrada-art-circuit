import { describe, expect, it, vi } from "vitest";
import { outputSize } from "../video-compress";
import { extFor, pathFromUrl, uploadAll } from "./media";

describe("envio de várias mídias", () => {
  it("se uma falhar, apaga as que já subiram e avisa", async () => {
    let n = 0;
    const uploader = vi.fn(async () => {
      n++;
      if (n === 3) throw new Error("rede caiu");
      return { url: `https://x/${n}`, path: `u/${n}` };
    });
    const remover = vi.fn(async () => {});
    const items = [1, 2, 3, 4].map(() => ({ blob: new Blob(["x"]), ext: "webp" }));
    await expect(uploadAll(items, uploader, remover)).rejects.toThrow("Não conseguimos enviar sua foto/vídeo. Tente de novo.");
    expect(remover).toHaveBeenCalledWith(["u/1", "u/2"]);
    expect(uploader).toHaveBeenCalledTimes(3);
  });

  it("devolve os endereços na mesma ordem", async () => {
    let n = 0;
    const uploader = async () => {
      n++;
      return { url: `https://x/${n}`, path: `u/${n}` };
    };
    const out = await uploadAll([{ blob: new Blob(["a"]), ext: "webp" }, { blob: new Blob(["b"]), ext: "mp4" }], uploader, async () => {});
    expect(out.map((o) => o.url)).toEqual(["https://x/1", "https://x/2"]);
  });
});


describe("detalhes da mídia", () => {
  it("reduz o lado menor para 480 com medidas pares", () => {
    expect(outputSize(1080, 1920)).toEqual({ width: 480, height: 854 });
    expect(outputSize(1920, 1080)).toEqual({ width: 854, height: 480 });
    expect(outputSize(320, 240)).toEqual({ width: 320, height: 240 });
  });
  it("descobre a extensão e o caminho", () => {
    expect(extFor(new Blob([], { type: "video/webm;codecs=vp9" }))).toBe("webm");
    expect(extFor(new Blob([], { type: "" }), "mp4")).toBe("mp4");
    expect(pathFromUrl("https://a.supabase.co/storage/v1/object/public/media/u1/x.webp")).toBe("u1/x.webp");
    expect(pathFromUrl("seed:grafite")).toBeNull();
  });
});

import { postMediaPaths } from "./media";

describe("arquivos de um post", () => {
  it("lista os caminhos no bucket, ignorando exemplos do app", () => {
    const base = "https://a.supabase.co/storage/v1/object/public/media/";
    expect(
      postMediaPaths([
        { src: `${base}u1/a.mp4`, poster: `${base}u1/a.webp` },
        { src: "seed:grafite" },
      ]),
    ).toEqual(["u1/a.mp4", "u1/a.webp"]);
  });
});
