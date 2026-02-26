# Project Manager — GitHub Pages 설치 및 사용 가이드

> **서버 없이 동작합니다.** GitHub Pages가 앱을 서빙하고, GitHub API가 데이터를 저장합니다.

---

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [로컬 환경 준비](#2-로컬-환경-준비)
3. [GitHub 저장소 생성 및 초기 배포](#3-github-저장소-생성-및-초기-배포)
4. [GitHub Pages 활성화](#4-github-pages-활성화)
5. [데이터 저장을 위한 PAT 설정](#5-데이터-저장을-위한-pat-설정)
6. [새 프로젝트 추가하기](#6-새-프로젝트-추가하기)
7. [앱 사용법](#7-앱-사용법)
8. [데이터 동작 방식](#8-데이터-동작-방식)
9. [문제 해결](#9-문제-해결)

---

## 1. 사전 요구사항

| 항목 | 버전 | 확인 방법 |
|------|------|-----------|
| Node.js | 18 이상 | `node --version` |
| npm | 9 이상 | `npm --version` |
| Git | 2.x | `git --version` |
| GitHub 계정 | — | [github.com](https://github.com) |

---

## 2. 로컬 환경 준비

```bash
# 1. 이 폴더에서 의존성 설치
npm install

# 2. 로컬 개발 서버 시작 (브라우저에서 확인)
npm run dev
```

브라우저에서 아래 주소로 접속:
- **런처 (전체 프로젝트 목록):** `http://localhost:5173/`
- **데모 프로젝트:** `http://localhost:5173/projects/demo/`

> 로컬에서는 데이터가 브라우저 localStorage에 저장됩니다.
> GitHub에 배포 후 PAT를 설정하면 GitHub Pages에 자동 저장됩니다.

---

## 3. GitHub 저장소 생성 및 초기 배포

### 3-1. GitHub에서 저장소 만들기

1. [github.com/new](https://github.com/new) 접속
2. 아래와 같이 설정:

   | 항목 | 값 |
   |------|----|
   | Repository name | `projmanager` (원하는 이름) |
   | Visibility | **Public** ← GitHub Pages 무료 사용 조건 |
   | Initialize with README | 체크 해제 |

3. **Create repository** 클릭

### 3-2. 로컬 저장소와 연결

```bash
# 현재 폴더를 git 저장소로 초기화
git init
git add .
git commit -m "Initial commit: Project Manager app"

# GitHub 저장소와 연결 (YOUR_USERNAME, YOUR_REPO_NAME 을 실제 값으로 교체)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# main 브랜치로 push
git branch -M main
git push -u origin main
```

### 3-3. 자동 배포 확인

push 완료 후 GitHub Actions가 자동으로 실행됩니다.

1. GitHub 저장소 페이지 → **Actions** 탭
2. `Deploy to GitHub Pages` 워크플로가 실행 중이면 정상
3. 초록색 체크 ✓ 가 뜨면 배포 완료 (약 1~2분 소요)

```
main 브랜치 push
    ↓
GitHub Actions 실행
    ↓  (npm install + npm run build)
gh-pages 브랜치에 dist/ 내용 배포
    ↓
GitHub Pages 서빙 시작
```

---

## 4. GitHub Pages 활성화

> Actions가 처음 실행되면 `gh-pages` 브랜치가 자동으로 생성됩니다.
> 단, Pages 소스를 명시적으로 지정해야 합니다.

1. GitHub 저장소 → **Settings** 탭
2. 좌측 메뉴 → **Pages**
3. **Source** 섹션에서:
   - Branch: `gh-pages`
   - Folder: `/ (root)`
4. **Save** 클릭

잠시 후 아래 주소에서 앱이 열립니다:

```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

> **예시:** 사용자명이 `alice`, 저장소명이 `projmanager`라면
> → `https://alice.github.io/projmanager/`

---

## 5. 데이터 저장을 위한 PAT 설정

GitHub Pages는 **읽기 전용 정적 호스팅**이므로, 앱이 데이터를 저장할 때는
**GitHub Personal Access Token (PAT)** 으로 GitHub API를 호출합니다.
PAT는 브라우저 localStorage에만 저장되고 **코드에 커밋되지 않습니다.**

### 5-1. PAT 발급

1. GitHub → 우상단 프로필 아이콘 → **Settings**
2. 좌측 하단 → **Developer settings**
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**

   | 설정 항목 | 값 |
   |-----------|----|
   | Token name | `projmanager-data` |
   | Expiration | 원하는 기간 (1년 권장) |
   | Repository access | **Only select repositories** → 위에서 만든 저장소 선택 |
   | Permissions → Contents | **Read and write** |

4. **Generate token** → 토큰을 복사해 안전한 곳에 임시 보관

> Classic token을 사용하는 경우: **repo** 스코프만 체크

### 5-2. 앱에서 PAT 등록

1. 배포된 주소 접속 (또는 `http://localhost:5173/projects/demo/`)
2. 우상단 **⚙** 버튼 (Settings) 클릭
3. 아래 내용 입력:

   | 입력 항목 | 값 |
   |-----------|----|
   | Owner | GitHub 사용자명 (예: `alice`) |
   | Repository name | 저장소명 (예: `projmanager`) |
   | Branch | `gh-pages` |
   | Base path | 저장소명과 동일 (예: `projmanager`) |
   | GitHub PAT | 위에서 복사한 토큰 |

4. **Test connection** → `✓ Connected successfully` 확인
5. **Save & Sync** 클릭

이후부터 태스크를 편집하면 **자동으로 GitHub Pages에 저장**됩니다.

---

## 6. 새 프로젝트 추가하기

프로젝트마다 독립된 URL과 데이터 파일을 갖습니다.

### 6-1. 프로젝트 폴더 생성

```bash
npm run new-project "2026 연간 업무계획"
```

실행 결과:
```
✅ Project "2026 연간 업무계획" created!

   Folder : projects/2026-연간-업무계획/
   Dev URL: http://localhost:5173/projects/2026-연간-업무계획/

Next steps:
   1. npm run dev  — view at http://localhost:5173/projects/2026-연간-업무계획/
   2. git add projects/2026-연간-업무계획 && git commit -m "Add project: 2026 연간 업무계획"
   3. git push  — GitHub Actions deploys automatically
```

### 6-2. GitHub에 배포

```bash
git add projects/2026-연간-업무계획
git commit -m "Add project: 2026 연간 업무계획"
git push
```

push 후 약 60초 뒤 아래 주소에서 접속 가능:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/projects/2026-연간-업무계획/
```

### 6-3. 새 프로젝트에서 PAT 재설정

PAT 설정은 프로젝트마다 한 번씩 필요합니다.
Settings → 동일한 owner/repo/PAT 입력 → Save & Sync

> **팁:** 브라우저가 같다면 이전 설정이 남아있어 Settings를 열면 자동 입력됩니다.

---

## 7. 앱 사용법

### 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 프로젝트명  │  ＋Task  ◇Mile │  Day Week Month Quarter  │ ⚙ │
├────────────────────────────┬────────────────────────────────────┤
│  WBS │ 태스크명 │ 기간 │ % │  1월    │    2월    │    3월      │
│  1   │ 기획     │  5d  │100│ ████    │           │             │
│  1.1 │ 요구분석 │  5d  │100│ ████    │           │             │
│  2   │ 설계     │ 26d  │ 60│         │ ████████  │             │
│  2.1 │ 아키텍처 │ 12d  │100│         │ ████      │             │
│      │    ← 왼쪽: 인라인 편집 →      │← 오른쪽: 간트 차트 →   │
└────────────────────────────┴────────────────────────────────────┘
```

### 태스크 추가 및 편집

| 동작 | 방법 |
|------|------|
| 태스크 추가 | 툴바 **＋ Task** 또는 행의 **＋** 버튼 |
| 태스크명 편집 | 셀 더블클릭 → 입력 → Enter |
| 기간/날짜 편집 | 셀 더블클릭 → 날짜 입력 (YYYY-MM-DD) |
| 진행률 편집 | % 셀 더블클릭 → 숫자 입력 (0~100) |
| 선행 태스크 설정 | Pred 셀 더블클릭 → `2FS+1` 형식 입력 |
| 계층 만들기 (자식) | 행의 **→** 버튼 (들여쓰기) |
| 계층 해제 | 행의 **←** 버튼 (내어쓰기) |
| 태스크 삭제 | 행의 **✕** 버튼 또는 Delete 키 |
| 순서 변경 | 행을 드래그 앤 드롭 |

### 간트 차트 조작

| 동작 | 방법 |
|------|------|
| 태스크 이동 | 바를 좌우로 드래그 |
| 기간 변경 | 바의 오른쪽 끝을 드래그 |
| 태스크 선택 | 바 클릭 (왼쪽 테이블과 동기화) |
| 확대/축소 | 툴바의 Day / Week / Month / Quarter |
| 오늘로 이동 | 툴바 **Today** 버튼 |
| 크리티컬 패스 표시 | 툴바 **Critical** 체크박스 |

### 선행 태스크 (Predecessor) 입력 형식

| 입력 예 | 의미 |
|---------|------|
| `3` | WBS 3번 완료 후 시작 (FS, lag 0) |
| `2FS+3` | WBS 2번 완료 3일 후 시작 |
| `4SS` | WBS 4번과 동시에 시작 (Start-to-Start) |
| `5FF` | WBS 5번과 동시에 완료 (Finish-to-Finish) |
| `1SF-2` | WBS 1번 시작 2일 전에 완료 (Start-to-Finish) |
| `2,3FS+1` | 여러 선행 태스크 (콤마로 구분) |

### 마일스톤 추가

툴바 **◇ Milestone** → 제목과 날짜 입력 → 간트 차트에 ◇ 로 표시

### 데이터 백업 및 복원

- **⬇ (Export):** 프로젝트를 `project-id.json` 파일로 저장
- **⬆ (Import):** 저장된 JSON 파일로 복원

---

## 8. 데이터 동작 방식

### 저장 흐름

```
사용자가 태스크 편집
         │
         ▼
  localStorage 즉시 저장 (지연 없음)
         │
    1.5초 후
         │
         ▼
  GitHub API (PUT)
  gh-pages 브랜치의
  projects/<name>/data.json 업데이트
         │
         ▼
  GitHub Pages가 새 data.json 서빙
  (다른 기기에서 접속해도 최신 데이터)
```

### 첫 접속 시 데이터 로드 순서

```
1. GitHub API로 data.json 읽기 (가장 최신)
         │ 실패 시
         ▼
2. GitHub Pages URL에서 data.json fetch
         │ 없거나 실패 시
         ▼
3. 브라우저 localStorage 사용
```

### PAT 미설정 시

GitHub 동기화 없이 **브라우저 localStorage에만** 저장됩니다.
다른 기기나 브라우저에서는 데이터가 보이지 않습니다.

---

## 9. 문제 해결

### Q. GitHub Actions가 실패해요

**Actions 탭 → 실패한 워크플로 클릭** 해서 로그 확인.
가장 흔한 원인:

```
Error: GITHUB_TOKEN requires 'contents: write' permission
```

→ 저장소 Settings → Actions → General → **Workflow permissions**
→ **Read and write permissions** 선택 → Save

---

### Q. Pages 주소가 404를 반환해요

- Actions 탭에서 배포가 완료됐는지 확인
- Settings → Pages에서 소스가 `gh-pages` 브랜치로 설정됐는지 확인
- 주소에 저장소명이 포함됐는지 확인: `username.github.io/repo-name/`

---

### Q. 데이터를 저장했는데 다른 기기에서 안 보여요

- PAT가 올바르게 설정됐는지: Settings → **Test connection** 확인
- 툴바의 GitHub 버튼이 `✓ GitHub` (초록)인지 확인
- `✗ GitHub` (빨간)이면 PAT 권한이나 만료일 문제 → PAT 재발급 후 재설정

---

### Q. `npm run new-project` 후 배포해도 URL이 404예요

프로젝트 폴더를 git에 추가했는지 확인:

```bash
git status
# projects/my-project/ 가 untracked 상태인지 확인

git add projects/my-project
git commit -m "Add project: my-project"
git push
```

---

### Q. 로컬에서는 잘 되는데 배포 후 빈 화면이에요

Settings → Base path 설정 확인.
저장소명이 `projmanager`라면 Base path에 `projmanager` 입력.

---

### Q. PAT를 분실했어요

1. [github.com/settings/tokens](https://github.com/settings/tokens) 에서 기존 토큰 삭제
2. 새 토큰 발급 (5-1 절 참조)
3. 앱 Settings에서 새 토큰으로 교체

---

## 참고 링크

| 항목 | URL |
|------|-----|
| GitHub Pages 공식 문서 | https://docs.github.com/pages |
| GitHub PAT 발급 | https://github.com/settings/tokens |
| GitHub Actions | https://docs.github.com/actions |
| GitHub Contents API | https://docs.github.com/rest/repos/contents |
