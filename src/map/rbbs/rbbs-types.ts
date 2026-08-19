export interface AxisInfo {
  axisID: string;
  name: string;
  typ: string;
  positionCode: string;
}

export interface AxisSegmentInfo {
  axisSegmentID: string;
  name: string;
  axisInfo: AxisInfo;
}

export interface RefPtInfo {
  refPtID: string;
  name: string | null;
  axisSegmentInfo: AxisSegmentInfo;
}

export interface PointRbbs {
  refPtID: string;
  u: number;
  v: number;
}

export interface XyToRbbsResult {
  pointRbbs: PointRbbs;
  refPtInfo: RefPtInfo;
}

export interface XyToRbbsErrorResponse {
  status: 'error';
  message: string;
}
