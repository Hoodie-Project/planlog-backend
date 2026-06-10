/**
 * 한국관광공사 TourAPI(KorService2, GoCamping 등) 공통 응답 구조.
 * 결과가 없을 때 body.items 가 빈 문자열("")로 내려오는 케이스가 있어 유니온으로 둔다.
 */
export interface TourApiResponse<T> {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: { item: T[] | T } | '';
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

/** 페이징 메타 + 정규화된 목록을 함께 돌려주는 내부 표준 형태 */
export interface TourApiList<T> {
  items: T[];
  pageNo: number;
  numOfRows: number;
  totalCount: number;
}

/** KorService2 지역기반/위치기반 공통 아이템(필요한 필드 위주) */
export interface TourRawItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  addr1?: string;
  addr2?: string;
  areacode?: string;
  sigungucode?: string;
  cat1?: string;
  cat2?: string;
  cat3?: string;
  mapx?: string;
  mapy?: string;
  dist?: string;
  firstimage?: string;
  firstimage2?: string;
  tel?: string;
  zipcode?: string;
  modifiedtime?: string;
  // 축제 전용
  eventstartdate?: string;
  eventenddate?: string;
}
