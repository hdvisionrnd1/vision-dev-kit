---
name: mil-lookup
description: Matrox MIL / MIL.NET 함수(MbufAlloc2d, MdigProcess, MimBinarize, MblobCalculate 등 M으로 시작하는 함수, M_ 상수)의 시그니처·파라미터·동작·제약을 로컬 문서에서 확인할 때 사용. MIL 코드를 작성·수정·리뷰하거나 MIL 관련 질문에 답하기 전에 먼저 불러올 것.
---

# MIL 문서 조회

추측으로 MIL 파라미터/상수를 쓰지 말고 아래 순서로 로컬 문서를 확인한다.
아래 `<SKILL_DIR>`은 이 스킬이 로드될 때 표시되는 Base directory다.

## 1. C# 시그니처 (가장 빠름)
MIL.NET IntelliSense XML:
```
C:\Program Files\Matrox Imaging\MIL\MIL.NET\Matrox.MatroxImagingLibrary.xml
```
Grep 패턴 예: `M:Matrox.MatroxImagingLibrary.MIL.MbufAlloc2d(` → 오버로드별 summary/param 확인.

## 2. 상세 레퍼런스 (파라미터 표, 상수 조합, 제약, Remarks)
위치: `C:\Program Files\Matrox Imaging\MIL\DOC\mil_help\content\Reference\<모듈>\<함수명>.htm`
(모듈 폴더: buf, dig, disp, im, app, sys, gra, blob, mod, pat, meas, cal, code, ocr, str, met, edge, col, reg, seq, thr, func, class, 3d* 등)

**원본 .htm을 Read로 직접 읽지 말 것** — 파일당 수백 KB이며 대부분 스크립트다. 반드시 추출 스크립트를 쓴다:
```bash
node "<SKILL_DIR>/scripts/miltext.mjs" MbufAlloc2d            # 본문 전체 (원본의 약 1/8 크기)
node "<SKILL_DIR>/scripts/miltext.mjs" MbufAlloc2d M_GRAB     # 키워드 주변만
```
함수명만 주면 모든 모듈 폴더에서 찾는다. 본문이 길면 키워드 모드로 필요한 상수/파라미터 부분만 본다.
MIL이 기본 위치가 아니면 환경변수 `MIL_DOC_DIR`에 Reference 폴더 경로를 지정한다.

## 3. 공식 C# 예제
```
C:\Users\Public\Documents\Matrox Imaging\MIL\Examples\**\C#\*.cs
```
Glob/Grep으로 함수명을 검색해 실제 호출 순서·해제 순서·콜백(MdigProcess hook) 패턴을 확인.

## 4. 문서로 부족할 때
```bash
ilspycmd -t Matrox.MatroxImagingLibrary.MIL "C:/Program Files/Matrox Imaging/MIL/MIL.NET/Matrox.MatroxImagingLibrary.dll" | grep -n -A20 "MbufAlloc2d"
```
(`dotnet tool install -g ilspycmd` 필요. .NET 래퍼 구현만 보이므로 네이티브 동작은 2번 문서를 기준으로 할 것)

## 주의
- 스크립트가 "MIL 레퍼런스 폴더가 없습니다"라고 하면 이 PC에는 MIL이 없거나 다른 위치에 있다. 추측으로 파라미터·상수를 쓰지 말고 사용자에게 먼저 알린다(다른 위치라면 `MIL_DOC_DIR` 지정). 그래도 일반 지식으로 작성해 달라고 하면, 로컬 문서로 검증하지 못한 코드라는 점을 분명히 밝힌다.
- 문서는 이 PC에 설치된 MIL 버전 기준이다(`Reference\index.json`의 version). 사용자 프로젝트의 MIL 버전과 다를 수 있으니 차이가 의심되면 언급.
- 답변/코드에 사용한 상수·파라미터는 어느 문서에서 확인했는지 근거를 짧게 남긴다.
