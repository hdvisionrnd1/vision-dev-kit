---
name: build-check
description: C# 솔루션/프로젝트(.sln, .csproj)의 빌드 성공 여부를 확인할 때 사용. C# 코드를 수정하고 완료를 보고하기 전, 사용자가 "빌드해 봐"라고 할 때, 빌드 오류·MSB3270 경고·BadImageFormatException·x86/x64/AnyCPU 플랫폼 문제를 볼 때 먼저 불러올 것.
---

# 빌드 확인

`dotnet build`나 MSBuild를 직접 부르지 말고 스크립트를 쓴다. 스크립트가 빌드 도구를 고르고, 출력을 요약하고, 결과 exe/dll이 실제로 32비트와 64비트 중 무엇으로 실행되는지 확인한다.
아래 `<SKILL_DIR>`은 이 스킬이 로드될 때 표시되는 Base directory다.

```bash
node "<SKILL_DIR>/scripts/build.mjs"                       # 현재 폴더의 .sln (하나일 때)
node "<SKILL_DIR>/scripts/build.mjs" "D:/proj/App.sln"     # 지정
node "<SKILL_DIR>/scripts/build.mjs" App.sln --config Release --platform x64
```

| 스크립트가 자동으로 하는 일 | 이유 |
|---|---|
| 구형 csproj가 있으면 Visual Studio MSBuild, 모두 SDK 스타일이면 `dotnet build` | VS에서 빌드하는 것과 같은 결과. VS MSBuild는 VS보다 새 .NET(예: .NET 10)을 빌드하지 못함 |
| `--platform`을 안 주면 x64 구성이 있을 때 x64 | MIL/VisionPro 참조는 64비트 전용인 경우가 많음 |
| NuGet 복원(packages.config 포함) | 처음 받은 프로젝트도 빌드되게 |

## 결과 읽기

| 첫 줄 | 할 일 |
|---|---|
| `BUILD OK` | 완료. 사용자가 장비·화면에서 확인할 항목을 짧게 정리해 전달한다 |
| `BUILD FAILED` | 오류를 고치고 다시 빌드한다. 이번 수정과 관계없는 기존 오류라면 고치기 전에 사용자에게 알린다 |
| `BUILD OK, 하지만 실행 시 실패 위험` | 빌드는 됐지만 32비트로 실행되는 exe가 64비트 전용 참조를 쓴다. 사용자에게 알리고 x64 구성으로 다시 빌드한다. csproj의 플랫폼 설정을 바꾸는 것은 사용자 확인 후에 한다 |
| `솔루션이 여러 개입니다` | 수정한 파일이 속한 솔루션을 골라 경로로 지정한다. 알 수 없으면 사용자에게 묻는다 |

- 경고는 이번에 수정한 파일에서 생긴 것만 언급한다. 나머지 기존 경고는 개수만 전한다.
- 출력의 `[x64]`, `[AnyCPU + 32비트 우선 → 32비트로 실행]` 등은 실제 실행 비트다. 플랫폼 문제를 설명할 때 이 값을 근거로 쓴다.

## 하지 말 것

- **빌드한 exe를 실행하지 않는다.** 장비 제어 프로그램은 실행만으로 카메라·모터·IO가 동작할 수 있다. 실행 확인은 사용자에게 맡긴다.
- 빌드가 안 된다고 csproj의 참조, 플랫폼, TargetFramework를 마음대로 바꾸지 않는다. 원인과 고칠 방법을 먼저 설명한다.

## 스크립트가 실패할 때

- `Visual Studio MSBuild를 찾지 못함`: 구형 프로젝트는 Visual Studio 또는 Build Tools가 필요하다. 다른 위치라면 환경변수 `MSBUILD_PATH`에 MSBuild.exe 경로를 지정한다.
- `NETSDK1045`(SDK가 대상 .NET을 지원하지 않음): 해당 .NET SDK를 설치해야 한다(`winget install Microsoft.DotNet.SDK.<버전>`).
