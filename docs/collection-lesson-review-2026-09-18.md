# 자료 수집·이해 단계 검토 (2026-09-18)

> 이 기록은 `ba07dd7` 시점의 검토이다. 이후 단순화한 좌표·뉴런 계산 및 선 이동 실험은 [직접 조작·계산·연결지도 검토](multimedia-interaction-review-2026-09-18.md)를 따른다. 아래의 이전 교수용 수식과 실제 학습 이동 장면은 현재 이해 UI의 설명으로 사용하지 않는다.

## 반영한 동작

- 숫자·OMR·자율 그리기: 추가 시 원본 그림과 196칸 입력을 먼저 저장하고, 입력용 그림·미리보기만 비운다. OMR 안내 테두리는 남긴다. 저장된 자료와 선택한 클래스는 유지한다.
- 추가 버튼 옆 클래스 선택: 클래스 카드 선택과 같은 상태를 사용한다. 이름 변경·추가·삭제를 즉시 반영한다. 새 그림은 해당 클래스 맨 앞에 보인다.
- 웹캠: 같은 클래스 선택을 사용하되 촬영 후 영상을 끄거나 비우지 않는다. 계속 촬영하는 동작은 보존한다.
- 승부차기: 사진 위에서 공을 보낼 곳과 골키퍼가 막을 곳을 각각 선택한다. 두 선택을 마친 후 자료로 추가한다. 결과 지도 클릭으로 자료를 추가하지 않는다. 키보드 사용자를 위한 좌우 선택도 제공한다.

## 문제별 이해 단계 확인

| 문제 | 확인 내용 | 진행 조건 |
| --- | --- | --- |
| 숫자 그림 | 특징 계산 → 분포 탐색 → 뉴런·선 이동 → 출력·최종 경계 | 네 단계 확인을 모두 통과해야 연습 진입 |
| OMR | 같은 공통 흐름, OMR 자료로 특징·분포 확인 | 마지막 퀴즈만 풀어서는 앞 단계를 건너뛸 수 없음 |
| 웹캠 가위바위보 | 사진을 같은 그림 입력으로 다룸. 공통 특징 탐구·계산 활동 | 네 단계 확인 후에도 실제 연습은 그림 전체 입력 모드 유지 |
| 승부차기 | 사진 좌표 계산 → 한 뉴런 계산 → 두 신호·출력 계산 → 학습 방향 예측/관찰 | 각 단계 선택형 계산·퀴즈 통과. 마지막은 예측을 먼저 해야 재생 가능 |
| 자율 그리기·웹캠·숫자·텍스트 | 자료·클래스 설정 후 연습에서 특징/분포 또는 전체 그림 학습 | 앞선 사용자 요청대로 이해 단계는 의도적으로 생략 |

숫자·OMR의 두 특징 학습과 웹캠의 전체 그림 학습은 같은 계산이라고 설명하지 않는다. 웹캠의 전체 그림을 두 수만으로 완전히 설명할 수 있다고 주장하지 않는다.

문제 카드로 새 문제를 시작하면 앞 문제의 진도 잠금 해제 상태를 넘겨주지 않는다. 같은 문제에서 상단 목차로 복습하거나 자료를 다시 보는 경우는 기존 진도를 유지한다.

## 승부차기의 수학적 범위

