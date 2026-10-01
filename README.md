# vision-dev-kit

C# WinForms/WPF로 **머신비전·장비 제어**를 개발할 때 쓰는 Claude Code 플러그인입니다.

## 들어 있는 것

| 구성 | 내용 |
|---|---|
| 스킬 `mil-lookup` | Matrox MIL 함수(MbufAlloc2d 등)를 로컬 문서, MIL.NET XML, C# 예제에서 조회합니다. 300KB짜리 HTML에서 본문만 추출해 읽습니다. |
| 스킬 `visionpro-lookup` | Cognex VisionPro API(CogBlobTool 등)를 IntelliSense XML, 추출한 help, 샘플에서 조회합니다. 제목 색인으로 바로 검색합니다. |
| MCP `mslearn` | Microsoft Learn 공식 문서 (WPF, WinForms, .NET) |
| MCP `context7` | 서드파티 라이브러리 문서 (CommunityToolkit.Mvvm, OpenCvSharp, ScottPlot 등) |
| Hook: C# 스타일 검사 | `.cs`를 수정할 때 **삼항연산자 `? :`**, **중괄호 없는 if/else**를 찾아 블록 형태로 고치게 합니다. |

스킬은 관련 작업을 할 때만 불러오므로, 평소 컨텍스트를 차지하지 않습니다.

## 설치

### 1) PC 준비 (최초 1회)
```powershell
git clone https://github.com/hdvisionrnd1/vision-dev-kit.git
cd vision-dev-kit
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```
- Node.js가 필요합니다. 없으면 `winget install OpenJS.NodeJS.LTS`로 설치하세요.
- 스크립트가 하는 일:
  - ast-grep 설치
  - ilspycmd 설치 (선택)
  - VisionPro가 설치되어 있으면 help 추출 (7-Zip 필요)

### 2) Claude Code에 플러그인 설치
Claude Code 안에서 실행합니다.
```
/plugin marketplace add hdvisionrnd1/vision-dev-kit
/plugin install vision-dev@vision-dev-kit
```
설치한 뒤 Claude Code를 다시 시작하세요. 스킬 이름은 `vision-dev:mil-lookup`, `vision-dev:visionpro-lookup`입니다.

### 업데이트
```
/plugin marketplace update vision-dev-kit
```

## 설정

### 코드 스타일 Hook 끄기
- **모든 프로젝트**에서 끄려면 `~/.claude/settings.json`에 추가합니다.
  ```json
  { "env": { "VISION_DEV_STYLE_HOOK": "off" } }
  ```
- **특정 프로젝트만** 끄려면 그 프로젝트의 `.claude/settings.local.json`에 같은 내용을 넣습니다.

검사 규칙:
- `Edit`는 이번에 수정한 줄만 검사합니다. 기존 레거시 코드의 위반은 무시합니다.
- `Write`는 파일 전체를 검사합니다.
- `*.Designer.cs`, `*.g.cs`, `AssemblyInfo.cs`, `obj/`, `bin/`은 제외합니다.
- `?.`, `??`, `int?`, `else if`는 허용합니다.
- 규칙 파일은 `plugins/vision-dev/hooks/cs-style/rules.yml`입니다.

### 경로가 기본값과 다를 때 (환경변수)
| 변수 | 기본값 |
|---|---|
| `MIL_DOC_DIR` | `C:\Program Files\Matrox Imaging\MIL\DOC\mil_help\content\Reference` |
| `COGNEX_HELP_DIR` | `%USERPROFILE%\.claude\tools\cognex-doc\VisionPro\html` |
| `AST_GREP_PATH` | npm 전역 설치 위치, 없으면 PATH에서 찾음 |

### 문서 읽기 권한 (선택)
문서를 읽을 때마다 권한 확인 창이 뜨는 게 번거로우면 `~/.claude/settings.json`의 `permissions.allow`에 추가하세요.
```json
"Read(C:\\Program Files\\Matrox Imaging\\MIL\\DOC\\mil_help\\content\\Reference/**)",
"Read(C:\\Program Files\\Matrox Imaging\\MIL\\MIL.NET/**)",
"Read(C:\\Users\\Public\\Documents\\Matrox Imaging\\MIL\\Examples/**)",
"Read(C:\\Program Files\\Cognex\\VisionPro\\ReferencedAssemblies/**)",
"Read(C:\\Program Files\\Cognex\\VisionPro\\samples/**)",
"Read(~/.claude/tools/cognex-doc/**)"
```

## 주의
- **Cognex help HTML은 이 저장소에 포함하지 않습니다.** Cognex의 라이선스 문서이므로 각자 PC에 설치된 VisionPro에서 `scripts/extract-cognex-help.ps1`로 추출하세요.
- MIL이나 VisionPro가 없는 PC에서도 플러그인은 동작합니다. 그 경우 해당 스킬이 "문서 없음"을 안내합니다.
