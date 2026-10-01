# vision-dev-kit

C# WinForms/WPF로 **머신비전·장비 제어**를 개발할 때 쓰는 [Claude Code](https://claude.com/claude-code) 플러그인입니다.

Matrox MIL, Cognex VisionPro 같은 비전 라이브러리는 API가 방대하고 파라미터 조합이 까다롭습니다. 그래서 AI가 추측으로 코드를 쓰면 틀리기 쉽습니다. 이 플러그인을 설치하면 Claude가 다음과 같이 동작합니다.

- **PC에 설치된 MIL/VisionPro 문서를 직접 찾아보고**, 그 근거로 코드를 작성합니다.
- WPF, WinForms, .NET, NuGet 라이브러리는 **최신 공식 문서**를 확인합니다.
- C# 코드를 수정할 때 **팀 코드 규칙(삼항연산자·한 줄 if 금지)을 자동으로 검사**하고 고칩니다.
- [Superpowers](https://github.com/obra/superpowers)를 함께 설치해서 **요구사항 정리 → 계획 → 테스트 먼저(TDD) → 리뷰** 순서로 개발합니다. TDD는 판정·계산·통신 로직에만 적용하고, UI·장비 코드는 제외하도록 팀 규칙으로 정해 두었습니다.
- csharp-lsp를 함께 설치해서 Claude가 C# 정의·참조·컴파일 오류를 정확히 파악합니다.

---

## 목차
1. [구성](#구성)
2. [요구 사항](#요구-사항)
3. [설치 (자동, 권장)](#설치)
4. [수동 설치](#수동-설치)
5. [사용 방법](#사용-방법)
6. [구성 요소 상세](#구성-요소-상세)
7. [설정](#설정)
8. [업데이트 · 제거](#업데이트--제거)
9. [문제 해결](#문제-해결)
10. [주의 사항](#주의-사항)

---

## 구성

| 종류 | 이름 | 하는 일 |
|---|---|---|
| 스킬 | `vision-dev:mil-lookup` | Matrox MIL 함수(`MbufAlloc2d`, `MdigProcess` 등)를 로컬 문서, MIL.NET XML, C# 예제에서 조회 |
| 스킬 | `vision-dev:visionpro-lookup` | Cognex VisionPro 클래스(`CogBlobTool`, `CogPMAlignTool` 등)를 IntelliSense XML, help, 샘플에서 조회 |
| MCP | `mslearn` | Microsoft Learn 공식 문서 검색 (WPF, WinForms, .NET, C#) |
| MCP | `context7` | 오픈소스 라이브러리 문서 검색 (CommunityToolkit.Mvvm, OpenCvSharp, ScottPlot, NModbus 등) |
| Hook | C# 스타일 검사 | `.cs` 수정 시 삼항연산자 `? :`, 중괄호 없는 `if`/`else`를 찾아 블록 형태로 고치게 함 |
| Hook | 팀 규칙 | 세션이 시작될 때 팀 규칙(코드 스타일, TDD 적용 범위, 문서 조회 원칙)을 Claude에게 알려 줌 |
| 함께 설치 | [Superpowers](https://github.com/obra/superpowers) | 개발 절차 스킬 15개 (브레인스토밍, 계획, TDD, 체계적 디버깅, 코드 리뷰, 완료 전 검증 등) |
| 함께 설치 | csharp-lsp | C# 언어 서버. 정의로 이동, 참조 찾기, 컴파일 오류 진단 |

> **vision-dev 하나만 설치하면** Superpowers와 csharp-lsp가 자동으로 함께 설치됩니다. 둘 다 Anthropic 공식 마켓플레이스에 있는 플러그인을 그대로 연결한 것입니다.
>
> 스킬은 관련 작업을 할 때만 불러옵니다. 매 세션 상시로 쓰는 양은 스킬 설명, 팀 규칙, Superpowers 안내를 합쳐 약 1,500토큰입니다.

---

## 요구 사항

| 항목 | 필수 여부 | 비고 |
|---|---|---|
| Windows 10/11 | 필수 | 경로와 설치 스크립트가 Windows 기준 |
| [Claude Code](https://claude.com/claude-code) | 필수 | |
| Git | 필수 | 저장소를 내려받을 때 필요. `winget install Git.Git` |
| Node.js (LTS) | 필수 | 스킬 스크립트와 Hook이 Node로 실행됨. `winget install OpenJS.NodeJS.LTS` |
| ast-grep | Hook에 필요 | `setup.ps1`이 자동 설치 (`npm i -g @ast-grep/cli`) |
| Matrox MIL | 선택 | 있어야 `mil-lookup`이 동작 |
| Cognex VisionPro | 선택 | 있어야 `visionpro-lookup`이 동작 |
| 7-Zip | VisionPro 사용 시 | help 추출에 필요. `winget install 7zip.7zip` |
| **.NET 10 SDK** | 권장 | csharp-ls·ilspycmd 최신 버전이 .NET 10 전용이라 **.NET 8 이하만 있으면 설치가 실패**합니다. `winget install Microsoft.DotNet.SDK.10` (기존 SDK를 지우지 않고 나란히 설치됨) |
| csharp-ls | csharp-lsp에 필요 | `setup.ps1`이 자동 설치 (`dotnet tool install --global csharp-ls`) |
| ilspycmd | 선택 | 문서로 부족할 때 DLL 디컴파일. `setup.ps1`이 자동 설치 |
| oh-my-claudecode(OMC) | ❌ 함께 쓰면 안 됨 | Superpowers와 충돌. 설치되어 있으면 설치기가 **자동으로 끔** (상태 표시줄 HUD는 그대로 유지) ([OMC가 설치된 PC](#omcoh-my-claudecode가-설치된-pc)) |

MIL이나 VisionPro가 없는 PC에서도 **자동 설치기가 끝까지 정상 진행**됩니다(VisionPro 관련 단계는 건너뜀). 설치 후에는 해당 스킬만 "이 PC에는 설치되어 있지 않습니다"라고 안내하고, 나머지 기능(문서 MCP, 스타일 검사, 팀 규칙, Superpowers, csharp-lsp)은 그대로 동작합니다.

---

## 설치

**자동 설치기로 한 번에 설치하는 것을 권장합니다.** 필수 프로그램 설치부터 플러그인 설치·확인까지 알아서 진행합니다.
자동 설치가 안 될 때만 [수동 설치](#수동-설치)를 따라 하세요.

### 시작하기 전에: 명령어 입력하는 방법

> ⚠️ **명령어는 반드시 한 줄씩 복사해서 붙여넣고 실행하세요.**
> 여러 줄을 한 번에 붙여넣으면 앞 명령이 끝나기 전에 다음 명령이 실행되어 설치가 꼬일 수 있습니다.

한 줄을 실행하는 순서:
1. 아래 회색 상자 오른쪽 위의 **복사 버튼**(📋)을 누릅니다. 상자 하나에 명령이 한 줄씩만 들어 있습니다.
2. PowerShell 창에서 **Ctrl + V**를 눌러 붙여넣습니다. (마우스 오른쪽 버튼을 눌러도 됩니다. 메뉴가 뜨면 **붙여넣기**를 고르세요.)
3. **Enter**를 누릅니다.
4. 명령이 끝날 때까지 기다립니다. 맨 아래 줄에 `PS C:\Users\사용자이름>`처럼 입력 대기 표시가 다시 나오면 끝난 것입니다.
5. 다음 상자로 넘어갑니다.

> 🛑 **빨간 글씨, `FAILED`, `fatal:`, `✘`가 보이면 다음 단계로 넘어가지 마세요.**
> 오류 메시지의 앞부분을 복사해서 이 페이지 맨 아래 [문제 해결](#문제-해결)에서 **Ctrl + F**로 찾으면 해결 방법이 있습니다.
> 같은 오류라도 Windows 언어에 따라 영어 또는 한국어로 나오므로, 문제 해결에는 두 가지를 함께 적어 두었습니다.

---

### 0단계. PowerShell 열기

1. 키보드의 **Windows 키**를 누르거나 화면 왼쪽 아래(Windows 11은 가운데)의 **시작 버튼**을 클릭합니다.
2. `powershell`이라고 입력합니다.
3. 검색 결과에서 **Windows PowerShell**을 **그냥 클릭**해서 엽니다.
   - ❌ "관리자 권한으로 실행"은 누르지 마세요. 관리자 창에서 실행하면 파일이 엉뚱한 곳(`C:\Windows\System32`)에 만들어지거나 권한 오류가 납니다.
4. 파란색(또는 검은색) 창이 열리고 `PS C:\Users\사용자이름>`이 보이면 준비된 것입니다.

> Windows 11에서는 시작 버튼을 마우스 오른쪽 클릭 → **터미널**을 눌러도 PowerShell 창이 열립니다. 이때도 "터미널(관리자)"가 아닌 그냥 **터미널**을 고르세요.

---

### 자동 설치

설치기가 아래를 **한 번에** 처리합니다.
1. 빠진 필수 프로그램 설치: Git, Node.js, Claude Code, .NET 10 SDK, (VisionPro가 있으면) 7-Zip
2. vision-dev-kit 내려받기 (`%USERPROFILE%\vision-dev-kit`, 이미 있으면 최신으로 갱신)
3. PC 준비: ast-grep, csharp-ls 설치, VisionPro help 추출, OMC 확인
4. 플러그인 설치 (이미 설치되어 있으면 업데이트)
5. 설치 결과 확인

**방법 A. PowerShell에 한 줄 붙여넣기 (권장)**

위 0단계처럼 PowerShell을 연 뒤, 아래 한 줄을 복사해서 붙여넣고 Enter를 누릅니다.
```powershell
irm https://raw.githubusercontent.com/hdvisionrnd1/vision-dev-kit/main/install.ps1 | iex
```

**방법 B. install.bat 더블클릭**

1. [install.bat](https://github.com/hdvisionrnd1/vision-dev-kit/blob/main/install.bat) 페이지를 엽니다. 오른쪽 위의 **다운로드 버튼**(아래 화살표 모양, "Download raw file")을 누릅니다.
2. 내려받은 `install.bat`을 **더블클릭**합니다.
3. "Windows의 PC 보호" 같은 보안 경고가 뜨면 **추가 정보 → 실행**을 누릅니다. 보안 경고 창에 **실행** 버튼이 바로 보이면 그것을 누르면 됩니다.

**설치 중에 할 일**

| 화면에 나오는 것 | 할 일 |
|---|---|
| `Install them now? (Y/N)` | `Y` 입력 후 Enter (빠진 프로그램이 있을 때만 나옴) |
| Windows 권한 확인 창 ("이 앱이 디바이스를 변경하도록 허용하시겠어요?") | **예** 클릭 |
| 한동안 화면이 멈춘 것처럼 보임 | 프로그램 설치나 VisionPro help 추출 중입니다. **창을 닫지 말고** 기다리세요 |

> OMC(oh-my-claudecode)가 설치된 PC는 설치기가 **묻지 않고 자동으로 OMC를 끕니다.** 화면 아래 상태 표시줄(HUD)은 그대로 유지됩니다. ([이유](#omcoh-my-claudecode가-설치된-pc))

**끝났을 때 화면 맨 아래를 확인하세요**

| 마지막 메시지 | 의미 |
|---|---|
| 🟢 `DONE. vision-dev is installed.` | 완료입니다. 창을 닫고 **새 PowerShell**에서 `claude`를 실행하세요. 처음이면 로그인 화면이 나옵니다 |
| 🟡 `Installed, but please check these items:` | 설치는 됐지만 확인할 항목이 있습니다. 목록의 내용을 [문제 해결](#문제-해결)에서 찾으세요. 대부분 **설치기를 한 번 더 실행**하면 해결됩니다 |
| 🔴 `[FAIL] ...` 후 중단 | [문제 해결 → 자동 설치기](#자동-설치기)에서 같은 메시지를 찾으세요 |

> 설치 과정 전체가 `%USERPROFILE%\vision-dev-install.log` 파일에 기록됩니다. 해결이 안 되면 이 파일을 키트를 공유한 사람에게 보내 주세요.
>
> 설치기는 **여러 번 실행해도 안전**합니다. 이미 된 단계는 건너뜁니다. 새 버전이 나왔을 때도 같은 방법으로 실행하면 업데이트됩니다.

<details>
<summary>고급: 확인만 하기 / 옵션</summary>

내려받은 폴더에서 `install.ps1`을 직접 실행하면 옵션을 줄 수 있습니다.

| 옵션 | 동작 |
|---|---|
| `-CheckOnly` | 무엇이 빠졌는지 **확인만** 하고 아무것도 바꾸지 않음 |
| `-Yes` | 모든 질문에 Y로 답함 |
| `-InstallDir <폴더>` | 저장소를 받을 위치 지정 (기본 `%USERPROFILE%\vision-dev-kit`) |

```powershell
powershell -ExecutionPolicy Bypass -File $env:USERPROFILE\vision-dev-kit\install.ps1 -CheckOnly
```
</details>

---

## 수동 설치

자동 설치가 안 될 때 단계별로 직접 설치하는 방법입니다. 위의 [시작하기 전에](#시작하기-전에-명령어-입력하는-방법)와 [0단계](#0단계-powershell-열기)를 먼저 읽고, 아래 1단계부터 차례대로 진행하세요.

### 1단계. 필수 프로그램 확인

아래 명령을 하나씩 실행해서 버전 번호가 나오는지 확인합니다.

Git 확인:
```powershell
git --version
```

Node.js 확인:
```powershell
node --version
```

Claude Code 확인:
```powershell
claude --version
```

`git version 2.47.1`, `v22.11.0`처럼 버전 번호가 나오면 설치된 것입니다. (숫자는 PC마다 다릅니다)
**빨간 글씨로 "인식되지 않습니다"가 나오면** 그 프로그램이 없는 것이니, 해당 줄을 실행해서 설치하세요.

Git 설치 (없을 때만):
```powershell
winget install Git.Git
```

Node.js 설치 (없을 때만):
```powershell
winget install OpenJS.NodeJS.LTS
```

> 설치 중 약관에 동의하는지 묻는 메시지(`[Y] Yes [N] No`)가 나오면 `Y`를 입력하고 Enter를 누르세요.
>
> **새로 설치했다면 PowerShell 창을 닫고 0단계부터 다시 여세요.** 창을 다시 열어야 방금 설치한 프로그램이 인식됩니다.

Claude Code가 없다면 [Claude Code 홈페이지](https://claude.com/claude-code)의 설치 안내를 따라 먼저 설치하세요.

**.NET SDK 확인 (권장)**: C# 코드 분석 기능(csharp-lsp)에 필요합니다. 결과에 `10.`으로 시작하는 줄이 있으면 됩니다.
```powershell
dotnet --list-sdks
```

`10.`으로 시작하는 줄이 없거나 "인식되지 않습니다"가 나오면 설치하세요. (설치 후 PowerShell 창을 다시 여세요)
```powershell
winget install Microsoft.DotNet.SDK.10
```

---

### 2단계. 내려받기 및 준비 (최초 1회)

**① 사용자 홈 폴더로 이동합니다.** 이 줄을 빼먹으면 권한 오류(`Permission denied`)가 날 수 있습니다.
```powershell
cd $env:USERPROFILE
```

**② 저장소를 내려받습니다.** `vision-dev-kit` 폴더가 만들어집니다.
```powershell
git clone https://github.com/hdvisionrnd1/vision-dev-kit.git
```

**③ 내려받은 폴더로 이동합니다.**
```powershell
cd vision-dev-kit
```

**④ 준비 스크립트를 실행합니다.** 몇 분 걸릴 수 있습니다. `Setup finished.`가 나올 때까지 기다리세요.
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

`setup.ps1`이 하는 일 (화면에 `[1/6]` ~ `[6/6]`으로 표시됩니다):
1. Node.js 설치 여부 확인
2. ast-grep 설치 (이미 있으면 건너뜀)
3. csharp-ls 설치 (.NET 10 SDK가 있을 때만)
4. ilspycmd 설치 (.NET 10 SDK가 있을 때만, `-SkipIlspy`로 생략 가능)
5. VisionPro가 설치되어 있으면 help를 HTML로 추출 (`-SkipCognexHelp`로 생략 가능)
6. **oh-my-claudecode(OMC)가 켜져 있으면 자동으로 끕니다.** CLAUDE.md의 OMC 지침은 백업한 뒤 정리하고, 상태 표시줄(HUD)은 그대로 둡니다. ([자세히](#omcoh-my-claudecode가-설치된-pc))

끝났을 때 화면 맨 아래를 확인하세요.
- 초록색 `Setup finished.` → 모두 정상입니다. 3단계로 넘어가세요.
- 노란색 `Setup finished, but these steps need attention:` → 아래에 나온 항목을 [문제 해결](#2단계-내려받기준비)에서 찾아 처리하세요. 플러그인 설치(3단계)는 먼저 진행해도 됩니다.

> VisionPro가 설치된 PC는 help 추출 때문에 수 분 더 걸립니다. 화면이 멈춘 것처럼 보여도 기다리세요. 추출 위치는 `%USERPROFILE%\.claude\tools\cognex-doc\VisionPro\html`입니다.

---

### 3단계. 플러그인 설치

같은 PowerShell 창에서 계속 진행합니다.

**① Anthropic 공식 플러그인 목록(마켓플레이스)을 등록합니다.** 함께 설치되는 Superpowers와 csharp-lsp가 여기에 있습니다. `Successfully added marketplace` 또는 `already on disk`가 나오면 성공입니다. (이미 등록된 PC에서 실행해도 괜찮습니다)
```powershell
claude plugin marketplace add anthropics/claude-plugins-official
```

> ⚠️ 이 단계를 빼먹으면 vision-dev가 **"failed to load"** 상태가 되어 아무 기능도 동작하지 않습니다.

**② vision-dev 플러그인 목록(마켓플레이스)을 등록합니다.** `Successfully added marketplace`가 나오면 성공입니다.
```powershell
claude plugin marketplace add hdvisionrnd1/vision-dev-kit
```

**③ 플러그인을 설치합니다.** `Successfully installed plugin: vision-dev ... (+ 2 dependencies: superpowers, csharp-lsp)`가 나오면 성공입니다.
```powershell
claude plugin install vision-dev@vision-dev-kit
```

> Claude Code 안에서 설치하고 싶다면 위 세 명령의 `claude plugin`을 `/plugin`으로 바꿔서 한 줄씩 입력해도 됩니다.

---

### 4단계. 설치 확인

**① 설치된 플러그인을 확인합니다.** `vision-dev`, `superpowers`, `csharp-lsp` 세 개가 모두 `✔ enabled`면 정상입니다.
```powershell
claude plugin list
```

**② vision-dev 구성을 확인합니다.** `Skills (2)`, `Hooks (2)`, `MCP servers (2)`가 보이면 정상입니다.
```powershell
claude plugin details vision-dev@vision-dev-kit
```

**③ MCP 연결을 확인합니다.** `plugin:vision-dev:mslearn`과 `plugin:vision-dev:context7` 옆에 `✔ Connected`가 보이면 정상입니다.
```powershell
claude mcp list
```

---

### 5단계. Claude Code 다시 시작

이미 Claude Code를 켜 두었다면 `/exit`를 입력해 종료하거나 창을 닫으세요. 그다음 아래 명령으로 다시 실행합니다. 다시 시작해야 플러그인이 적용됩니다.
```powershell
claude
```

설치가 끝났습니다. 어떻게 쓰는지는 [사용 방법](#사용-방법)을 보세요.

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

**개발 절차** (Superpowers)
```
검사 결과를 CSV로 저장하는 기능 만들고 싶어
정리된 내용으로 계획 세우고 구현해줘
PLC 통신이 가끔 끊기는데 원인 찾아줘
```
- 첫 번째처럼 새 기능을 말하면 바로 코딩하지 않고 질문으로 요구사항부터 정리합니다.
- 요구사항이 정리되면 작업 계획서를 쓰고 단계별로 구현합니다.
- 버그는 추측으로 고치지 않고 원인부터 체계적으로 추적합니다.

판정·계산·통신 로직은 테스트를 먼저 쓰고, UI·장비 코드는 테스트 없이 진행합니다([팀 규칙](#팀-규칙)). 이번 작업만 다르게 하고 싶으면 "이번엔 테스트 없이 진행해"처럼 말하면 됩니다.

### 스킬을 직접 부르기
자동으로 불리지 않을 때는 슬래시 명령으로 직접 부를 수 있습니다.
```
/vision-dev:mil-lookup
/vision-dev:visionpro-lookup
/superpowers:brainstorming
/superpowers:systematic-debugging
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

### 팀 규칙

세션이 시작될 때마다 Hook이 아래 규칙을 Claude에게 알려 줍니다. 각자 CLAUDE.md에 따로 적지 않아도 모든 팀원에게 같은 규칙이 적용됩니다.

| 규칙 | 내용 |
|---|---|
| C# 코드 스타일 | 삼항연산자 금지, 한 줄 if 금지, 항상 블록 if/else (위 스타일 Hook으로 한 번 더 검사) |
| TDD 적용 | 검사 판정, 좌표·단위 변환·캘리브레이션 계산, 통신 프로토콜 파싱, 시퀀스·상태 전이, 레시피 검증 |
| TDD 제외 (미리 허락) | UI(Designer, XAML), 카메라 Grab·MIL/VisionPro 초기화, 모터·IO·PLC 실제 입출력, 자동 생성 코드, 실험 코드 |
| 섞여 있을 때 | 장비·UI 코드 속의 판단 로직은 별도 클래스로 분리해 TDD로 작성. 장비는 `ICamera`, `IPlc` 같은 인터페이스로 감싸 가짜 구현으로 테스트 |
| 테스트 환경 | 기존 테스트 프레임워크(xUnit/NUnit/MSTest)를 따름. 테스트 프로젝트가 없으면 만들기 전에 먼저 물어봄 |
| 문서 조회 | MIL·VisionPro API는 추측하지 않고 vision-dev 스킬로 확인 |

Superpowers는 원래 "TDD 예외는 매번 사용자에게 허락받으라"고 되어 있습니다. 팀 규칙이 **"UI·장비 코드는 미리 허락된 예외"**라고 알려 주기 때문에 매번 묻지 않고 바로 진행합니다.

규칙 원문은 `plugins/vision-dev/hooks/team-rules/rules.md`입니다.

### 함께 설치되는 플러그인

| 플러그인 | 출처 | 하는 일 |
|---|---|---|
| `superpowers` | Anthropic 공식 마켓플레이스 ([원본](https://github.com/obra/superpowers)) | 개발 절차 스킬. 상황에 맞는 스킬을 Claude가 알아서 고름 |
| `csharp-lsp` | Anthropic 공식 마켓플레이스 | `csharp-ls` 언어 서버를 연결해 C# 코드 분석 정확도를 높임 |

두 플러그인은 vision-dev의 **의존성**으로 연결되어 있습니다. 원본 플러그인을 그대로 설치하는 것이라 업데이트도 각 원본에서 받습니다.

> ⚠️ Superpowers는 "어떻게 작업할지"를 정하는 플러그인입니다. **oh-my-claudecode 같은 다른 작업 절차 플러그인과 함께 켜면 지침이 충돌**합니다. 쓰고 있었다면 [OMC가 설치된 PC](#omcoh-my-claudecode가-설치된-pc)를 따라 꺼 주세요.

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

### 팀 규칙 끄기
```json
{
  "env": {
    "VISION_DEV_TEAM_RULES": "off"
  }
}
```
끄면 Superpowers의 기본 동작으로 돌아갑니다. 모든 코드에 TDD를 적용하려 하고, 예외가 필요할 때마다 허락을 구합니다.

두 설정을 함께 쓸 때는 `"env"` 하나에 같이 넣습니다.
```json
{
  "env": {
    "VISION_DEV_STYLE_HOOK": "off",
    "VISION_DEV_TEAM_RULES": "off"
  }
}
```

### 경로 변경 (기본 위치가 아닐 때)
| 환경변수 | 기본값 | 용도 |
|---|---|---|
| `MIL_DOC_DIR` | `C:\Program Files\Matrox Imaging\MIL\DOC\mil_help\content\Reference` | MIL 레퍼런스 폴더 |
| `COGNEX_HELP_DIR` | `%USERPROFILE%\.claude\tools\cognex-doc\VisionPro\html` | 추출한 VisionPro help 폴더 |
| `VISIONPRO_DIR` | `C:\Program Files\Cognex\VisionPro` | VisionPro 설치 폴더 (다른 드라이브에 설치한 경우) |
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
새 버전이 올라오면 아래 명령을 **한 줄씩** 실행하고 Claude Code를 재시작합니다.

모든 플러그인 목록을 최신으로 받기:
```powershell
claude plugin marketplace update
```

vision-dev 업데이트:
```powershell
claude plugin update vision-dev@vision-dev-kit
```

Superpowers 업데이트:
```powershell
claude plugin update superpowers@claude-plugins-official
```

csharp-lsp 업데이트:
```powershell
claude plugin update csharp-lsp@claude-plugins-official
```

### 제거
아래 명령을 **한 줄씩** 실행합니다.

vision-dev 제거:
```powershell
claude plugin uninstall vision-dev@vision-dev-kit
```

함께 설치됐던 Superpowers·csharp-lsp 정리 (다른 플러그인이 쓰지 않을 때만 제거됨). 지울 목록이 나오고 확인을 물으면 `y`를 입력하세요.
```powershell
claude plugin prune
```

vision-dev 목록 등록 해제:
```powershell
claude plugin marketplace remove vision-dev-kit
```
아래 항목은 플러그인을 제거해도 남아 있으니, 필요 없으면 직접 지우세요.
- VisionPro help: `%USERPROFILE%\.claude\tools\cognex-doc`
- 색인: `%USERPROFILE%\.claude\cache\vision-dev`
- ast-grep: `npm uninstall -g @ast-grep/cli`
- csharp-ls: `dotnet tool uninstall --global csharp-ls`

---

## 문제 해결

> 오류 메시지의 앞부분을 복사해서 **Ctrl + F**로 이 섹션에서 찾으세요.
> 같은 오류라도 Windows 언어에 따라 영어 또는 한국어로 나옵니다.

### 자동 설치기

**`Invoke-RestMethod : 원격 이름을 확인할 수 없습니다`** / **`The remote name could not be resolved`** / **`irm : ...`**
- 인터넷에 연결되지 않았거나 회사 방화벽·프록시가 `raw.githubusercontent.com`을 막고 있습니다. 브라우저로 GitHub이 열리는지 확인하세요.
- 회사 네트워크에서 계속 안 되면 [수동 설치](#수동-설치)를 따라 하세요.

**`기본 연결이 닫혔습니다`** / **`The underlying connection was closed`** / **`보안 채널을 만들 수 없습니다`** / **`Could not create SSL/TLS secure channel`**
- 오래된 Windows 10의 PowerShell이 GitHub 접속에 필요한 TLS 1.2를 기본으로 쓰지 않아서 생깁니다. 아래 한 줄로 실행하세요.
```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; irm https://raw.githubusercontent.com/hdvisionrnd1/vision-dev-kit/main/install.ps1 | iex
```

**`[FAIL] winget is not available on this PC.`**
- Microsoft Store에서 **"앱 설치 관리자"(App Installer)**를 설치하거나 업데이트한 뒤 설치기를 다시 실행하세요.

**`[FAIL] ... was not detected after installing.`**
- 프로그램은 설치됐지만 이 창에서 아직 인식되지 않은 경우가 대부분입니다. **PowerShell 창을 닫고 새로 연 뒤** 설치기를 다시 실행하세요.

**`[FAIL] Required programs are missing: ...`**
- 필수 프로그램(Git, Node.js, Claude Code) 설치를 `N`으로 건너뛰었거나 설치에 실패한 경우입니다. 설치기를 다시 실행해서 `Y`로 답하거나, 아래 [1단계 표](#1단계-필수-프로그램)의 명령으로 직접 설치하세요.

**`[FAIL] ...\vision-dev-kit already exists and is not a git download.`**
- 같은 이름의 폴더가 이미 있는데 git으로 받은 것이 아닙니다(예: ZIP으로 받아서 압축을 푼 폴더). 그 폴더의 이름을 바꾸거나 지운 뒤 설치기를 다시 실행하세요.

**`[FAIL] git clone failed.`**
- 아래 [2단계](#2단계-내려받기준비)의 `Permission denied`, `Could not resolve host` 항목을 보세요.

**`[WARN] could not update (local changes?)`**
- `vision-dev-kit` 폴더 안의 파일을 직접 고친 경우입니다. 설치는 기존 파일로 계속 진행됩니다. 최신으로 받고 싶으면 그 폴더를 지우고 설치기를 다시 실행하세요.

**`[WARN] PowerShell is running as Administrator.`**
- 관리자 권한 창에서 실행했습니다. 대부분 그대로 진행되지만, 문제가 생기면 창을 닫고 [0단계](#0단계-powershell-열기)처럼 일반 PowerShell에서 다시 실행하세요.

**5/5 Verify에서 `[FAIL] ... is not installed` 또는 `a plugin failed to load`**
- 설치기를 한 번 더 실행하세요. 그래도 같으면 아래 [3단계 (플러그인 설치)](#3단계-플러그인-설치-1)와 [4단계 (설치 확인)](#4단계-설치-확인-1) 항목을 보거나 로그 파일(`%USERPROFILE%\vision-dev-install.log`)을 보내 주세요.

**install.bat을 더블클릭했더니 "Windows의 PC 보호" 창이 뜸**
- 인터넷에서 받은 파일이라 나오는 경고입니다. **추가 정보 → 실행**을 누르세요.

### 1단계 (필수 프로그램)

**`The term 'git' is not recognized ...` / `'git' 용어가 cmdlet, 함수, 스크립트 파일 또는 실행할 수 있는 프로그램 이름으로 인식되지 않습니다`**
(`git` 대신 `node`, `npm`, `claude`, `dotnet`이 나와도 같은 경우입니다.)
- 그 프로그램이 설치되지 않았거나, 방금 설치해서 아직 PowerShell 창에 반영되지 않은 상태입니다.
- 아래 표의 명령으로 설치한 뒤 **PowerShell 창을 닫고 다시 여세요.**

| 인식되지 않는 명령 | 설치 방법 |
|---|---|
| `git` | `winget install Git.Git` |
| `node`, `npm` | `winget install OpenJS.NodeJS.LTS` |
| `dotnet` | `winget install Microsoft.DotNet.SDK.10` |
| `claude` | [Claude Code 홈페이지](https://claude.com/claude-code)의 설치 안내 |

**`winget` 자체가 인식되지 않음**
- Microsoft Store에서 **"앱 설치 관리자"(App Installer)**를 설치하거나 업데이트하세요.
- 또는 각 홈페이지에서 설치 파일을 받으세요: [Git](https://git-scm.com/download/win), [Node.js](https://nodejs.org/), [.NET SDK](https://dotnet.microsoft.com/download)

### 2단계 (내려받기·준비)

**`fatal: could not create work tree dir 'vision-dev-kit': Permission denied`**
- 현재 폴더에 쓰기 권한이 없다는 뜻입니다. `pwd`로 위치를 확인하세요.
- `C:\Windows\System32`, `C:\Program Files`, `C:\`라면 → `cd $env:USERPROFILE`로 이동한 뒤 다시 clone하세요.
- 홈 폴더에서도 같은 오류가 나면 Windows 보안의 **제어된 폴더 액세스**(랜섬웨어 방지)가 막고 있는 경우입니다. 다음 둘 중 하나로 해결합니다.
  - `mkdir C:\dev; cd C:\dev`처럼 보호 대상이 아닌 폴더에서 clone하기
  - Windows 보안 → 바이러스 및 위협 방지 → 랜섬웨어 방지 → "앱이 제어된 폴더 액세스를 통과하도록 허용"에 `git.exe` 추가하기

**`fatal: destination path 'vision-dev-kit' already exists and is not an empty directory.`**
- 이미 내려받은 적이 있다는 뜻입니다. 오류가 아니니 그 폴더로 이동해서 최신 내용으로 갱신한 뒤 ④부터 진행하세요.
```powershell
cd vision-dev-kit
```
```powershell
git pull
```

**`fatal: unable to access 'https://github.com/...': Could not resolve host`** 또는 **`Failed to connect`**
- 인터넷에 연결되지 않았거나 회사 방화벽·프록시가 GitHub을 막고 있습니다.
- 브라우저로 https://github.com 이 열리는지 확인하세요. 회사 네트워크라면 IT 담당자에게 `github.com` 접속 허용을 요청하세요.

**`The argument '.\scripts\setup.ps1' to the -File parameter does not exist`** / **`-File 매개 변수에 대한 인수 '.\scripts\setup.ps1'이(가) 없습니다`**
- `vision-dev-kit` 폴더 안에서 실행하지 않았다는 뜻입니다. 아래로 이동한 뒤 다시 실행하세요.
```powershell
cd $env:USERPROFILE\vision-dev-kit
```

**`cannot be loaded because running scripts is disabled on this system`** / **`이 시스템에서 스크립트를 실행할 수 없으므로 ... 파일을 로드할 수 없습니다`**
- 실행 정책 때문에 막힌 것입니다. 명령에 `-ExecutionPolicy Bypass`가 빠지지 않았는지 확인하고 README의 명령을 그대로 복사해서 실행하세요.
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

**setup 화면: `FAILED: Node.js is not installed.`**
- `winget install OpenJS.NodeJS.LTS`로 설치하고, PowerShell 창을 다시 연 뒤 setup을 다시 실행하세요.

**setup 화면: `skipped: .NET SDK 8 found, but csharp-ls needs .NET 10 SDK.`** 또는 **`skipped: .NET SDK not found.`**
- csharp-ls와 ilspycmd는 **.NET 10 SDK**가 있어야 설치됩니다. 기존 SDK를 지우지 않고 나란히 설치됩니다.
```powershell
winget install Microsoft.DotNet.SDK.10
```
- 설치 후 PowerShell 창을 다시 열고 setup을 다시 실행하세요.
- 이 단계가 건너뛰어져도 플러그인의 나머지 기능은 동작합니다. C# 코드 분석(csharp-lsp)만 동작하지 않습니다.

**`도구의 NuGet 패키지에 있는 설정 파일이 잘못되었습니다 ... 'DotnetToolSettings.xml'을 찾지 못했습니다`** / **`'csharp-ls' 도구를 설치하지 못했습니다`**
- `dotnet tool install`을 직접 실행했는데 .NET 10 SDK가 없을 때 나오는 메시지입니다. 위 항목처럼 .NET 10 SDK를 설치하세요.

**setup 화면: `FAILED: npm i -g @ast-grep/cli`** 또는 **`FAILED: dotnet tool install --global ...`**
- 인터넷 또는 회사 프록시 문제입니다. `registry.npmjs.org`(npm), `api.nuget.org`(dotnet) 접속이 막혀 있지 않은지 확인한 뒤 setup을 다시 실행하세요.

**setup 화면: `7-Zip not found. Install it first: winget install 7zip.7zip`**
- VisionPro help를 추출하려면 7-Zip이 필요합니다. 아래를 한 줄씩 실행하세요.
```powershell
winget install 7zip.7zip
```
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\extract-cognex-help.ps1
```

**setup 화면: `VisionPro help not found: ...VisionPro.Documentation.chm`**
- VisionPro가 기본 위치가 아닌 곳에 설치된 경우입니다. 탐색기에서 `VisionPro.Documentation.chm` 파일을 찾아 경로를 지정하세요.
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\extract-cognex-help.ps1 -ChmPath "D:\Cognex\VisionPro\Doc\en\VisionPro.Documentation.chm"
```
- 영어가 아닌 help를 추출하려면 `-Lang ja` 또는 `-Lang zh-Hans`를 붙이세요.

**setup 화면: `oh-my-claudecode (OMC) found` ... `turned off automatically`**
- 오류가 아닙니다. Superpowers와 충돌하는 OMC를 자동으로 끈 것입니다. 상태 표시줄(HUD)은 그대로 유지됩니다. 자세한 내용은 [OMC가 설치된 PC](#omcoh-my-claudecode가-설치된-pc)를 보세요.

**setup 화면 마지막: `Setup finished, but these steps need attention:`** (노란 글씨)
- 바로 아래 목록에 처리할 항목이 나옵니다. 위 항목들에서 같은 내용을 찾아 해결하고, setup을 다시 실행하면 됩니다.
- 플러그인 설치(3단계)는 먼저 진행해도 괜찮습니다.

### 3단계 (플러그인 설치)

**`Failed to clone marketplace repository: SSH authentication failed`** / **`Permission denied (publickey)`**
- 대부분 **저장소 이름 오타**입니다. `hdvisionrnd1/vision-dev-kit`, `anthropics/claude-plugins-official` 철자를 확인하세요. README의 복사 버튼으로 복사하면 정확합니다.
- 철자가 맞는데도 같은 오류가 나면 HTTPS 주소로 등록하세요.
```powershell
claude plugin marketplace add https://github.com/hdvisionrnd1/vision-dev-kit.git
```
```powershell
claude plugin marketplace add https://github.com/anthropics/claude-plugins-official.git
```

**`Cannot add marketplace "vision-dev-kit": its network source differs from the one declared for it in settings`**
- 예전에 다른 주소(로컬 폴더나 다른 URL)로 등록한 적이 있다는 뜻입니다. 등록을 해제하고 다시 등록한 뒤 **다시 설치**하세요. (등록을 해제하면 vision-dev도 함께 제거되기 때문입니다)
```powershell
claude plugin marketplace remove vision-dev-kit
```
```powershell
claude plugin marketplace add hdvisionrnd1/vision-dev-kit
```
```powershell
claude plugin install vision-dev@vision-dev-kit
```

**`Plugin "vision-dev" not found in marketplace "vision-dev-kit"`**
- 3단계 ②(vision-dev 마켓플레이스 등록)를 건너뛰었거나, 목록이 오래된 경우입니다.
- ②를 안 했다면 ②부터 다시 진행하세요. 이미 했다면 목록을 갱신한 뒤 다시 설치하세요.
```powershell
claude plugin marketplace update vision-dev-kit
```
```powershell
claude plugin install vision-dev@vision-dev-kit
```

**`is already installed`**, **`already on disk`**, **`already at the latest version`**
- 오류가 아닙니다. 이미 설치·등록되어 있거나 최신 상태라는 뜻이니 다음 단계로 넘어가세요.

### 4단계 (설치 확인)

**`claude plugin list`에서 vision-dev가 `✘ failed to load` (`Dependency "superpowers@claude-plugins-official" is not installed`)**
- 공식 마켓플레이스가 등록되지 않은 상태로 설치한 경우입니다. 아래를 한 줄씩 실행한 뒤 Claude Code를 재시작하세요.
```powershell
claude plugin marketplace add anthropics/claude-plugins-official
```
```powershell
claude plugin uninstall vision-dev@vision-dev-kit
```
```powershell
claude plugin install vision-dev@vision-dev-kit
```

**`claude mcp list`에서 MCP가 `✘ Failed to connect`**
- 회사 방화벽이나 프록시가 `learn.microsoft.com`, `mcp.context7.com`을 막고 있지 않은지 확인하세요.
- MCP가 연결되지 않아도 나머지 기능은 동작합니다.

### 사용 중

**세션 시작 때 `[vision-dev] oh-my-claudecode(OMC)가 켜져 있어 Superpowers와 작업 지침이 충돌합니다`**
- OMC가 아직 켜져 있습니다. [OMC가 설치된 PC](#omcoh-my-claudecode가-설치된-pc)를 따라 끄세요.

**`[vision-dev] ast-grep이 없어 C# 스타일 검사를 건너뜁니다`**
- ast-grep이 설치되지 않았습니다. 설치한 뒤 Claude Code를 다시 시작하세요.
```powershell
npm i -g @ast-grep/cli
```

**스타일 검사가 동작하지 않음 (메시지도 없음)**
- `ast-grep --version`이 실행되는지 확인하세요.
- `VISION_DEV_STYLE_HOOK`이 `off`로 설정되어 있지 않은지 확인하세요.
- Hook 목록은 Claude Code의 `/hooks` 메뉴에서 볼 수 있습니다.

**C# 코드 분석(csharp-lsp)이 동작하지 않음**
- `csharp-ls --version`이 실행되는지 확인하세요. 안 되면 [.NET 10 SDK 항목](#2단계-내려받기준비)을 따라 설치하세요.
- 설치한 뒤에는 PowerShell과 Claude Code를 모두 다시 여세요.

**TDD 관련 동작이 이상함 (UI 코드에도 테스트를 쓰려고 하거나, 매번 허락을 물어봄)**
- `VISION_DEV_TEAM_RULES`가 `off`로 설정되어 있지 않은지 확인하세요.
- OMC 같은 다른 작업 절차 플러그인이 켜져 있으면 끄세요 (`claude plugin list`로 확인).

**스킬이 안 보이거나 자동으로 불리지 않음**
- Claude Code를 재시작했는지 확인하세요.
- `claude plugin details vision-dev@vision-dev-kit`로 설치 상태를 확인하세요.
- `/vision-dev:mil-lookup`처럼 직접 불러서 써 보세요.

**`이 PC에는 Cognex VisionPro가 설치되어 있지 않습니다`**
- 정상입니다. VisionPro가 없는 PC라서 VisionPro 문서를 조회할 수 없다는 뜻입니다. 나머지 기능은 그대로 동작합니다.
- VisionPro를 `C:\Program Files`가 아닌 곳에 설치했다면 `VISIONPRO_DIR`에 설치 폴더를 지정하세요.

**`VisionPro help(HTML)가 아직 추출되지 않았습니다`**
- VisionPro는 있는데 help만 추출되지 않은 상태입니다. 자동 설치기를 다시 실행하거나 `scripts\extract-cognex-help.ps1`을 실행하세요 (7-Zip 필요). 다른 위치에 추출했다면 `COGNEX_HELP_DIR`을 지정하세요.

**`MIL 레퍼런스 폴더가 없습니다`**
- MIL이 설치되어 있지 않거나 다른 위치에 설치된 경우입니다. 다른 위치라면 `MIL_DOC_DIR`을 지정하세요.

**`[cogdoc] 제목 색인 최초 생성 중`** (첫 VisionPro 검색이 오래 걸림)
- 정상입니다. 제목 색인을 처음 만드는 중입니다 (수 분). 두 번째부터는 즉시 검색됩니다.

### OMC(oh-my-claudecode)가 설치된 PC

oh-my-claudecode(OMC)와 Superpowers는 둘 다 "Claude가 어떻게 작업할지"를 지시하는 도구라서, 함께 켜면 지침이 충돌합니다.
OMC는 플러그인 외에 `%USERPROFILE%\.claude\CLAUDE.md`에도 자기 지침 블록을 써 넣기 때문에, **플러그인만 끄면 지침이 남습니다.** 두 가지를 모두 처리해야 합니다.

**방법 1. 자동 (기본)**
[자동 설치](#자동-설치)를 실행하면 **묻지 않고 자동으로** 처리됩니다. 이미 설치했다면 설치기를 한 번 더 실행하면 됩니다.
- OMC 플러그인을 **끄기만** 합니다(삭제하지 않음).
- CLAUDE.md는 `CLAUDE.md.bak-before-vision-dev-날짜시간`으로 백업한 뒤 OMC 블록만 지웁니다. 직접 적어 둔 내용은 그대로 남습니다.
- **화면 아래 상태 표시줄(OMC HUD)은 건드리지 않습니다.** 플러그인이 꺼져도 HUD는 계속 표시됩니다.
- 설치기 마지막 확인 단계에 `[OK] oh-my-claudecode@omc is disabled (no conflict)`가 나오면 완료입니다.

**OMC를 끄지 않으려면** (권장하지 않음)
설치기를 실행하기 전에 아래를 먼저 실행하면 OMC를 그대로 둡니다. 이 경우 Superpowers와 지침이 충돌한다는 경고가 계속 나옵니다.
```powershell
$env:VISION_DEV_KEEP_OMC = "1"
```

**방법 2. 수동**

① OMC 플러그인 이름을 확인합니다. 보통 `oh-my-claudecode@omc`입니다.
```powershell
claude plugin list
```

② OMC를 끕니다. (①에서 확인한 이름이 다르면 그 이름으로 바꾸세요)
```powershell
claude plugin disable oh-my-claudecode@omc
```

③ CLAUDE.md를 백업합니다.
```powershell
Copy-Item $env:USERPROFILE\.claude\CLAUDE.md $env:USERPROFILE\.claude\CLAUDE.md.bak
```

④ 메모장으로 CLAUDE.md를 엽니다.
```powershell
notepad $env:USERPROFILE\.claude\CLAUDE.md
```

⑤ `<!-- OMC:START -->` 줄부터 `<!-- OMC:END -->` 줄까지 지우고 저장합니다. 그 아래에 직접 적어 둔 내용은 지우지 마세요.

⑥ Claude Code를 다시 시작합니다. 세션 시작 때 `[vision-dev] oh-my-claudecode(OMC)가 켜져 있어...` 경고가 더 이상 나오지 않으면 완료입니다.

**OMC로 되돌리고 싶을 때**
```powershell
claude plugin enable oh-my-claudecode@omc
```
그다음 CLAUDE.md를 백업 파일로 되돌리세요. 이 상태에서는 Superpowers와 다시 충돌하므로, OMC를 계속 쓸 거라면 vision-dev를 제거하는 것이 좋습니다([제거](#제거) 참고).

> 참고: OMC를 꺼도 화면 아래 상태 표시줄(HUD)은 그대로 동작합니다. HUD는 Claude Code 설정(`statusLine`)에서 따로 실행되는 표시 기능이라 OMC 플러그인이 꺼져 있어도 상관없습니다.

---

## 주의 사항
- **Cognex help 문서는 이 저장소에 포함하지 않습니다.** Cognex의 라이선스 문서이므로 각자 PC에 설치된 VisionPro에서 `scripts/extract-cognex-help.ps1`로 추출합니다. 추출한 파일을 다른 곳에 재배포하지 마세요.
- 문서는 **각 PC에 설치된 MIL/VisionPro 버전 기준**입니다. 프로젝트에서 쓰는 라이브러리 버전과 다르면 결과가 다를 수 있습니다.
- MCP 서버(`mslearn`, `context7`)는 외부 서비스입니다. 질문 내용 중 검색어가 해당 서비스로 전송됩니다.
- Superpowers와 csharp-lsp는 각 원작자가 관리하는 플러그인입니다. 동작이 바뀌면 각 원본 저장소의 변경 내역을 확인하세요.
