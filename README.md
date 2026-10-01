# vision-dev-kit

C# WinForms/WPF로 **머신비전·장비 제어**를 개발할 때 쓰는 [Claude Code](https://claude.com/claude-code) 플러그인입니다.

Matrox MIL, Cognex VisionPro 같은 비전 라이브러리는 API가 방대하고 파라미터 조합이 까다롭습니다. 그래서 AI가 추측으로 코드를 쓰면 틀리기 쉽습니다. 이 플러그인을 설치하면 Claude가 다음과 같이 동작합니다.

- **PC에 설치된 MIL/VisionPro 문서를 직접 찾아보고**, 그 근거로 코드를 작성합니다.
- WPF, WinForms, .NET, NuGet 라이브러리는 **최신 공식 문서**를 확인합니다.
- C# 코드를 수정할 때 **팀 코드 규칙(삼항연산자·한 줄 if 금지)을 자동으로 검사**하고 고칩니다.

---

## 목차
1. [구성](#구성)
2. [요구 사항](#요구-사항)
3. [설치](#설치)
4. [사용 방법](#사용-방법)
5. [구성 요소 상세](#구성-요소-상세)
6. [설정](#설정)
7. [업데이트 · 제거](#업데이트--제거)
8. [문제 해결](#문제-해결)
9. [주의 사항](#주의-사항)

---

## 구성

| 종류 | 이름 | 하는 일 |
|---|---|---|
| 스킬 | `vision-dev:mil-lookup` | Matrox MIL 함수(`MbufAlloc2d`, `MdigProcess` 등)를 로컬 문서, MIL.NET XML, C# 예제에서 조회 |
| 스킬 | `vision-dev:visionpro-lookup` | Cognex VisionPro 클래스(`CogBlobTool`, `CogPMAlignTool` 등)를 IntelliSense XML, help, 샘플에서 조회 |
| MCP | `mslearn` | Microsoft Learn 공식 문서 검색 (WPF, WinForms, .NET, C#) |
| MCP | `context7` | 오픈소스 라이브러리 문서 검색 (CommunityToolkit.Mvvm, OpenCvSharp, ScottPlot, NModbus 등) |
| Hook | C# 스타일 검사 | `.cs` 수정 시 삼항연산자 `? :`, 중괄호 없는 `if`/`else`를 찾아 블록 형태로 고치게 함 |

> 스킬은 관련 작업을 할 때만 불러옵니다. 평소에는 스킬 설명 약 110토큰만 차지합니다.

---

## 요구 사항

| 항목 | 필수 여부 | 비고 |
|---|---|---|
| Windows 10/11 | 필수 | 경로와 설치 스크립트가 Windows 기준 |
| [Claude Code](https://claude.com/claude-code) | 필수 | |
| Node.js (LTS) | 필수 | 스킬 스크립트와 Hook이 Node로 실행됨. `winget install OpenJS.NodeJS.LTS` |
| ast-grep | Hook에 필요 | `setup.ps1`이 자동 설치 (`npm i -g @ast-grep/cli`) |
| Matrox MIL | 선택 | 있어야 `mil-lookup`이 동작 |
| Cognex VisionPro | 선택 | 있어야 `visionpro-lookup`이 동작 |
| 7-Zip | VisionPro 사용 시 | help 추출에 필요. `winget install 7zip.7zip` |
| .NET SDK + ilspycmd | 선택 | 문서로 부족할 때 DLL 디컴파일. `setup.ps1`이 자동 설치 |

MIL이나 VisionPro가 없는 PC에서도 설치할 수 있습니다. 해당 스킬만 "문서 없음"을 안내하고, 나머지 기능은 정상 동작합니다.

---

## 설치

### 1단계. PC 준비 (최초 1회)
PowerShell에서 실행합니다.
```powershell
git clone https://github.com/hdvisionrnd1/vision-dev-kit.git
cd vision-dev-kit
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

`setup.ps1`이 하는 일:
1. Node.js 설치 여부 확인
2. ast-grep 설치 (이미 있으면 건너뜀)
3. ilspycmd 설치 (.NET SDK가 있을 때만, `-SkipIlspy`로 생략 가능)
4. VisionPro가 설치되어 있으면 help를 HTML로 추출 (`-SkipCognexHelp`로 생략 가능)

> VisionPro help 추출은 수 분 걸릴 수 있습니다. 추출 위치는 `%USERPROFILE%\.claude\tools\cognex-doc\VisionPro\html`입니다.

### 2단계. Claude Code에 플러그인 설치
Claude Code 안에서 실행합니다.
```
/plugin marketplace add hdvisionrnd1/vision-dev-kit
/plugin install vision-dev@vision-dev-kit
```
터미널에서 실행해도 됩니다.
```powershell
claude plugin marketplace add hdvisionrnd1/vision-dev-kit
claude plugin install vision-dev@vision-dev-kit
```

### 3단계. Claude Code 재시작
재시작하면 스킬, MCP, Hook이 적용됩니다. 설치를 확인하려면 다음을 실행합니다.
```powershell
claude plugin details vision-dev@vision-dev-kit   # 스킬 2, Hook 1, MCP 2 가 보이면 정상
claude mcp list                                   # plugin:vision-dev:mslearn / context7 → Connected
```

---

## 사용 방법

평소처럼 요청하면 Claude가 필요한 스킬과 MCP를 알아서 사용합니다.

### 요청 예시

**MIL**
```
MdigProcess로 연속 Grab 하면서 콜백에서 이진화하는 코드 짜줘
MbufAlloc2d에서 M_GRAB + M_PROC 같이 쓸 때 제약 있어?
이 MIL 코드에서 버퍼 해제 순서 맞는지 리뷰해줘
```

**VisionPro**
```
CogPMAlignTool 학습/실행하는 C# 코드 예제 만들어줘
CogBlobTool 의 Polarity 설정 의미가 뭐야?
ToolBlock(.vpp) 로드해서 입력 이미지 넣고 결과 읽는 코드 짜줘
```

**.NET / 라이브러리** (MCP)
```
WPF에서 카메라 영상을 WriteableBitmap으로 빠르게 갱신하는 방법 공식 문서 기준으로 알려줘
CommunityToolkit.Mvvm 최신 버전의 [ObservableProperty] 사용법 context7로 확인해서 적용해줘
```

### 스킬을 직접 부르기
자동으로 불리지 않을 때는 슬래시 명령으로 직접 부를 수 있습니다.
```
/vision-dev:mil-lookup
/vision-dev:visionpro-lookup
```

---

## 구성 요소 상세

### `mil-lookup`: Matrox MIL 문서 조회
Claude는 다음 순서로 확인합니다.

| 순서 | 출처 | 위치 |
|---|---|---|
| 1 | C# 시그니처 (IntelliSense XML) | `C:\Program Files\Matrox Imaging\MIL\MIL.NET\Matrox.MatroxImagingLibrary.xml` |
| 2 | 함수 레퍼런스 (파라미터 표, 상수, 제약) | `C:\Program Files\Matrox Imaging\MIL\DOC\mil_help\content\Reference\<모듈>\<함수>.htm` |
| 3 | 공식 C# 예제 | `C:\Users\Public\Documents\Matrox Imaging\MIL\Examples\**\C#\*.cs` |
| 4 | DLL 디컴파일 (최후 수단) | `ilspycmd` |

MIL 레퍼런스 HTML은 파일 하나가 약 300KB이고 대부분 스크립트입니다. 그래서 `scripts/miltext.mjs`로 **본문만 추출**(약 1/8 크기)하거나 **키워드 주변만** 읽습니다.
```powershell
node miltext.mjs MbufAlloc2d           # 본문 전체
node miltext.mjs MbufAlloc2d M_GRAB    # M_GRAB 주변만
```

### `visionpro-lookup`: Cognex VisionPro 문서 조회

| 순서 | 출처 | 위치 |
|---|---|---|
| 1 | C# 시그니처 (IntelliSense XML) | `C:\Program Files\Cognex\VisionPro\ReferencedAssemblies\*.xml` |
| 2 | help (클래스 설명, 개념 문서) | `%USERPROFILE%\.claude\tools\cognex-doc\VisionPro\html` (setup 시 추출) |
| 3 | 공식 C# 샘플 | `C:\Program Files\Cognex\VisionPro\samples\Programming\<주제>` |
| 4 | DLL 디컴파일 (최후 수단) | `ilspycmd` |

help는 HTML 파일 약 34,000개로 이루어져 있습니다. 그래서 `scripts/cogdoc.mjs`가 **제목 색인**을 만들어 바로 검색합니다.
```powershell
node cogdoc.mjs find blob tool                         # 제목 검색
node cogdoc.mjs text T_Cognex_VisionPro_Blob_CogBlobTool   # 본문 추출
```

help 파일 이름은 다음 규칙을 따릅니다.
- `T_` 타입, `M_` 메서드, `P_` 속성, `E_` 이벤트, `F_` 필드
- GUID 이름의 파일(예: `019dfe52-....htm`)은 **개념·사용법 문서**입니다. 툴의 동작 원리를 설명합니다.

> 첫 검색 때는 색인을 만드느라 수 분 걸립니다. 색인은 `%USERPROFILE%\.claude\cache\vision-dev\cognex-titles.tsv`에 저장되고, 이후에는 즉시 검색됩니다.

### MCP 서버

| 이름 | 주소 | 용도 |
|---|---|---|
| `mslearn` | `https://learn.microsoft.com/api/mcp` | Microsoft 공식 문서 (WPF, WinForms, .NET API, C# 언어) |
| `context7` | `https://mcp.context7.com/mcp` | 오픈소스 라이브러리의 버전별 문서 |

둘 다 원격 HTTP 서버라 별도 설치가 필요 없습니다. 인터넷 연결만 있으면 됩니다.

### C# 스타일 검사 Hook

Claude가 `.cs` 파일을 **Write/Edit**할 때마다 [ast-grep](https://ast-grep.github.io/)으로 문법 트리를 분석해 검사합니다. 위반이 있으면 Claude에게 알려서 바로 고치게 합니다.

**위반으로 잡는 코드**
```csharp
var y = x > 0 ? 1 : 2;              // 삼항연산자
if (x > 0) return;                  // 중괄호 없는 if
if (x > 1)
    x++;                            // 여러 줄이어도 중괄호 없으면 위반
if (ok) { Run(); } else Stop();     // 중괄호 없는 else
```

**허용하는 코드**
```csharp
var name = obj?.ToString() ?? "";   // ?. 과 ?? 는 삼항연산자가 아님
int? count = null;                  // nullable
if (a) { ... } else if (b) { ... } else { ... }   // else if 체인
string s = "a ? b : c";             // 문자열 안의 ?
```

**검사 범위**
| 경우 | 검사 범위 |
|---|---|
| `Edit` (부분 수정) | **이번에 수정한 줄만** 검사합니다. 기존 레거시 코드의 위반은 건드리지 않습니다. |
| `Write` (파일 전체 작성) | 파일 전체를 검사합니다. |
| 자동 생성 파일 | 검사하지 않습니다: `*.Designer.cs`, `*.g.cs`, `*.g.i.cs`, `AssemblyInfo.cs`, `obj/`, `bin/` |

> Claude가 수정한 코드만 검사합니다. Visual Studio에서 사람이 직접 고친 코드는 검사하지 않습니다.

규칙 정의 파일은 `plugins/vision-dev/hooks/cs-style/rules.yml`입니다.

---

## 설정

설정은 Claude Code의 `settings.json`의 `"env"`에 환경변수를 넣는 방식입니다.

| 범위 | 파일 |
|---|---|
| 모든 프로젝트 | `%USERPROFILE%\.claude\settings.json` |
| 특정 프로젝트만 (개인) | `<프로젝트>\.claude\settings.local.json` |
| 특정 프로젝트만 (팀 공유) | `<프로젝트>\.claude\settings.json` |

### 스타일 Hook 끄기
```json
{
  "env": {
    "VISION_DEV_STYLE_HOOK": "off"
  }
}
```
예를 들어 삼항연산자를 허용하는 프로젝트라면 그 프로젝트의 `.claude/settings.local.json`에만 넣으면 됩니다.

### 경로 변경 (기본 위치가 아닐 때)
| 환경변수 | 기본값 | 용도 |
|---|---|---|
| `MIL_DOC_DIR` | `C:\Program Files\Matrox Imaging\MIL\DOC\mil_help\content\Reference` | MIL 레퍼런스 폴더 |
| `COGNEX_HELP_DIR` | `%USERPROFILE%\.claude\tools\cognex-doc\VisionPro\html` | 추출한 VisionPro help 폴더 |
| `AST_GREP_PATH` | npm 전역 설치 위치, 없으면 PATH 검색 | ast-grep 실행 파일 |

### 문서 읽기 권한 (선택)
Claude가 문서를 읽을 때마다 권한 확인 창이 뜨는 게 번거롭다면 `%USERPROFILE%\.claude\settings.json`의 `permissions.allow`에 추가하세요.
```json
{
  "permissions": {
    "allow": [
      "Read(C:\\Program Files\\Matrox Imaging\\MIL\\DOC\\mil_help\\content\\Reference/**)",
      "Read(C:\\Program Files\\Matrox Imaging\\MIL\\MIL.NET/**)",
      "Read(C:\\Users\\Public\\Documents\\Matrox Imaging\\MIL\\Examples/**)",
      "Read(C:\\Program Files\\Cognex\\VisionPro\\ReferencedAssemblies/**)",
      "Read(C:\\Program Files\\Cognex\\VisionPro\\samples/**)",
      "Read(~/.claude/tools/cognex-doc/**)"
    ]
  }
}
```
이미 `allow` 목록이 있다면 기존 항목은 그대로 두고 이 항목들만 추가하세요.

---

## 업데이트 · 제거

### 업데이트
새 버전이 올라오면 아래 두 명령을 실행하고 Claude Code를 재시작합니다.
```powershell
claude plugin marketplace update vision-dev-kit      # 저장소의 최신 목록 받기
claude plugin update vision-dev@vision-dev-kit       # 플러그인을 새 버전으로 교체
```

### 제거
```powershell
claude plugin uninstall vision-dev@vision-dev-kit
claude plugin marketplace remove vision-dev-kit
```
아래 항목은 플러그인을 제거해도 남아 있으니, 필요 없으면 직접 지우세요.
- VisionPro help: `%USERPROFILE%\.claude\tools\cognex-doc`
- 색인: `%USERPROFILE%\.claude\cache\vision-dev`
- ast-grep: `npm uninstall -g @ast-grep/cli`

---

## 문제 해결

**스킬이 안 보이거나 자동으로 불리지 않음**
- Claude Code를 재시작했는지 확인하세요.
- `claude plugin details vision-dev@vision-dev-kit`로 설치 상태를 확인하세요.
- `/vision-dev:mil-lookup`처럼 직접 불러서 써 보세요.

**스타일 검사가 동작하지 않음**
- "ast-grep이 없어 C# 스타일 검사를 건너뜁니다" 메시지가 떴다면 → `npm i -g @ast-grep/cli`
- `ast-grep --version`이 실행되는지 확인하세요.
- `VISION_DEV_STYLE_HOOK`이 `off`로 설정되어 있지 않은지 확인하세요.
- Hook 목록은 Claude Code의 `/hooks` 메뉴에서 볼 수 있습니다.

**"VisionPro help(HTML)가 없습니다"**
- `scripts\extract-cognex-help.ps1`을 실행하세요 (7-Zip 필요).
- 영어가 아닌 help를 추출하려면 `-Lang ja` 또는 `-Lang zh-Hans`를 지정하세요.
- 다른 위치에 추출했다면 `COGNEX_HELP_DIR`을 지정하세요.

**"MIL 레퍼런스 폴더가 없습니다"**
- MIL이 설치되어 있지 않거나 다른 위치에 설치된 경우입니다. 다른 위치라면 `MIL_DOC_DIR`을 지정하세요.

**첫 VisionPro 검색이 오래 걸림**
- 정상입니다. 제목 색인을 처음 만드는 중입니다 (수 분). 두 번째부터는 즉시 검색됩니다.

**MCP가 연결되지 않음**
- `claude mcp list`로 상태를 확인하세요.
- 회사 방화벽이나 프록시가 `learn.microsoft.com`, `mcp.context7.com`을 막고 있지 않은지 확인하세요.

**`setup.ps1` 실행이 막힘 (실행 정책 오류)**
- `powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1`처럼 `-ExecutionPolicy Bypass`를 붙여 실행하세요.

---

## 주의 사항
- **Cognex help 문서는 이 저장소에 포함하지 않습니다.** Cognex의 라이선스 문서이므로 각자 PC에 설치된 VisionPro에서 `scripts/extract-cognex-help.ps1`로 추출합니다. 추출한 파일을 다른 곳에 재배포하지 마세요.
- 문서는 **각 PC에 설치된 MIL/VisionPro 버전 기준**입니다. 프로젝트에서 쓰는 라이브러리 버전과 다르면 결과가 다를 수 있습니다.
- MCP 서버(`mslearn`, `context7`)는 외부 서비스입니다. 질문 내용 중 검색어가 해당 서비스로 전송됩니다.