1. 사진의 왼쪽 끝을 0, 가운데를 0.5, 오른쪽 끝을 1로 읽는다. 좌표는 `(사진의 좌우 위치 − 0.5) × 2`이다. 가로는 공, 세로는 골키퍼의 **좌우** 선택이다. 사진의 높이를 그래프 세로축으로 사용하지 않는다. 두 역할 모두 키커가 골대를 보는 방향을 사용하며, 골키퍼 역할이라고 좌우를 뒤집지 않는다.
2. 같은 쪽이면 막힘, 다른 쪽이면 골인 **수업용 규칙**이다. 실제 경기에서는 같은 방향이어도 골이 될 수 있다. 가운데 슛·높이·속도는 이 활동의 입력이 아니다.
3. 계산 예제의 연결값 1, −1과 더할 값 −0.25, 0.5는 이해를 위해 정한 값이다. 학습해서 얻은 최적값이 아니다.
4. 한 뉴런 예제는 `h1 = max(0, x+y−0.25)`, 골 점수는 `0.5−h1`이다. 네 대표 점 중 세 개를 맞힌다. 두 번째 뉴런 `h2 = max(0, −x−y−0.25)`를 더하면 골 점수 `0.5−h1−h2`로 네 대표 점 모두를 맞힌다. 이로써 임의로 더 수집한 모든 점까지 맞힌다고 보장하지 않는다.
5. 뉴런의 색 선은 그 뉴런의 **합이 0인 자리**, 검은 선은 **최종 골 점수가 0인 자리**이다. 선 자체가 뉴런이나 정답이라고 설명하지 않는다. 점 색은 정답, 배경색은 모델 예상이다.
6. 실제 이진 모델은 골 확률 하나를 계산하고 막힘 확률을 `1−골 확률`로 구한다. 공통 그래프의 두 점수 `[0,z]`는 고정 비교 기준 0과 실제 골 점수 z이다. `softmax([0,z])[1] = sigmoid(z)`를 수치 테스트했다. 두 개의 별도 학습 출력이 있다고 표현하지 않는다.
7. 선 이동 장면은 계산 예제와 다른 오답 시작 상태를 명시한다. 같은 한 점을 실제 `trainOne`으로 20회 학습한다. 두 뉴런과 출력의 연결값이 함께 바뀌되 관찰할 기준선은 하나만 표시한다. 화살표는 값이 증가하는 방향, 회색/보라 선 비교는 실제 이동이다. 모든 자료에서 같은 방향으로 이동하거나 전체 정답률이 반드시 증가한다고 주장하지 않는다.
8. 오차와 정답률은 기존처럼 구분한다. 이 장면은 글로벌 최적점이나 학습의 일반화 성공을 증명하지 않는다.

## 검증

- TypeScript 검사 통과.
- Vitest: 36개 파일, 167개 테스트 통과. 자료 스냅샷 보존·초기화, 추가 클래스 변경/삭제, 사진 좌표·역할 순서·높이 제외, 이진 출력 동치, 실제 학습의 변화, 퀴즈 건너뛰기 방지, 새 문제의 진도 초기화, 기존 모델·시각화·내보내기 회귀 테스트 포함.
- 브라우저: 숫자/OMR에 자유선을 그린 뒤 추가 → 선택한 클래스의 첫 자료에 저장 → 입력 그림과 미리보기 초기화 확인.
- 브라우저: 사진 클릭으로 공·골키퍼 선택 → 좌표/정답 추가, 계산·오답 피드백·재생·네 퀴즈 완료 → 연습의 은닉 뉴런 1개 확인.
- 1280×720 및 390×844에서 수집/이해 패널의 크기와 겹침 확인. 작은 화면은 같은 공통 작업면 탭을 사용한다. 실제 기기 전체나 모든 확대율을 검증했다는 의미는 아니다.
- 이는 구현·계산 일치성 검토이다. 실제 중학생 대상 이해도·학습 효과 실험을 수행한 것은 아니다.

## 생성 사진 기록

- 실행 모드: 내장 이미지 생성 도구(built-in image generation).
- 앱 자산: `public/illustrations/penalty-goalkeeper-photo.png` (1536×1024).
- 한 명의 가상 성인 골키퍼를 담은 수업용 생성 사진. 실존 학생이나 경기 사진이 아니다.
- 사진은 자료 수집의 좌우 위치를 선택하는 배경이다. 승부차기 모델이 사진 픽셀을 학습한다고 설명하지 않는다.
- 실제 생성 결과의 골대 경계를 확인해 `src/core/penalty.ts`의 `GOAL_BOUNDS`에 반영했다. 사진을 자르거나 교체하면 이 경계도 다시 검증해야 한다.

최종 생성 프롬프트:

> Use case: photorealistic-natural. Asset type: background photograph for a middle-school educational penalty-kick data collection interface. A single fictional adult goalkeeper in a plain unbranded purple long-sleeve jersey and gloves stands ready at the exact center of a soccer goal on a school sports field. Front-on symmetrical view from the penalty taker's position, full body visible and full goal visible. Goal opening extends approximately from 10% to 90% horizontally and from 17% to 78% vertically in the image. The goalie occupies a modest central area so both left and right areas of the goal net are clearly empty, available for students to click a target. Natural daytime lighting, believable grass and net, quiet simple field, sharp and readable goalposts, restrained natural colors. Landscape 3:2 composition. This is a background photo only, not a UI mockup: no text, no arrows, no markers, no plotted points, no balls, no logos, no watermark, no additional people.
