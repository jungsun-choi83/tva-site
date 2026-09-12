# CONTACT v3 전달 패킷

기존 원본 학습 자료의 색면·변화 있는 선·패턴 대비를 적용한 한 세트. 내장 image_gen으로 제작. 사용자 품질 승인이나 본사이트 통합 완료를 뜻하지 않습니다.

## 파일

- [letterpaper/contact-letterpaper-v3.png](letterpaper/contact-letterpaper-v3.png)
- [envelopes/envelope-front.png](envelopes/envelope-front.png)
- [envelopes/envelope-back.png](envelopes/envelope-back.png)
- [envelopes/envelope-open.png](envelopes/envelope-open.png)
- [mailbox/mailbox-v3.png](mailbox/mailbox-v3.png)
- [poses/pickup.png](poses/pickup.png)
- [poses/carry-01.png](poses/carry-01.png)
- [poses/carry-02.png](poses/carry-02.png)
- [poses/insertion.png](poses/insertion.png)

## 좌표 및 검증

- [통합 manifest](manifest.json)
- [봉투 몸체/플랩/림](envelopes/manifest.json)
- [편지지 입력/접힘/삽입](letterpaper/paper-manifest.json)
- [전후 비교](before-after.png)
- [접힘/정렬 검증](geometry-proof.png)

우체통만 투명 RGBA입니다. 나머지는 흰색 계열 RGB 배경입니다. 봉투 세 면은 같은 몸체 사각형으로 렌더 정규화하며, 편지지는 비율을 왜곡하지 않고 안쪽에 축소하여 삽입합니다. 포즈의 봉투 외 픽셀 완전 동일성은 보장하지 않으며 기존 형상/발 위치를 비교했습니다.
