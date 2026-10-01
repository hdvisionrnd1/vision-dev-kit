---
name: visionpro-lookup
description: Cognex VisionPro API(CogBlobTool, CogPMAlignTool, CogToolBlock, CogImage8Grey, CogAcqFifo, CogDisplay 등 Cog로 시작하는 클래스)의 사용법·속성·메서드·개념을 로컬 문서와 샘플에서 확인할 때 사용. VisionPro 코드를 작성·수정·리뷰하거나 관련 질문에 답하기 전에 먼저 불러올 것.
---

# VisionPro 문서 조회

추측으로 Cognex API를 쓰지 말고 아래 순서로 확인한다.
아래 `<SKILL_DIR>`은 이 스킬이 로드될 때 표시되는 Base directory다.

## 1. 빠른 시그니처 — IntelliSense XML
```
C:\Program Files\Cognex\VisionPro\ReferencedAssemblies\<네임스페이스>.xml
```
예: `Cognex.VisionPro.Blob.xml`에서 Grep `T:Cognex.VisionPro.Blob.CogBlobTool"` 또는 `M:Cognex.VisionPro.Blob.CogBlobTool.Run`.
접두사: `T:` 타입, `M:` 메서드, `P:` 속성, `E:` 이벤트, `F:` 필드.

## 2. 상세 설명·개념 — 추출된 help (HTML)
기본 위치: `%USERPROFILE%\.claude\tools\cognex-doc\VisionPro\html` (환경변수 `COGNEX_HELP_DIR`로 변경 가능)
없으면 사용자에게 vision-dev-kit 저장소의 `scripts\extract-cognex-help.ps1` 실행을 안내하고, 그동안은 1·3번으로 확인한다.

파일명 규칙: `T_/M_/P_/E_/F_` + 네임스페이스·타입·멤버를 `_`로 연결
(예: `T_Cognex_VisionPro_Blob_CogBlobTool.htm`, `P_Cognex_VisionPro_Blob_CogBlobTool_RunParams.htm`).
GUID 이름의 파일은 **개념/사용법 문서**(예: "Blob Tool", "PMAlign") — 툴 동작 원리나 파라미터 의미는 여기가 가장 자세하다.

검색과 본문 추출은 스크립트로 한다 (원본 HTML을 직접 Read하지 말 것):
```bash
node "<SKILL_DIR>/scripts/cogdoc.mjs" find blob tool          # 제목 검색 (개념 문서 → 타입 → 멤버 순)
node "<SKILL_DIR>/scripts/cogdoc.mjs" text T_Cognex_VisionPro_Blob_CogBlobTool
node "<SKILL_DIR>/scripts/cogdoc.mjs" text <GUID파일명> threshold   # 키워드 주변만
```
첫 `find` 실행 시 제목 색인(`%USERPROFILE%\.claude\cache\vision-dev\cognex-titles.tsv`)을 만드느라 수 분 걸린다. 이후에는 즉시 검색된다.
help를 다시 추출했다면 이 색인 파일을 지우면 다음 `find` 때 재생성된다.

## 3. 공식 C# 샘플
```
C:\Program Files\Cognex\VisionPro\samples\Programming\<주제>
```
주제 폴더: Acquisition, ToolBlock, Inspection, Calibration, Fixture, Graphics, IO, TCPIP, Color, 3D, DynamicControls, ErrorHandle, LoadPersistedTool 등.
Acquisition(CogAcqFifo), ToolBlock 입출력, 그래픽 오버레이, .vpp 로드/저장 패턴은 샘플 기준으로 작성.

## 4. 문서로 부족할 때
```bash
ilspycmd -t Cognex.VisionPro.Blob.CogBlobTool "C:/Program Files/Cognex/VisionPro/ReferencedAssemblies/Cognex.VisionPro.Blob.dll"
ilspycmd -l c "C:/Program Files/Cognex/VisionPro/ReferencedAssemblies/Cognex.VisionPro.Blob.dll"   # 클래스 목록
```
(`dotnet tool install -g ilspycmd` 필요)

## 주의
- 스크립트가 "VisionPro가 설치되어 있지 않습니다"라고 하면 이 PC에는 확인할 로컬 문서가 없다. 추측으로 API를 쓰지 말고 사용자에게 먼저 알린다. 그래도 일반 지식으로 작성해 달라고 하면, 로컬 문서로 검증하지 못한 코드라는 점을 분명히 밝힌다.
- 문서는 이 PC에 설치된 VisionPro 버전 기준이다.
- 답변/코드에 사용한 API는 어느 문서·샘플에서 확인했는지 근거를 짧게 남긴다.
