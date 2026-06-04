export interface RawWebmapLayer {
  id: string;
  title: string;
  layerType: string;
  url?: string;
  templateUrl?: string;
  visibility?: boolean;
  layers?: RawWebmapLayer[];
  wmtsInfo?: {
    url: string;
    layerIdentifier: string;
  };
}
