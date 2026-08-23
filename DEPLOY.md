# 배포 · 운영 가이드

이 서버는 배포 전용 macmini 한 대에서 **pm2**로 여러 앱을 같이 띄워 운영합니다.
(`glance-front-dev/main`, `planlog-backend`, `planlog-frontend-dev/main`)

## 전체 구성

| 구성 요소 | 방식 | 비고 |
|---|---|---|
| `planlog-backend` | pm2 (fork) | `dist/src/main.js`, 포트 `9000` (`.env`의 `PORT` 미설정 시 기본값) |
| `planlog-frontend-main/dev` | pm2 (fork) | Next.js, 포트 `4000`/`4001` |
| `glance-front-main/dev` | pm2 (fork) | Next.js, 포트 `3000`/`3001` |
| MySQL | Docker (`planlog-mysql`) | 포트 `3306`, 백엔드가 기동 시 즉시 연결 시도 |

pm2 프로세스 목록은 `~/.pm2/dump.pm2`에 저장되며, `pm2 save`로 스냅샷을 갱신합니다.

---

## 평시 상태 확인

```bash
pm2 status                                   # 전체 앱 상태
pm2 logs planlog-backend --lines 50          # 백엔드 로그
docker ps                                    # planlog-mysql 등 컨테이너 상태
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9000/api/docs   # 헬스체크 (200이면 정상)
```

---

## 정상 배포 (코드 변경 반영)

```bash
git pull
npm ci
npm run build                # dist/ 갱신
pm2 restart planlog-backend
pm2 save
```

---

## 정전 등으로 서버가 통째로 내려갔을 때 복구

전원이 나가면 pm2 데몬과 Docker 컨테이너가 전부 죽는다. 복구 순서:

1. **DB 컨테이너 먼저 기동** (백엔드가 기동 즉시 DB에 붙으므로 반드시 선행)
   ```bash
   docker start planlog-mysql
   # ready 될 때까지 대기
   until docker exec planlog-mysql mysqladmin ping -h localhost --silent; do sleep 2; done
   ```

2. **pm2 저장된 목록 복구** — `planlog-backend` 뿐 아니라 dump에 저장된 5개 앱이 한 번에 복구됨
   ```bash
   pm2 resurrect
   ```

3. **정상 기동 확인**
   ```bash
   pm2 logs planlog-backend --lines 40 --nostream   # 에러 없이 라우트 매핑 로그가 끝까지 나오는지
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9000/api/docs   # 200 기대
   ```

4. **목록 재저장** (뭔가 수동으로 더 손봤다면)
   ```bash
   pm2 save
   ```

> `pm2 list`가 비어 있는데 `[PM2][WARN] Current process list is not synchronized...` 경고가 뜨면,
> 데몬만 재시작되고 프로세스는 못 살아난 상태 — `pm2 resurrect`로 복구하면 된다.

### 참고: 다른 컨테이너들
같은 머신에 `glance-*` 관련 컨테이너(postgres/redis/backend)도 함께 떠 있는데, planlog-backend와는 무관하므로 이 문서 범위 밖. 필요 시 해당 프로젝트 문서 참고.
