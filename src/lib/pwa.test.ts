import { describe, expect, it } from "vitest";
import { installHint } from "./pwa";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("dica de instalar o app", () => {
  it("Android usa o botão do próprio navegador", () => {
    expect(installHint(ANDROID, false)).toBe("android");
  });
  it("iPhone mostra o passo a passo", () => {
    expect(installHint(IPHONE, false)).toBe("ios");
  });
  it("já instalado (aberto pelo ícone) não mostra nada", () => {
    expect(installHint(ANDROID, true)).toBeNull();
    expect(installHint(IPHONE, true)).toBeNull();
  });
  it("computador não mostra a dica", () => {
    expect(installHint(DESKTOP, false)).toBeNull();
  });
});

import { downloadOffer } from "./pwa";

describe("botão Baixar app", () => {
  it("Android baixa o APK quando ele existe", () => {
    expect(downloadOffer("android", "/app/vozes-do-muro.apk", false)).toBe("apk");
  });
  it("Android sem APK usa o instalar do navegador, ou ensina pelo menu", () => {
    expect(downloadOffer("android", null, true)).toBe("instalar");
    expect(downloadOffer("android", null, false)).toBe("menu");
  });
  it("iPhone mostra o passo a passo", () => {
    expect(downloadOffer("ios", "/app/vozes-do-muro.apk", false)).toBe("ios");
  });
  it("dentro do app ou no computador não aparece", () => {
    expect(downloadOffer(null, "/app/vozes-do-muro.apk", true)).toBeNull();
  });
});
