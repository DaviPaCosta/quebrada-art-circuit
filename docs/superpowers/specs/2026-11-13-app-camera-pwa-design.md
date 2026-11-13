# Vozes do Muro — App de verdade (câmera, zoom, PWA e APK)

Data: 2026-11-13 · Status: aprovado em conversa

## Decisões

| Tema | Decisão |
| --- | --- |
| APK | PWABuilder (TWA) a partir de `https://vozesdomuro.lovable.app`; atualiza sozinho ao publicar no Lovable; sem Android Studio |
| Câmera | Publicar e "+" do story abrem câmera em tela cheia (traseira); toque = foto, segurar = vídeo (até 60 s, anel de tempo); botões ✕, ⚡ (se suportado), 🔄, 🖼️ galeria; depois cai na edição existente; carrossel até 10 |
| Permissão negada / sem câmera | Aviso com como liberar; galeria continua |
| Zoom | Página sem pinça (viewport + `touch-action`); pinça na foto/vídeo do post amplia e volta ao soltar; no visualizador aberto, zoom + arrastar |
| PWA | `manifest.webmanifest`, ícones "VM" (192, 512, maskable 512, apple-touch 180), `sw.js` com página offline e cache só de arquivos estáticos (nunca Supabase), aviso "Instalar app" (Android: botão nativo; iPhone: passo a passo) |
| Selo Lovable | Não esconder à força; barra flutuante sobe para não ser coberta; remoção oficial é opção paga do Lovable |
| Verificação Android | `public/.well-known/assetlinks.json` com a impressão digital que o PWABuilder fornecer (depois de gerar o APK) |

## Regras puras (testadas)

- `pressAction(pressMs)` → `"foto"` se < 300 ms, senão `"video"`.
- `recordProgress(elapsedMs)` → fração 0..1 de `MAX_VIDEO_SECONDS`; `shouldStopRecording(elapsedMs)` em 60 s.
- `pinchScale(startDistance, currentDistance, min=1, max=4)` → escala limitada.
- `installHint(userAgent, standalone)` → `"android" | "ios" | null`.

## Componentes

- `src/components/vm/camera/CameraCapture.tsx`: `getUserMedia`, preview, captura de foto por canvas (JPEG), vídeo por `MediaRecorder` com áudio, troca de câmera, flash via `applyConstraints({ advanced: [{ torch }] })` quando houver, galeria por `<input type=file>`. Entrega `File[]` via `onFiles`.
- `src/lib/camera.ts`: regras puras acima + `pickRecorderMime()`.
- `src/components/vm/media/PinchZoom.tsx`: envolve mídia; pinça com 2 dedos (pointer events), volta a 1 ao soltar; modo `persist` para o visualizador.
- `src/components/vm/InstallPrompt.tsx` + `src/lib/pwa.ts`: registro do service worker, captura de `beforeinstallprompt`, dica iOS; botão também em Configurações.

## Fora do escopo

Filtros/efeitos de câmera, Google Play (US$ 25), App Store.
