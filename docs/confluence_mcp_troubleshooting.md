# Confluence MCP 연결 문제 해결 기록

**날짜:** 2026-04-10

---

## 문제 상황

Claude Code에서 Confluence MCP 도구가 로드되지 않아 연결 불가 상태.

---

## 원인 분석

### 오류 1: V3 차단 (Permission denied)
- AhnLab V3 보안 프로그램이 `mcp-atlassian.exe` 실행 차단
- exit code 126 (Permission denied)
- V3 영구 허용 설정에 관리자 비밀번호 필요 → 변경 불가

### 오류 2: 한글 경로 문제
- 사용자 폴더명 `유효영`이 Python 실행 시 `???`로 깨짐
- `Unable to create process` 오류 발생

---

## 해결 방법

### 기존 설정 (실패)
```json
"confluence": {
  "type": "stdio",
  "command": "C:\\Users\\유효영\\AppData\\Local\\uv\\cache\\archive-v0\\VonpYJh7mZTcV1c46Htjw\\Scripts\\mcp-atlassian.exe",
  "args": []
}
```
- Python 기반 exe 직접 실행
- V3 차단 + 한글 경로 두 가지 문제로 동작 불가

### 변경된 설정 (해결)
```json
"confluence": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "mcp-atlassian"],
  "env": {
    "CONFLUENCE_URL": "https://fursys.atlassian.net",
    "CONFLUENCE_USERNAME": "hyoyoung_yoo@fursys.com",
    "CONFLUENCE_API_TOKEN": "..."
  }
}
```
- Node.js 기반 npm 패키지 `mcp-atlassian@2.1.0` 사용
- `npx` 실행 → V3 차단 없음, 한글 경로 문제 없음

### 설정 파일 경로
`C:\Users\유효영\.claude\settings.json`

---

## 다음 단계

1. Claude Code 완전 종료 후 재시작
2. Confluence 도구 로드 여부 확인
3. 테스트: "컨플루언스 페이지 검색해줘" 등으로 동작 확인
