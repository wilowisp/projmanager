# 📋 Project Manager

**서버 없이 GitHub Pages에서 동작하는 프로젝트 관리 앱**

간트 차트 · MS Project형 태스크 의존관계 · 인라인 편집 · 프로젝트별 독립 URL

---

## 특징

- **서버 불필요** — GitHub Pages 정적 호스팅 + GitHub API로 데이터 저장
- **간트 차트** — SVG 기반, 드래그로 날짜 조정 및 기간 변경
- **태스크 의존관계** — FS / SS / FF / SF + lag 지원 (MS Project 동일 형식)
- **크리티컬 패스** — CPM 자동 계산, 빨간 강조 표시
- **인라인 편집** — 더블클릭으로 모든 셀 즉시 편집
- **프로젝트 분리** — `projects/폴더명/` 으로 완전히 독립된 URL과 데이터

## 빠른 시작

```bash
npm install
npm run dev
# → http://localhost:5173/  (런처)
# → http://localhost:5173/projects/demo/  (데모 프로젝트)
```

## GitHub 배포

```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
# → GitHub Actions가 자동으로 gh-pages에 배포
```

**GitHub Pages 활성화:** Settings → Pages → Source: `gh-pages` 브랜치

## 새 프로젝트 추가

```bash
npm run new-project "2026 연간 업무계획"
git add projects/2026-연간-업무계획 && git commit -m "Add project" && git push
# → https://USERNAME.github.io/REPO/projects/2026-연간-업무계획/
```

## 데이터를 GitHub Pages에 저장하려면

앱 내 **⚙ Settings** → GitHub 사용자명 / 저장소명 / PAT 입력 → Save & Sync

이후 편집 시 자동으로 `gh-pages` 브랜치의 `data.json`에 저장됩니다.

---

📖 **상세 설치 가이드:** [docs/setup-guide.md](docs/setup-guide.md)
