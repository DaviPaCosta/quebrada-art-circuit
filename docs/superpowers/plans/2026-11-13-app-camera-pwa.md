# App de verdade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Câmera estilo Instagram ao publicar/story, zoom só nas fotos, app instalável (PWA) e APK pelo PWABuilder.

**Architecture:** Regras puras em `src/lib/camera.ts` e `src/lib/pwa.ts` (testadas); componentes de navegador (`CameraCapture`, `PinchZoom`, `InstallPrompt`) verificados no celular. Arquivos estáticos do PWA em `public/`.

**Tech Stack:** React 19, TanStack Start, getUserMedia/MediaRecorder, Pointer Events, Service Worker, Web App Manifest.

**Spec:** `docs/superpowers/specs/2026-11-13-app-camera-pwa-design.md`

## Global Constraints
- Foto < 300 ms de toque; vídeo até `MAX_VIDEO_SECONDS` (60).
- Pinça: escala 1..4.
- Service worker nunca guarda respostas de `*.supabase.co` nem de `/storage/`.
- Textos em português.

## Review Focus
1. Permissão de câmera negada ou sem câmera → aviso + galeria funcionando. (manual)
2. Soltar o dedo antes de 300 ms após começar a gravar → vira foto, sem vídeo vazio. Teste Task 1 (`pressAction`).
3. Gravação passa de 60 s → para sozinha. Teste Task 1 (`shouldStopRecording`).
4. Atualização do app publicada → SW novo assume sem prender versão velha (network-first na navegação). (manual)
5. iPhone em modo app (standalone) → não mostrar dica de instalar. Teste Task 4 (`installHint`).

---

### Task 1: Regras puras da câmera e do zoom
**Files:** Create `src/lib/camera.ts`, Test `src/lib/camera.test.ts`
**Produces:** `PHOTO_PRESS_MS = 300`, `pressAction(ms)`, `recordProgress(ms)`, `shouldStopRecording(ms)`, `pinchScale(start, current, min?, max?)`, `pickRecorderMime(isSupported)`.
- [ ] Testes que falham → implementar → suite verde → commit `feat: regras da câmera e do zoom`.

### Task 2: CameraCapture no publicar e no story
**Files:** Create `src/components/vm/camera/CameraCapture.tsx`; Modify `src/routes/_rede.publicar.tsx` (passo "selecionar" abre câmera; galeria lateral), `src/components/vm/stories/StoryBar.tsx` ("+" abre câmera em modo único).
- [ ] Implementar → tsc + build → commit `feat: câmera estilo Instagram ao publicar e no story`.

### Task 3: Zoom só nas fotos
**Files:** Create `src/components/vm/media/PinchZoom.tsx`; Modify `src/routes/__root.tsx` (viewport `maximum-scale=1, user-scalable=no, viewport-fit=cover`), `src/styles.css` (`touch-action: pan-x pan-y` no body; `touch-action: none` dentro do PinchZoom), `src/components/vm/PostCard.tsx` e `MediaViewer.tsx` (envolver mídia); bloquear `gesturestart` do iOS fora do PinchZoom.
- [ ] Implementar → tsc + build → commit `feat: zoom de pinça só nas fotos`.

### Task 4: PWA
**Files:** Create `public/manifest.webmanifest`, `public/icons/*.png` (gerados de `public/icons/icon.svg`), `public/sw.js`, `public/offline.html`, `src/lib/pwa.ts` (+ test), `src/components/vm/InstallPrompt.tsx`; Modify `__root.tsx` (manifest, apple-touch-icon, apple meta), `AppShell.tsx` (barra sobe), `_rede.configuracoes.tsx` (botão instalar), `_rede.feed.tsx` (aviso).
**Produces:** `installHint(ua, standalone)`, `registerServiceWorker()`, `useInstallPrompt()`.
- [ ] Teste `installHint` falha → implementar → suite + build → commit `feat: app instalável (PWA)`.

### Task 5: Revisão final, publicar e APK (com o dono)
- [ ] Revisor independente; corrigir importantes.
- [ ] Pedir "pode enviar" → push → dono publica no Lovable.
- [ ] Dono gera APK no PWABuilder (package `app.lovable.vozesdomuro`); copiar SHA-256 → `public/.well-known/assetlinks.json` → push/publicar → testar APK sem barra de endereço.
