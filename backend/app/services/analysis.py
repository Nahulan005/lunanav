import json
from pathlib import Path

from app.providers.interfaces import TerrainProvider, EphemerisProvider, ImageryProvider, VisibilityAnalysisProvider
from app.schemas.analysis import AnalysisRequest, AnalysisResponse, SourceReference


def load_source_references() -> list[SourceReference]:
    path = Path(__file__).resolve().parents[3] / "docs" / "source-registry.json"
    registry = json.loads(path.read_text(encoding="utf-8"))
    return [SourceReference(id=item["id"], official_name=item["officialName"],
        official_url=item["officialUrl"], integration_status=item["integrationStatus"])
        for item in registry["resources"]]


class AnalysisService:
    def __init__(self, terrain: TerrainProvider, ephemeris: EphemerisProvider,
                 imagery: ImageryProvider, visibility: VisibilityAnalysisProvider):
        self.terrain = terrain
        self.ephemeris = ephemeris
        self.imagery = imagery
        self.visibility = visibility

    def analyze(self, request: AnalysisRequest) -> AnalysisResponse:
        terrain = self.terrain.get_terrain(request)
        ephemeris = self.ephemeris.get_geometry(request)
        imagery = self.imagery.get_imagery(request)
        visibility = self.visibility.analyze(request, terrain, ephemeris)
        results = [terrain, ephemeris, imagery, visibility]
        if any(result.provenance.mode != "mock" for result in results):
            raise RuntimeError("This API version supports explicit mock providers only; enable real-data response semantics before replacing providers.")
        return AnalysisResponse(request=request, terrain=terrain, ephemeris=ephemeris,
            imagery=imagery, visibility=visibility, source_references=load_source_references(),
            warnings=["All returned values are illustrative mock fixtures, not scientific predictions.",
                      "One fixture timestamp does not cover the requested mission window.",
                      "Earth geometric visibility does not establish radio communication.",
                      "Mission feasibility and safety have not been assessed."])
